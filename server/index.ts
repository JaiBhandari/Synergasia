import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import express, { type Request, Response, NextFunction } from "express";
import iconv from "iconv-lite";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";

// Force iconv-lite to eagerly load its encodings at startup.
// Without this, the lazy require('../encodings') inside iconv.getCodec()
// can fail mid-request in production ESM environments (EAI_AGAIN / MODULE_NOT_FOUND).
iconv.encodingExists("utf-8");

const app = express();

// Set trust proxy before any session middleware for security
// This enables proper HTTPS detection when behind reverse proxy (like Replit)
app.set("trust proxy", 1);

// HTTPS Enforcement Middleware (Production Only)
// Note: Skip redirect for internal/localhost requests (Replit health checks use plain HTTP internally)
app.use((req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const host = req.headers.host || '';
  const isInternalRequest = host.includes('127.0.0.1') || host.includes('localhost') || host.startsWith('0.0.0.0');

  if (isProduction && !isSecure && !isInternalRequest) {
    const httpsUrl = `https://${host}${req.url}`;
    return res.redirect(308, httpsUrl);
  }
  
  next();
});

// Environment-aware Security Headers Middleware
app.use((req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  
  // HSTS - Force HTTPS connections (production + HTTPS only)
  if (isProduction && isSecure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Content Security Policy - Environment-specific settings
  let cspDirectives;
  
  if (isProduction) {
    // Strict production CSP - no unsafe-inline or unsafe-eval for better XSS protection
    cspDirectives = [
      "default-src 'self'",
      "script-src 'self'", // No unsafe-inline/eval in production
      "style-src 'self' https://fonts.googleapis.com", // Allow Google Fonts CSS
      "img-src 'self' data: blob: https:", // Allow images from various sources
      "font-src 'self' data: https://fonts.gstatic.com", // Allow Google Fonts files
      "connect-src 'self'", // API calls only (no websockets needed in production)
      "media-src 'self'",
      "object-src 'none'", // Prevent Flash/Java execution
      "base-uri 'self'", // Prevent base tag injection
      "form-action 'self'", // Restrict form submissions
      "frame-ancestors 'none'", // Prevent embedding (clickjacking protection)
    ];
  } else {
    // Development CSP - permissive for Vite and React development
    cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-inline/eval needed for Vite dev and React
      "style-src 'self' 'unsafe-inline'", // unsafe-inline needed for Tailwind CSS
      "img-src 'self' data: blob: https:", // Allow images from various sources
      "font-src 'self' data:", // Allow fonts
      "connect-src 'self' ws: wss:", // Allow API calls and websockets (for Vite HMR)
      "media-src 'self'",
      "object-src 'none'", // Prevent Flash/Java execution
      "base-uri 'self'", // Prevent base tag injection
      "form-action 'self'", // Restrict form submissions
      "frame-ancestors 'none'", // Prevent embedding (clickjacking protection)
    ];
  }
  
  // Add upgrade-insecure-requests only in production with HTTPS
  if (isProduction && isSecure) {
    cspDirectives.push("upgrade-insecure-requests");
  }
  
  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
  
  // Security headers (always applied)
  res.setHeader('X-Frame-Options', 'DENY'); // Prevent clickjacking
  res.setHeader('X-Content-Type-Options', 'nosniff'); // Prevent MIME type sniffing
  res.setHeader('X-XSS-Protection', '1; mode=block'); // Enable browser XSS filtering
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); // Control referrer leakage
  
  // Permissions-Policy - Control browser feature access
  const permissionsPolicies = [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'interest-cohort=()', // Disable FLoC
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'accelerometer=()',
    'gyroscope=()'
  ];
  res.setHeader('Permissions-Policy', permissionsPolicies.join(', '));
  
  // Remove Express signature (security through obscurity)
  res.removeHeader('X-Powered-By');
  
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

// Stricter limiter for password-reset initiation (prevents email flooding)
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many password reset requests, please try again later." },
});

// Stricter limiter for code verification (limits brute-force guessing per IP)
const verifyCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many verification attempts, please try again later." },
});

// Apply rate limiting to auth endpoints
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", forgotPasswordLimiter);
app.use("/api/auth/verify-reset-code", verifyCodeLimiter);
app.use("/api/auth/reset-password", authLimiter);
app.use("/api/password-reset", authLimiter);

// Note: CSRF protection is handled via SameSite cookies and session authentication
// The session cookie uses sameSite: 'lax' which prevents cross-site request forgery
// Combined with the secure cookie flag in production and other security headers

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;

    // Never leak raw Node.js internals (MODULE_NOT_FOUND, stack traces, etc.) to the client.
    // Use the error's message only for well-known HTTP errors (those that have an explicit status).
    // For unexpected 500s, return a safe generic message.
    const isHttpError = err.status || err.statusCode;
    const message = isHttpError
      ? (err.message || "Internal Server Error")
      : "Internal Server Error";

    console.error("[ERROR]", err);
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);

    // Set up scheduled job to create event reminders daily
    // Run the reminder check every hour
    const reminderInterval = setInterval(async () => {
      try {
        await storage.createEventReminders();
        log("Event reminders checked and created");
      } catch (error) {
        console.error("Error creating event reminders:", error);
      }
    }, 60 * 60 * 1000); // Run every hour (60 minutes * 60 seconds * 1000 milliseconds)

    // Also run immediately when server starts
    storage.createEventReminders().then(() => {
      log("Initial event reminder check completed");
    }).catch((error) => {
      console.error("Error during initial event reminder check:", error);
    });
  });
})();
