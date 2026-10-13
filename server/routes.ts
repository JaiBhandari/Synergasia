import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import connectPg from "connect-pg-simple";
import "./types";
import bcrypt from "bcrypt";
import crypto from "crypto";
import sgMail from "@sendgrid/mail";
import nodemailer from "nodemailer";
import webpush from "web-push";
import { isAuthenticated, setupAuth } from "./replitAuth";

// Helper function to get user info from either Passport.js or session
async function getUserFromRequest(req: any): Promise<{ id: string; email?: string; role?: string; profileId?: number } | null> {
  console.log('[AUTH] Getting user from request...');
  
  // Check if we already have cached user data in session to avoid DB queries
  if (req.session?.cachedUser) {
    console.log('[AUTH] Using cached user data:', req.session.cachedUser.id);
    return req.session.cachedUser;
  }

  let user: any = null;
  
  // Try Passport.js authentication first (Replit Auth)
  if (req.isAuthenticated && req.isAuthenticated()) {
    const authUser = req.user as any;
    console.log('[AUTH] OIDC user authenticated:', { claims_sub: authUser.claims?.sub || authUser.sub, has_access_token: !!authUser.access_token });
    
    // Handle OIDC claims from both production and testing environment
    const userId = authUser.claims?.sub || authUser.sub;
    if (userId) {
      console.log('[AUTH] Found userId from OIDC claims:', userId);
      user = await storage.getUser(userId);
      if (user) {
        console.log('[AUTH] Retrieved user from database:', { id: user.id, email: user.email, role: user.role });
      } else {
        console.log('[AUTH] User not found in database for userId:', userId);
        return null;
      }
    } else {
      console.log('[AUTH] No userId found in OIDC claims');
      return null;
    }
  } 
  // Fallback to manual session authentication
  else if (req.session?.user) {
    console.log('[AUTH] Using session authentication for user:', req.session.user.id);
    // For session auth, get the full user record from database to validate
    user = await storage.getUser(req.session.user.id);
    if (!user) {
      console.log('[AUTH] Session user not found in database:', req.session.user.id);
      return null;
    }
  }
  
  if (!user) {
    console.log('[AUTH] No authentication found');
    return null;
  }

  let profileId: number | undefined;
  
  // CRITICAL: Validate that users with role-specific profiles actually exist
  if (user.role === 'student') {
    const studentProfile = await storage.getStudentByUserId(user.id);
    if (!studentProfile) {
      console.log('[AUTH] Student user has no student profile - treating as orphaned:', user.id);
      return null;
    }
    profileId = studentProfile.id;
  } else if (user.role === 'counselor') {
    const counselorProfile = await storage.getCounselorByUserId(user.id);
    if (!counselorProfile) {
      console.log('[AUTH] Counselor user has no counselor profile - treating as orphaned:', user.id);
      return null;
    }
    profileId = counselorProfile.id;
  }
  // Admin and developer roles don't need additional profile validation
  
  const userData = { 
    id: user.id, 
    email: user.email ?? undefined, 
    role: user.role ?? undefined,
    profileId
  };
  
  // Cache the user data in session to avoid future DB queries
  req.session.cachedUser = userData;
  console.log('[AUTH] Cached user data in session');
  
  return userData;
}

// Enhanced requireAuth that supports both authentication methods  
const requireAuthCompat = async (req: any, res: any, next: any) => {
  const authStartTime = Date.now();
  const user = await getUserFromRequest(req);
  const authTime = Date.now() - authStartTime;
  console.log(`[PERF] Auth middleware took ${authTime}ms`);
  
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  // Store user info in a consistent location for backward compatibility
  req.sessionUser = user;
  next();
};

// Helper function to clear cached user data (call on logout/role changes)
function clearUserCache(req: any) {
  if (req.session?.cachedUser) {
    console.log('[AUTH] Clearing cached user data');
    delete req.session.cachedUser;
  }
}
import {
  insertUserSchema,
  insertStudentSchema,
  insertCounselorSchema,
  insertProfileFieldSchema,
  insertProfileFieldCategorySchema,
  insertUniversitySchema,
  insertTaskSchema,
  insertActivitySchema,
  insertPlannerEventSchema,
  insertDocumentSchema,
  insertNotificationSchema,
  insertMessageSchema,
  restoreRequestSchema,
  type PlannerEvent,
  type Counselor,
} from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";

// Initialize SendGrid with API key (blueprint:javascript_sendgrid)
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Configure web-push for push notifications
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:support@synergasia.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.log('[PUSH] VAPID keys not configured - push notifications will not work');
}

// Helper function to send push notifications
export async function sendPushNotification(userId: string, title: string, message: string): Promise<void> {
  try {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      console.log('[PUSH] VAPID keys not configured - skipping push notification');
      return;
    }

    const users = await storage.getUsersWithPushEnabled([userId]);
    if (users.length === 0) {
      console.log(`[PUSH] User ${userId} does not have push notifications enabled or no subscription`);
      return;
    }

    const user = users[0];
    if (!user.pushSubscription) {
      console.log(`[PUSH] No push subscription found for user ${userId}`);
      return;
    }

    const payload = JSON.stringify({
      title,
      message,
      body: message,
      icon: '/favicon.ico',
      badge: '/favicon.ico'
    });

    await webpush.sendNotification(user.pushSubscription as any, payload);
    console.log(`[PUSH] Successfully sent push notification to user ${userId}`);
  } catch (error) {
    console.error(`[PUSH] Error sending push notification to user ${userId}:`, error);
  }
}

// Helper function to generate 6-digit verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Per-account failed attempt tracking for reset code verification
// Key: userId, Value: { count, lockedUntil }
const resetCodeFailedAttempts = new Map<number, { count: number; lockedUntil: number }>();
const MAX_RESET_CODE_ATTEMPTS = 5;

// Helper function to send verification code email via SMTP
async function sendVerificationCodeEmailViaSMTP(email: string, code: string): Promise<void> {
  console.log('[SMTP] Checking SMTP configuration...');
  const systemSettings = await storage.getSystemSettings();
  
  if (!systemSettings?.smtpHost || !systemSettings?.smtpUser || !systemSettings?.smtpPassword) {
    console.log('[SMTP] SMTP not configured - logging verification code');
    // Only log safe data in development mode
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n=================================');
      console.log('SMTP NOT CONFIGURED - PASSWORD RESET CODE');
      console.log('Email domain:', email ? email.split('@')[1] : 'unknown');
      console.log('Code length:', code ? code.length : 0);
      console.log('Note: Configure SMTP settings in system settings to send actual emails');
      console.log('=================================\n');
      // In development, log the code and don't throw error
      return;
    } else {
      console.log('SMTP configuration incomplete - cannot send verification email');
      throw new Error('SMTP not configured');
    }
  }

  const platformName = systemSettings?.platformName || 'Synergasia';
  const fromEmail = systemSettings?.smtpUser; // Use SMTP user as sender

  // Create transporter using SMTP settings with proper TLS/SSL configuration
  const smtpPort = Number(systemSettings.smtpPort) || 587; // Ensure number type
  const isSSLPort = smtpPort === 465;
  const requiresTLS = smtpPort !== 465; // All non-SSL ports should enforce TLS
  
  // Check if this is a Gmail account to use optimized configuration
  const isGmail = systemSettings.smtpHost?.toLowerCase().includes('gmail') || 
                  systemSettings.smtpUser?.toLowerCase().includes('gmail.com');
  
  let transporter;
  
  if (isGmail) {
    // For Gmail, use the service configuration which is more reliable
    console.log('[SMTP] Using Gmail service configuration...');
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: systemSettings.smtpUser,
        pass: systemSettings.smtpPassword.replace(/\s/g, ''), // Remove any spaces from app password
      },
    });
  } else {
    // For other SMTP providers, use the existing configuration
    transporter = nodemailer.createTransport({
      host: systemSettings.smtpHost,
      port: smtpPort,
      secure: isSSLPort, // true for port 465 (SSL), false for other ports
      requireTLS: requiresTLS, // enforce TLS for all non-SSL ports
      auth: {
        user: systemSettings.smtpUser,
        pass: systemSettings.smtpPassword,
      },
      // Enhanced security options
      tls: {
        // Strict certificate validation in production
        rejectUnauthorized: process.env.NODE_ENV === 'production',
        // Minimum TLS version for security
        minVersion: 'TLSv1.2',
        // Cipher preferences for better security
        ciphers: 'ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS'
      },
    });
  }

  const mailOptions = {
    from: `${platformName} <${fromEmail}>`,
    to: email,
    subject: `Password Reset Code - ${platformName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>You requested to reset your password. Please use the verification code below:</p>
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
          <h1 style="color: #4f46e5; letter-spacing: 5px; margin: 0;">${code}</h1>
        </div>
        <p>This code will expire in 15 minutes.</p>
        <p>If you didn't request this password reset, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">This is an automated message from ${platformName}. Please do not reply to this email.</p>
      </div>
    `,
    text: `Password Reset Code\n\nYour verification code is: ${code}\n\nThis code will expire in 15 minutes.\n\nIf you didn't request this password reset, please ignore this email.`
  };

  try {
    await transporter.sendMail(mailOptions);
    const securityInfo = isGmail ? 'Gmail Service' : (isSSLPort ? 'SSL (port 465)' : 'TLS/STARTTLS');
    // Only log safe data in development mode for debugging
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Password reset email sent successfully via secure SMTP (${securityInfo}) to domain:`, email ? email.split('@')[1] : 'unknown');
    } else {
      console.log(`Password reset email sent successfully via secure SMTP (${securityInfo})`);
    }
  } catch (error: any) {
    console.error('SMTP email error:', error?.code || 'SMTP_ERROR');
    const securityInfo = isGmail ? 'Gmail Service' : (isSSLPort ? 'SSL (port 465)' : 'TLS/STARTTLS');
    
    // Never log verification codes or email addresses in production
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n=================================');
      console.log('SECURE SMTP EMAIL FAILED - PASSWORD RESET CODE');
      console.log('Email domain:', email ? email.split('@')[1] : 'unknown');
      console.log('Code length:', code ? code.length : 0);
      console.log('Security Configuration:', securityInfo);
      console.log('Error:', error.message || 'Unknown error');
      
      // Provide specific guidance for Gmail authentication errors
      if (isGmail && error?.code === 'EAUTH') {
        console.log('\n--- GMAIL AUTHENTICATION TROUBLESHOOTING ---');
        console.log('1. Ensure 2-Factor Authentication is enabled on the Gmail account');
        console.log('2. Use an App Password (not your regular password)');
        console.log('3. Remove all spaces from the App Password');
        console.log('4. Try visiting: https://accounts.google.com/DisplayUnlockCaptcha');
        console.log('5. Wait a few minutes after generating a new App Password');
        console.log('6. Verify the email address is correct');
        console.log('--- END TROUBLESHOOTING ---\n');
      } else {
        console.log('Note: Verify SMTP server supports the configured security protocol');
      }
      console.log('=================================\n');
    } else {
      console.log('SMTP email delivery failed - check server configuration');
    }
    throw error;
  }
}

// Helper function to send verification code email using SendGrid with SMTP fallback
async function sendVerificationCodeEmail(email: string, code: string): Promise<void> {
  console.log('\n=== EMAIL SENDING DEBUG START ===');
  console.log('Email domain:', email ? email.split('@')[1] : 'unknown');
  console.log('Code length:', code ? code.length : 0);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('SENDGRID_API_KEY configured:', !!process.env.SENDGRID_API_KEY);
  
  // Get system settings for email configuration
  const systemSettings = await storage.getSystemSettings();
  const fromEmail = systemSettings?.supportEmail || 'support@synergasia.com';
  const platformName = systemSettings?.platformName || 'Synergasia';
  
  console.log('System settings:', { fromEmail, platformName });
  console.log('SMTP configured:', !!(systemSettings?.smtpHost && systemSettings?.smtpUser && systemSettings?.smtpPassword));

  // Try SendGrid first if configured
  if (process.env.SENDGRID_API_KEY) {
    console.log('[SENDGRID] Attempting SendGrid email send...');
    const msg = {
      to: email,
      from: fromEmail, // Use support email from settings (must be verified in SendGrid)
      subject: `Password Reset Code - ${platformName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>You requested to reset your password. Please use the verification code below:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
            <h1 style="color: #4f46e5; letter-spacing: 5px; margin: 0;">${code}</h1>
          </div>
          <p>This code will expire in 15 minutes.</p>
          <p>If you didn't request this password reset, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">This is an automated message from ${platformName}. Please do not reply to this email.</p>
        </div>
      `,
      text: `Password Reset Code\n\nYour verification code is: ${code}\n\nThis code will expire in 15 minutes.\n\nIf you didn't request this password reset, please ignore this email.`
    };

    try {
      console.log('[SENDGRID] Sending email via SendGrid...');
      await sgMail.send(msg);
      console.log('[SENDGRID] SendGrid email sent successfully!');
      // Only log safe data in development mode for debugging
      if (process.env.NODE_ENV !== 'production') {
        console.log('Password reset email sent successfully via SendGrid to domain:', email ? email.split('@')[1] : 'unknown');
      } else {
        console.log('Password reset email sent successfully via SendGrid');
      }
      console.log('=== EMAIL SENDING DEBUG END (SendGrid success) ===\n');
      return; // Success, no need to try SMTP
    } catch (error: any) {
      console.error('[SENDGRID] SendGrid email error:', error);
      console.log('[SENDGRID] Attempting to send via SMTP fallback...');
      
      // Try SMTP as fallback
      try {
        await sendVerificationCodeEmailViaSMTP(email, code);
        console.log('[SMTP] SMTP fallback succeeded!');
        console.log('=== EMAIL SENDING DEBUG END (SMTP success) ===\n');
        return; // SMTP succeeded
      } catch (smtpError: any) {
        console.error('[SMTP] SMTP fallback also failed:', smtpError);
        
        // In development mode, never log sensitive verification codes
        if (process.env.NODE_ENV !== 'production') {
          console.log('\n=================================');
          console.log('BOTH EMAIL METHODS FAILED - EMAIL DELIVERY FAILED');
          console.log('Email domain:', email ? email.split('@')[1] : 'unknown');
          console.log('Code length:', code ? code.length : 0);
          console.log('SendGrid Error:', error?.response?.body || error.message || 'Unknown error');
          console.log('SMTP Error:', smtpError.message || 'Unknown error');
          if (error.code === 403) {
            console.log('Note: The sender email must be verified in SendGrid.');
            console.log('Please verify', fromEmail, 'in your SendGrid account.');
          }
          console.log('=================================\n');
          console.log('=== EMAIL SENDING DEBUG END (both failed, code logged) ===\n');
          return; // Code was logged for development, continue without throwing
        } else {
          console.log('Email delivery failed - check both SendGrid and SMTP configuration');
          console.log('=== EMAIL SENDING DEBUG END (production failure) ===\n');
          throw error;
        }
      }
    }
  } else {
    // SendGrid not configured, try SMTP directly
    console.log('[NO-SENDGRID] SendGrid not configured, attempting SMTP...');
    try {
      await sendVerificationCodeEmailViaSMTP(email, code);
      console.log('[SMTP] SMTP email sent successfully!');
      console.log('=== EMAIL SENDING DEBUG END (SMTP success) ===\n');
    } catch (smtpError: any) {
      console.error('[SMTP] SMTP email error:', smtpError);
      
      // In development mode, never log sensitive verification codes
      if (process.env.NODE_ENV !== 'production') {
        console.log('\n=================================');
        console.log('SMTP FAILED - EMAIL DELIVERY FAILED');
        console.log('Email domain:', email ? email.split('@')[1] : 'unknown');
        console.log('Code length:', code ? code.length : 0);
        console.log('SMTP Error:', smtpError.message || 'Unknown error');
        console.log('Note: Configure either SendGrid API key or SMTP settings to send actual emails');
        console.log('=================================\n');
        console.log('=== EMAIL SENDING DEBUG END (SMTP failed) ===\n');
        return; // Code was logged for development, continue without throwing
      } else {
        console.log('Email delivery failed - check SMTP configuration or configure SendGrid');
        console.log('=== EMAIL SENDING DEBUG END (production SMTP failure) ===\n');
        throw smtpError;
      }
    }
  }
}

// Session setup removed - using shared session from replitAuth.ts to eliminate duplicate database connections

// Use the compatible authentication middleware that supports both methods
const requireAuth = requireAuthCompat;

const requireRole = (roles: string[]) => {
  return async (req: any, res: any, next: any) => {
    try {
      // Use cached user from requireAuthCompat instead of database lookup
      const user = req.sessionUser || await getUserFromRequest(req);
      
      if (!user || !user.role) {
        console.log("Role check failed - no user or role found");
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      console.log("RequireRole middleware - User role:", user.role);
      console.log("RequireRole middleware - Required roles:", roles);
      
      if (!roles.includes(user.role)) {
        console.log("Role check failed - insufficient permissions");
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      console.log("Role check passed - calling next()");
      next();
    } catch (error) {
      console.error("Error in requireRole middleware:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
};

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for file uploads
const storage_multer = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage_multer,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allow common document types
    const allowedTypes = /pdf|doc|docx|txt|png|jpg|jpeg|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only documents and images are allowed'));
    }
  }
});

// Helper function to update student lastActivity
async function updateStudentLastActivity(userId: string) {
  try {
    // Get the user to check their role
    const user = await storage.getUser(userId);
    if (user && user.role === "student") {
      // Get the student record
      const student = await storage.getStudentByUserId(userId);
      if (student) {
        // Update the lastActivity to current timestamp
        await storage.updateStudent(student.id, {
          lastActivity: new Date()
        });
        console.log(`Updated lastActivity for student ${student.id}`);
      }
    }
  } catch (error) {
    console.error("Error updating student lastActivity:", error);
  }
}

// Notification helper functions
async function createNotificationForActivity(
  activityId: number, 
  studentId: number, 
  type: "activity_created" | "activity_updated" | "activity_completed",
  title: string,
  message: string
) {
  try {
    // Get the student to find their counselor and admin
    const student = await storage.getStudent(studentId);
    if (!student) return;

    const recipients = [];
    
    // Add counselor if exists
    if (student.counselorId) {
      const counselor = await storage.getCounselor(student.counselorId);
      if (counselor) {
        recipients.push(counselor.userId);
      }
    }

    // Add admin (get from student's user record)
    const studentUser = await storage.getUser(student.userId);
    if (studentUser && studentUser.adminId) {
      recipients.push(studentUser.adminId);
    }

    // Create notifications for all recipients
    for (const userId of recipients) {
      await storage.createNotification({
        userId,
        studentId,
        type,
        title,
        message,
        relatedId: activityId,
        isRead: false
      });
      
      // Send push notification
      await sendPushNotification(userId, title, message);
    }
  } catch (error) {
    console.error("Error creating notification:", error);
  }
}

async function createNotificationForTask(
  taskId: number,
  studentId: number,
  type: "task_assigned" | "task_completed",
  title: string,
  message: string
) {
  try {
    // Get the student to find their counselor and admin
    const student = await storage.getStudent(studentId);
    if (!student) return;

    const recipients = [];
    
    // Add the student themselves to receive notification
    recipients.push(student.userId);
    
    // Add counselor if exists
    if (student.counselorId) {
      const counselor = await storage.getCounselor(student.counselorId);
      if (counselor) {
        recipients.push(counselor.userId);
      }
    }

    // Add admin (get from student's user record)
    const studentUser = await storage.getUser(student.userId);
    if (studentUser && studentUser.adminId) {
      recipients.push(studentUser.adminId);
    }

    // Create notifications for all recipients
    for (const userId of recipients) {
      await storage.createNotification({
        userId,
        studentId,
        type,
        title,
        message,
        relatedId: taskId,
        isRead: false
      });
      
      // Send push notification
      await sendPushNotification(userId, title, message);
    }
  } catch (error) {
    console.error("Error creating notification:", error);
  }
}

// Optimized version that accepts pre-fetched data to avoid redundant database calls
async function createOptimizedNotificationForTask(
  taskId: number,
  studentId: number,
  type: "task_assigned" | "task_completed",
  title: string,
  message: string,
  studentRecord: any,
  studentUser: any
) {
  try {
    if (!studentRecord || !studentUser) return;

    const recipients = [];
    
    // Add the student themselves to receive notification
    recipients.push(studentRecord.userId);
    
    // Get counselor info if exists (only if not already fetched)
    if (studentRecord.counselorId) {
      const counselor = await storage.getCounselor(studentRecord.counselorId);
      if (counselor) {
        recipients.push(counselor.userId);
      }
    }

    // Add admin (using pre-fetched student user data)
    if (studentUser.adminId) {
      recipients.push(studentUser.adminId);
    }

    // Create all notifications in parallel for better performance
    const notificationPromises = recipients.map(async userId => {
      await storage.createNotification({
        userId,
        studentId,
        type,
        title,
        message,
        relatedId: taskId,
        isRead: false
      });
      
      // Send push notification
      await sendPushNotification(userId, title, message);
    });

    await Promise.all(notificationPromises);
  } catch (error) {
    console.error("Error creating optimized notification:", error);
  }
}

async function createNotificationForDocument(
  documentId: number,
  studentId: number,
  title: string,
  message: string
) {
  try {
    // Get the student to find their counselor and admin
    const student = await storage.getStudent(studentId);
    if (!student) return;

    const recipients = [];
    
    // Add counselor if exists
    if (student.counselorId) {
      const counselor = await storage.getCounselor(student.counselorId);
      if (counselor) {
        recipients.push(counselor.userId);
      }
    }

    // Add admin (get from student's user record)
    const studentUser = await storage.getUser(student.userId);
    if (studentUser && studentUser.adminId) {
      recipients.push(studentUser.adminId);
    }

    // Create notifications for all recipients
    for (const userId of recipients) {
      await storage.createNotification({
        userId,
        studentId,
        type: 'document_uploaded',
        title,
        message,
        relatedId: documentId,
        isRead: false
      });
      
      // Send push notification
      await sendPushNotification(userId, title, message);
    }
  } catch (error) {
    console.error("Error creating notification:", error);
  }
}

async function createNotificationForCounselorAction(
  counselorUserId: string,
  adminId: string,
  type: "counselor_task_created" | "counselor_task_updated" | "counselor_task_deleted" | 
        "counselor_university_created" | "counselor_university_updated" | "counselor_university_deleted" |
        "counselor_planner_event_created" | "counselor_planner_event_deleted" | 
        "counselor_feedback_provided",
  title: string,
  message: string,
  studentId?: number,
  relatedId?: number
) {
  try {
    // Create notification for admin about counselor action
    await storage.createNotification({
      userId: adminId,
      studentId: studentId || null,
      type,
      title,
      message,
      relatedId: relatedId || null,
      isRead: false
    });
    
    // Send push notification
    await sendPushNotification(adminId, title, message);
  } catch (error) {
    console.error("Error creating counselor action notification:", error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve landing page at root
  app.get("/", (req, res) => {
    const isDev = process.env.NODE_ENV !== "production";
    const landingPath = isDev
      ? path.resolve(process.cwd(), "client/public/landing.html")
      : path.resolve(process.cwd(), "dist/public/landing.html");

    // Override CSP for the landing page only.
    // The page loads Google Fonts, Three.js, and GSAP from cdnjs — all blocked by
    // the default app-wide CSP.  The inline <script> and <style> blocks in the HTML
    // also require 'unsafe-inline'.  All other security headers set by the global
    // middleware remain in effect.
    const landingCsp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self'",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");
    res.setHeader("Content-Security-Policy", landingCsp);

    res.sendFile(landingPath);
  });

  // Setup OIDC authentication first
  await setupAuth(app);

  // Student activity tracking middleware
  app.use(async (req: any, res, next) => {
    // Only track activity for authenticated students using Passport.js
    if (req.isAuthenticated && req.isAuthenticated()) {
      try {
        const authUser = req.user as any;
        const userId = authUser.claims?.sub;
        
        if (userId) {
          // Get user from database to check role
          const user = await storage.getUser(userId);
          if (user && user.role === 'student') {
            const student = await storage.getStudentByUserId(userId);
            
            if (student) {
              const now = new Date();
              const lastActivity = student.lastActivity ? new Date(student.lastActivity) : null;
              
              // Update last activity if it's been more than 5 minutes since last update
              // This prevents excessive database updates while keeping activity current
              if (!lastActivity || (now.getTime() - lastActivity.getTime()) > 5 * 60 * 1000) {
                await storage.updateStudent(student.id, {
                  lastActivity: now
                });
                console.log(`Updated lastActivity for student ${student.id} (${user.email})`);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error updating student activity:", error);
      }
    }
    next();
  });

  // Direct admin login for testing
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user || !user.password) {
        console.log(`[DEBUG] Login failed for ${email}: user not found or no password`);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      console.log(`[DEBUG] Login attempt for ${email}, role: ${user.role}, hasPassword: ${!!user.password}, passwordLength: ${user.password?.length}`);
      
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        console.log(`[DEBUG] Login failed for ${email}: invalid password`);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      console.log(`[DEBUG] Login successful for ${email}`);

      // Set user session manually
      req.session.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName || null,
        lastName: user.lastName || null
      };

      // Update student lastActivity if the user is a student
      await updateStudentLastActivity(user.id);
      
      res.json({ message: "Login successful", user: req.session.user });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Logout route
  app.get('/api/logout', (req, res) => {
    clearUserCache(req); // Clear cached user data before destroying session
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie('connect.sid');
      res.redirect('/');
    });
  });

  // Auth routes - Updated to handle both OIDC and session authentication
  app.get('/api/auth/user', requireAuth, async (req: any, res) => {
    try {
      console.log('[AUTH] /api/auth/user endpoint hit');
      console.log('[AUTH] isAuthenticated:', req.isAuthenticated?.());
      console.log('[AUTH] session user:', req.session?.user);
      
      // Use cached user from requireAuth middleware instead of database lookup
      const userInfo = req.sessionUser;
      if (!userInfo) {
        console.log('[AUTH] No user found, returning 401');
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      console.log('[AUTH] User info from request:', userInfo);
      
      const user = await storage.getUser(userInfo.id);
      if (!user) {
        console.log('[AUTH] User not found in database:', userInfo.id);
        return res.status(404).json({ message: "User not found" });
      }

      console.log('[AUTH] User found in database:', { id: user.id, email: user.email, role: user.role });

      // Include student or counselor data based on role
      let userData: any = { ...user };
      
      if (user.role === 'student') {
        const student = await storage.getStudentByUserId(user.id);
        if (student) {
          userData.student = student;
        }
      } else if (user.role === 'counselor') {
        const counselor = await storage.getCounselorByUserId(user.id);
        if (counselor) {
          userData.counselor = counselor;
        }
      }
      
      console.log('[AUTH] Returning user data with role:', user.role);
      res.json(userData);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Student self-access route
  app.get('/api/me/student', requireAuth, async (req: any, res) => {
    try {
      console.log("=== /api/me/student endpoint hit ===");
      console.log("Session:", req.session);
      console.log("User:", req.session?.user);
      
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      console.log("User ID:", userId, "Role:", userRole);
      
      if (userRole !== 'student') {
        console.log("User is not a student, rejecting");
        return res.status(403).json({ message: "Only students can access this endpoint" });
      }
      
      const student = await storage.getStudentByUserId(userId);
      console.log("Student found:", student);
      
      if (!student) {
        console.log("No student profile found for user ID:", userId);
        return res.status(404).json({ message: "Student profile not found" });
      }
      
      res.json(student);
    } catch (error) {
      console.error("Error fetching student profile:", error);
      res.status(500).json({ message: "Failed to fetch student profile" });
    }
  });

  // Get student's counselor information
  app.get('/api/me/counselor', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      if (userRole !== 'student') {
        return res.status(403).json({ message: "Only students can access this endpoint" });
      }
      
      // Get student record to find counselor ID
      const student = await storage.getStudentByUserId(userId);
      if (!student) {
        return res.status(404).json({ message: "Student profile not found" });
      }
      
      if (!student.counselorId) {
        return res.status(404).json({ message: "No counselor assigned" });
      }
      
      // Get counselor record
      const counselor = await storage.getCounselor(student.counselorId);
      if (!counselor) {
        return res.status(404).json({ message: "Counselor not found" });
      }
      
      // Get user information for the counselor
      const counselorUser = await storage.getUser(counselor.userId);
      if (!counselorUser) {
        return res.status(404).json({ message: "Counselor user information not found" });
      }
      
      // Return counselor information
      res.json({
        id: counselor.id,
        firstName: counselorUser.firstName,
        lastName: counselorUser.lastName,
        email: counselorUser.email,
        phoneNumber: counselorUser.phoneNumber,
        contactEmail: counselor.contactEmail,
        specialization: counselor.specialization,
        bio: counselor.bio
      });
    } catch (error) {
      console.error("Error fetching counselor information:", error);
      res.status(500).json({ message: "Failed to fetch counselor information" });
    }
  });

  // User management routes - now admin-scoped
  app.post('/api/users', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      const { email, firstName, lastName, role, password, counselorId } = req.body;
      const currentAdminId = req.session.user.id;
      
      console.log("Creating user with email:", email);
      console.log("Email normalized:", email.toLowerCase().trim());
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(email);
      console.log("Existing user found:", !!existingUser);
      
      if (existingUser) {
        console.log("Email already exists, returning 400");
        return res.status(400).json({ message: "Email already exists" });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = crypto.randomUUID();
      
      // Assign adminId for students and counselors to ensure multi-tenancy
      const adminId = (role === 'student' || role === 'counselor') ? currentAdminId : null;
      
      const user = await storage.upsertUser({
        id: userId,
        email,
        firstName,
        lastName,
        role,
        password: hashedPassword,
        adminId: adminId,
      });
      
      // Create role-specific record
      if (role === 'student') {
        // Convert adminCounselorId to actual database ID if provided
        let actualCounselorId = null;
        if (counselorId) {
          // Check if counselorId is already a database serial ID (numeric) or needs lookup
          const counselor = await storage.getCounselor(parseInt(counselorId));
          if (counselor && counselor.adminId === currentAdminId) {
            actualCounselorId = counselor.id;
          } else {
            // Fallback to lookup by adminCounselorId
            const counselorByAdminId = await storage.getCounselorByAdminCounselorId(parseInt(counselorId), currentAdminId);
            if (!counselorByAdminId) {
              return res.status(400).json({ message: "Invalid counselor selected" });
            }
            actualCounselorId = counselorByAdminId.id;
          }
        }
        await storage.createStudent({ userId, counselorId: actualCounselorId, adminId: currentAdminId });
      } else if (role === 'counselor') {
        await storage.createCounselor({ userId, contactEmail: email, adminId: currentAdminId });
      }
      
      res.json(user);
    } catch (error: any) {
      console.error("Error creating user:", error);
      
      // Check if it's a database constraint violation for duplicate email
      if (error.code === '23505' && error.constraint === 'users_email_hash_unique') {
        return res.status(400).json({ message: "Email already exists" });
      }
      
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.put('/api/users/:id/password', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      // Users can only update their own password unless they're admin
      if (userRole !== 'admin' && id !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      await storage.updateUserPassword(id, hashedPassword);
      
      // Send notification to admin if counselor or student updated their password
      if (id === userId && (userRole === 'counselor' || userRole === 'student')) {
        try {
          const user = await storage.getUser(id);
          let adminId = user?.adminId;
          let userName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User';
          let studentId = null;
          
          // For counselors, get adminId from counselor record
          if (userRole === 'counselor') {
            const counselor = await storage.getCounselorByUserId(id);
            if (counselor) {
              adminId = counselor.adminId;
            }
          }
          
          // For students, get studentId for notification
          if (userRole === 'student') {
            const student = await storage.getStudentByUserId(id);
            if (student) {
              studentId = student.id;
            }
          }
          
          // Send notification to admin
          if (adminId) {
            await storage.createNotification({
              userId: adminId,
              studentId,
              type: 'password_updated',
              title: 'Password Updated',
              message: `${userName} (${userRole}) has updated their password.`,
              isRead: false
            });
            
            await sendPushNotification(
              adminId,
              'Password Updated',
              `${userName} (${userRole}) has updated their password.`
            );
          }
        } catch (notificationError) {
          console.error('Error sending password update notification:', notificationError);
          // Don't fail the password update if notification fails
        }
      }
      
      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Error updating password:", error);
      res.status(500).json({ message: "Failed to update password" });
    }
  });

  // Admin-only endpoint to update student password
  app.put('/api/students/:id/password', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;
      const userId = req.session.user.id;
      const adminId = userId;
      
      // Get the student using adminStudentId - this is what the frontend sends
      const student = await storage.getStudentByAdminStudentId(parseInt(id), adminId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // Hash and update the password
      const hashedPassword = await bcrypt.hash(password, 10);
      await storage.updateUserPassword(student.userId, hashedPassword);
      
      res.json({ message: "Student password updated successfully" });
    } catch (error) {
      console.error("Error updating student password:", error);
      res.status(500).json({ message: "Failed to update student password" });
    }
  });

  // Admin-only endpoint to update counselor password
  app.put('/api/counselors/:id/password', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;
      const userId = req.session.user.id;
      const adminId = userId;
      
      // Get the counselor using adminCounselorId - this is what the frontend sends
      const counselor = await storage.getCounselorByAdminCounselorId(parseInt(id), adminId);
      if (!counselor) {
        return res.status(404).json({ message: "Counselor not found" });
      }
      
      // Hash and update the password
      const hashedPassword = await bcrypt.hash(password, 10);
      await storage.updateUserPassword(counselor.userId, hashedPassword);
      
      res.json({ message: "Counselor password updated successfully" });
    } catch (error) {
      console.error("Error updating counselor password:", error);
      res.status(500).json({ message: "Failed to update counselor password" });
    }
  });

  // User basic information update endpoint
  app.put('/api/users/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { firstName, lastName, phoneNumber } = req.body;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      // Users can only update their own information unless they're admin
      if (userRole !== 'admin' && id !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Get the current user to preserve other fields like email
      const currentUser = await storage.getUser(id);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Prepare update data - only update provided fields
      const updateData: any = { id };
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
      
      // Use upsertUser to update the user information
      const updatedUser = await storage.upsertUser(updateData);
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user information:", error);
      res.status(500).json({ message: "Failed to update user information" });
    }
  });

  // Password reset routes
  app.post('/api/auth/forgot-password', async (req, res) => {
    // Always return the same message regardless of whether the email exists,
    // to prevent account enumeration.
    const genericMessage = "If the email exists, a verification code has been sent";
    try {
      const { email } = req.body;
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.json({ message: genericMessage });
      }
      
      const verificationCode = generateVerificationCode();
      const expiry = new Date(Date.now() + 900000); // 15 minutes
      
      await storage.setResetToken(user.id, verificationCode, expiry);
      // Clear any prior failed attempt counter when a new code is issued
      resetCodeFailedAttempts.delete(user.id);
      
      try {
        await sendVerificationCodeEmail(email, verificationCode);
      } catch (emailError: any) {
        console.error("Email sending failed:", emailError);
        if (process.env.NODE_ENV !== 'development') {
          return res.status(500).json({ message: "Failed to send verification code. Please try again later." });
        }
      }
      
      res.json({ message: genericMessage });
    } catch (error) {
      console.error("Error in password reset:", error);
      res.status(500).json({ message: "An error occurred. Please try again later." });
    }
  });

  // Verify reset code endpoint
  app.post('/api/auth/verify-reset-code', async (req, res) => {
    try {
      const { email, code } = req.body;
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(400).json({ message: "Invalid email or code" });
      }

      // Per-account lockout: check if this account is temporarily locked
      const attemptEntry = resetCodeFailedAttempts.get(user.id);
      if (attemptEntry && Date.now() < attemptEntry.lockedUntil) {
        return res.status(429).json({ message: "Too many failed attempts. Please request a new verification code." });
      }
      
      // Check if code matches and is not expired
      if (user.resetToken !== code || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
        // Record failed attempt
        const current = resetCodeFailedAttempts.get(user.id) ?? { count: 0, lockedUntil: 0 };
        const newCount = current.count + 1;
        if (newCount >= MAX_RESET_CODE_ATTEMPTS) {
          // Invalidate the reset token in the database and lock the account entry
          await storage.setResetToken(user.id, "", new Date());
          resetCodeFailedAttempts.delete(user.id);
          return res.status(429).json({ message: "Too many failed attempts. Please request a new verification code." });
        }
        resetCodeFailedAttempts.set(user.id, { count: newCount, lockedUntil: 0 });
        return res.status(400).json({ message: "Invalid or expired verification code" });
      }
      
      // Code is valid — clear failed attempt counter
      resetCodeFailedAttempts.delete(user.id);

      // Generate a cryptographically random token for password reset
      const tempToken = crypto.randomBytes(32).toString('hex');
      const newExpiry = new Date(Date.now() + 600000); // 10 minutes to set new password
      
      await storage.setResetToken(user.id, tempToken, newExpiry);
      
      res.json({ 
        message: "Code verified successfully",
        resetToken: tempToken
      });
    } catch (error) {
      console.error("Error verifying reset code:", error);
      res.status(500).json({ message: "Failed to verify code" });
    }
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, password } = req.body;
      const user = await storage.getUserByResetToken(token);
      
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      await storage.updateUserPassword(user.id, hashedPassword);
      await storage.setResetToken(user.id, "", new Date()); // Clear token
      
      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });



  // User update endpoint
  app.patch('/api/users/:id', requireAuth, requireRole(['admin']), async (req, res) => {
    try {
      const { id } = req.params;
      const data = insertUserSchema.partial().parse(req.body);
      
      // Filter out undefined/null values
      const filteredData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined && value !== null)
      );
      
      if (Object.keys(filteredData).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
      
      const user = await storage.upsertUser({ id, ...filteredData });
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Student routes - now admin-scoped
  app.get('/api/students', requireAuth, requireRole(['admin', 'counselor']), async (req: any, res) => {
    try {
      const { search, counselorId } = req.query;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      // Get admin ID for filtering
      let adminId = null;
      let counselorFilter = counselorId ? parseInt(counselorId) : undefined;
      
      if (userRole === 'admin') {
        adminId = userId;
      } else if (userRole === 'counselor') {
        // Get counselor's admin ID and also filter by this counselor
        const counselor = await storage.getCounselorByUserId(userId);
        adminId = counselor?.adminId;
        counselorFilter = counselor?.id;
      }
      
      const students = await storage.getStudents(search, counselorFilter, adminId);
      res.json(students);
    } catch (error) {
      console.error("Error fetching students:", error);
      res.status(500).json({ message: "Failed to fetch students" });
    }
  });

  app.get('/api/students/archived', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      // Use cached user from requireAuth middleware instead of database lookup
      const user = req.sessionUser;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Role check is already handled by requireRole middleware
      const archivedStudents = await storage.getArchivedStudents(user.id);
      res.json(archivedStudents);
    } catch (error) {
      console.error("Error fetching archived students:", error);
      res.status(500).json({ message: "Failed to fetch archived students" });
    }
  });

  app.put('/api/students/admin/:adminStudentId/restore', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      const { adminStudentId } = req.params;
      // Use cached user from requireAuth middleware instead of database lookup
      const user = req.sessionUser;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!adminStudentId || isNaN(parseInt(adminStudentId))) {
        return res.status(400).json({ message: "Invalid admin student ID" });
      }

      // Validate request body
      const parseResult = restoreRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: parseResult.error.errors 
        });
      }

      const { email } = parseResult.data;

      // Only admins can restore students
      const adminId = user.id;
      
      // Restore the student using adminStudentId, adminId, and provided email
      const restoredStudent = await storage.restoreStudent(parseInt(adminStudentId), adminId, email);
      
      res.json({ 
        message: "Student restored successfully with original information", 
        student: restoredStudent 
      });
    } catch (error: any) {
      console.error("Error restoring student:", error);
      
      // Handle specific error messages from storage layer
      if (error.message.includes("not found")) {
        return res.status(404).json({ message: error.message });
      }
      if (error.message.includes("not archived")) {
        return res.status(400).json({ message: error.message });
      }
      if (error.message.includes("already in use")) {
        return res.status(409).json({ message: error.message });
      }
      if (error.message.includes("required")) {
        return res.status(400).json({ message: error.message });
      }
      
      res.status(500).json({ message: "Failed to restore student" });
    }
  });

  app.get('/api/students/:id', requireAuth, requireRole(['admin', 'counselor']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      console.log("Fetching student with adminStudentId:", id);
      
      if (!id || isNaN(parseInt(id))) {
        console.log("Invalid adminStudentId provided:", id);
        return res.status(400).json({ message: "Invalid student ID" });
      }
      
      // Get admin ID for scoped lookup
      let adminId = null;
      
      if (userRole === 'admin') {
        adminId = userId;
      } else if (userRole === 'counselor') {
        // Get counselor's admin ID
        const counselor = await storage.getCounselorByUserId(userId);
        adminId = counselor?.adminId;
        
        if (!adminId) {
          return res.status(403).json({ message: "Counselor not associated with an admin" });
        }
      }
      
      if (!adminId) {
        return res.status(403).json({ message: "Unauthorized: Unable to determine admin context" });
      }
      
      const student = await storage.getStudentByAdminStudentId(parseInt(id), adminId);
      console.log("Student found:", !!student);
      
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // Additional authorization for counselors - they can only access their assigned students
      if (userRole === 'counselor') {
        const counselor = await storage.getCounselorByUserId(userId);
        if (!counselor || Number(student.counselorId) !== Number(counselor.id)) {
          return res.status(403).json({ message: "Unauthorized: You can only access students assigned to you" });
        }
      }
      
      res.json(student);
    } catch (error) {
      console.error("Error fetching student:", error);
      res.status(500).json({ message: "Failed to fetch student" });
    }
  });

  // Alternative endpoint path for frontend compatibility  
  app.get('/api/students/by-admin-id/:id', requireAuth, requireRole(['admin', 'counselor']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      console.log("Fetching student via by-admin-id with adminStudentId:", id);
      
      if (!id || isNaN(parseInt(id))) {
        console.log("Invalid adminStudentId provided:", id);
        return res.status(400).json({ message: "Invalid student ID" });
      }
      
      // Get admin ID for scoped lookup
      let adminId = null;
      
      if (userRole === 'admin') {
        adminId = userId;
      } else if (userRole === 'counselor') {
        // Get counselor's admin ID
        const counselor = await storage.getCounselorByUserId(userId);
        adminId = counselor?.adminId;
        
        if (!adminId) {
          return res.status(403).json({ message: "Counselor not associated with an admin" });
        }
      }
      
      if (!adminId) {
        return res.status(403).json({ message: "Unauthorized: Unable to determine admin context" });
      }
      
      const student = await storage.getStudentByAdminStudentId(parseInt(id), adminId);
      console.log("Student found via by-admin-id:", !!student);
      
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // Additional authorization for counselors - they can only access their assigned students
      if (userRole === 'counselor') {
        const counselor = await storage.getCounselorByUserId(userId);
        if (!counselor || Number(student.counselorId) !== Number(counselor.id)) {
          return res.status(403).json({ message: "Unauthorized: You can only access students assigned to you" });
        }
      }
      
      res.json(student);
    } catch (error) {
      console.error("Error fetching student via by-admin-id:", error);
      res.status(500).json({ message: "Failed to fetch student" });
    }
  });

  // Student profile endpoint for frontend compatibility
  app.get('/api/students/by-admin-id/:id/profile', requireAuth, requireRole(['admin', 'counselor']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      console.log("Fetching student profile via by-admin-id with adminStudentId:", id);
      
      if (!id || isNaN(parseInt(id))) {
        console.log("Invalid adminStudentId provided:", id);
        return res.status(400).json({ message: "Invalid student ID" });
      }
      
      // Get admin ID for scoped lookup
      let adminId = null;
      
      if (userRole === 'admin') {
        adminId = userId;
      } else if (userRole === 'counselor') {
        // Get counselor's admin ID
        const counselor = await storage.getCounselorByUserId(userId);
        adminId = counselor?.adminId;
        
        if (!adminId) {
          return res.status(403).json({ message: "Counselor not associated with an admin" });
        }
      }
      
      if (!adminId) {
        return res.status(403).json({ message: "Unauthorized: Unable to determine admin context" });
      }
      
      const student = await storage.getStudentByAdminStudentId(parseInt(id), adminId);
      console.log("Student profile found via by-admin-id:", !!student);
      
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // Additional authorization for counselors - they can only access their assigned students
      if (userRole === 'counselor') {
        const counselor = await storage.getCounselorByUserId(userId);
        if (!counselor || Number(student.counselorId) !== Number(counselor.id)) {
          return res.status(403).json({ message: "Unauthorized: You can only access students assigned to you" });
        }
      }
      
      // Fetch the actual profile entries array for this student
      const profileEntries = await storage.getStudentProfile(student.id);
      res.json(profileEntries || []);
    } catch (error) {
      console.error("Error fetching student profile via by-admin-id:", error);
      res.status(500).json({ message: "Failed to fetch student profile" });
    }
  });

  // Student universities endpoint for frontend compatibility
  app.get('/api/students/by-admin-id/:id/universities', requireAuth, requireRole(['admin', 'counselor']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ message: "Invalid student ID" });
      }
      
      // Get admin ID for scoped lookup
      let adminId = null;
      
      if (userRole === 'admin') {
        adminId = userId;
      } else if (userRole === 'counselor') {
        // Get counselor's admin ID
        const counselor = await storage.getCounselorByUserId(userId);
        adminId = counselor?.adminId;
        
        if (!adminId) {
          return res.status(403).json({ message: "Counselor not associated with an admin" });
        }
      }
      
      if (!adminId) {
        return res.status(403).json({ message: "Unauthorized: Unable to determine admin context" });
      }
      
      const student = await storage.getStudentByAdminStudentId(parseInt(id), adminId);
      
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // Additional authorization for counselors - they can only access their assigned students
      if (userRole === 'counselor') {
        const counselor = await storage.getCounselorByUserId(userId);
        if (!counselor || Number(student.counselorId) !== Number(counselor.id)) {
          return res.status(403).json({ message: "Unauthorized: You can only access students assigned to you" });
        }
      }
      
      const universities = await storage.getStudentUniversities(student.id);
      res.json(universities);
    } catch (error) {
      console.error("Error fetching student universities via by-admin-id:", error);
      res.status(500).json({ message: "Failed to fetch student universities" });
    }
  });

  // Password update endpoint for by-admin-id path
  app.put('/api/students/by-admin-id/:id/password', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;
      const userId = req.session.user.id;
      const adminId = userId;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ message: "Invalid student ID" });
      }
      
      // Get the student using adminStudentId
      const student = await storage.getStudentByAdminStudentId(parseInt(id), adminId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // Hash and update the password
      const hashedPassword = await bcrypt.hash(password, 10);
      await storage.updateUserPassword(student.userId, hashedPassword);
      
      res.json({ message: "Student password updated successfully" });
    } catch (error) {
      console.error("Error updating student password:", error);
      res.status(500).json({ message: "Failed to update student password" });
    }
  });

  app.post('/api/students', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      const data = insertStudentSchema.parse(req.body);
      const student = await storage.createStudent(data);
      res.json(student);
    } catch (error) {
      console.error("Error creating student:", error);
      res.status(500).json({ message: "Failed to create student" });
    }
  });

  app.put('/api/students/:id', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      console.log("Updating student with adminStudentId:", id);
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ message: "Invalid student ID" });
      }
      
      // Get admin ID for scoped lookup - only admins can use this route
      const adminId = userId;
      
      // Find student by adminStudentId within admin scope
      const student = await storage.getStudentByAdminStudentId(parseInt(id), adminId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      const data = insertStudentSchema.partial().parse(req.body);
      const updatedStudent = await storage.updateStudent(student.id, data);
      res.json(updatedStudent);
    } catch (error) {
      console.error("Error updating student:", error);
      res.status(500).json({ message: "Failed to update student" });
    }
  });

  app.patch('/api/students/:id', requireAuth, requireRole(['admin', 'counselor']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { name, email, phoneNumber, counselorId, profileStatus } = req.body;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      console.log("Updating student fields with adminStudentId:", id);
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ message: "Invalid student ID" });
      }
      
      let student = null;
      let adminId = null;
      
      if (userRole === 'admin') {
        // Admin accesses student by adminStudentId within their scope
        adminId = userId;
        student = await storage.getStudentByAdminStudentId(parseInt(id), adminId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }
      } else if (userRole === 'counselor') {
        // Counselor accesses student by adminStudentId within their admin scope and must be assigned
        const counselor = await storage.getCounselorByUserId(userId);
        if (!counselor) {
          return res.status(403).json({ message: "Counselor not found" });
        }
        adminId = counselor.adminId;
        if (!adminId) {
          return res.status(403).json({ message: "Counselor not associated with an admin" });
        }
        student = await storage.getStudentByAdminStudentId(parseInt(id), adminId);
        if (!student || Number(student.counselorId) !== Number(counselor.id)) {
          return res.status(403).json({ message: "Unauthorized: You can only access students assigned to you" });
        }
        
        // Counselors can only update profileStatus
        if (name || email || phoneNumber !== undefined || counselorId !== undefined) {
          return res.status(403).json({ message: "Counselors can only update profile status" });
        }
      }
      
      // Update user fields if provided
      if (name || email || phoneNumber !== undefined) {
        const userUpdates: any = {};
        
        if (name) {
          const nameParts = name.trim().split(' ');
          userUpdates.firstName = nameParts[0] || '';
          userUpdates.lastName = nameParts.slice(1).join(' ') || '';
        }
        
        if (email) {
          userUpdates.email = email;
        }
        
        if (phoneNumber !== undefined) {
          userUpdates.phoneNumber = phoneNumber;
        }
        
        if (Object.keys(userUpdates).length > 0 && student) {
          await storage.upsertUser({ id: student.userId, ...userUpdates });
        }
      }
      
      // Update student fields if provided
      const studentUpdates: any = {};
      
      if (counselorId !== undefined) {
        studentUpdates.counselorId = counselorId === null ? null : parseInt(counselorId);
      }
      
      if (profileStatus !== undefined) {
        studentUpdates.profileStatus = profileStatus;
      }
      
      let updatedStudent = student;
      if (Object.keys(studentUpdates).length > 0 && student) {
        updatedStudent = await storage.updateStudent(student.id, studentUpdates);
      }
      
      // Return the updated student with user info using adminStudentId lookup
      if (!adminId) {
        return res.status(500).json({ message: "Admin ID not found" });
      }
      const finalStudent = await storage.getStudentByAdminStudentId(parseInt(id), adminId);
      res.json(finalStudent);
    } catch (error) {
      console.error("Error updating student:", error);
      res.status(500).json({ message: "Failed to update student" });
    }
  });

  app.delete('/api/students/:id', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user.id;
      
      console.log("Deleting student with adminStudentId:", id);
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ message: "Invalid student ID" });
      }
      
      // Get admin ID for scoped lookup - only admins can use this route
      const adminId = userId;
      
      // Find student by adminStudentId within admin scope
      const student = await storage.getStudentByAdminStudentId(parseInt(id), adminId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // Delete using the serial ID
      await storage.deleteStudent(student.id, req.session.user.id);
      res.json({ message: "Student deleted successfully" });
    } catch (error) {
      console.error("Error deleting student:", error);
      res.status(500).json({ message: "Failed to delete student" });
    }
  });

  // Counselor routes - now admin-scoped
  app.get('/api/counselors', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      // Only admin can access, and they see only their counselors
      const adminId = userRole === 'admin' ? userId : null;
      const counselors = await storage.getCounselors(adminId);
      res.json(counselors);
    } catch (error) {
      console.error("Error fetching counselors:", error);
      res.status(500).json({ message: "Failed to fetch counselors" });
    }
  });

  app.get('/api/counselors/archived', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      // Use cached user from requireAuth middleware instead of database lookup
      const user = req.sessionUser;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Role check is already handled by requireRole middleware
      const archivedCounselors = await storage.getArchivedCounselors(user.id);
      res.json(archivedCounselors);
    } catch (error) {
      console.error("Error fetching archived counselors:", error);
      res.status(500).json({ message: "Failed to fetch archived counselors" });
    }
  });

  app.put('/api/counselors/admin/:adminCounselorId/restore', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      const { adminCounselorId } = req.params;
      // Use cached user from requireAuth middleware instead of database lookup
      const user = req.sessionUser;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!adminCounselorId || isNaN(parseInt(adminCounselorId))) {
        return res.status(400).json({ message: "Invalid admin counselor ID" });
      }

      // Validate request body
      const parseResult = restoreRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: parseResult.error.errors 
        });
      }

      const { email } = parseResult.data;

      // Only admins can restore counselors
      const adminId = user.id;
      
      // Restore the counselor using adminCounselorId, adminId, and provided email
      const restoredCounselor = await storage.restoreCounselor(parseInt(adminCounselorId), adminId, email);
      
      res.json({ 
        message: "Counselor restored successfully with original information", 
        counselor: restoredCounselor 
      });
    } catch (error: any) {
      console.error("Error restoring counselor:", error);
      
      // Handle specific error messages from storage layer
      if (error.message.includes("not found")) {
        return res.status(404).json({ message: error.message });
      }
      if (error.message.includes("not archived")) {
        return res.status(400).json({ message: error.message });
      }
      if (error.message.includes("already in use")) {
        return res.status(409).json({ message: error.message });
      }
      if (error.message.includes("required")) {
        return res.status(400).json({ message: error.message });
      }
      
      res.status(500).json({ message: "Failed to restore counselor" });
    }
  });

  app.get('/api/counselors/:id', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      console.log("Fetching counselor with adminCounselorId:", id);
      
      if (!id || isNaN(parseInt(id))) {
        console.log("Invalid adminCounselorId provided:", id);
        return res.status(400).json({ message: "Invalid counselor ID" });
      }
      
      // Get admin ID for scoped lookup
      let adminId = null;
      
      if (userRole === 'admin') {
        adminId = userId;
      } else {
        return res.status(403).json({ message: "Unauthorized: Only admins can access individual counselor details" });
      }
      
      if (!adminId) {
        return res.status(403).json({ message: "Unauthorized: Unable to determine admin context" });
      }
      
      const counselor = await storage.getCounselorByAdminCounselorId(parseInt(id), adminId);
      console.log("Counselor found:", !!counselor);
      
      if (!counselor) {
        return res.status(404).json({ message: "Counselor not found" });
      }
      
      res.json(counselor);
    } catch (error) {
      console.error("Error fetching counselor:", error);
      res.status(500).json({ message: "Failed to fetch counselor" });
    }
  });

  // Alternative endpoint path for frontend compatibility
  app.get('/api/counselors/by-admin-id/:id', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      console.log("Fetching counselor via by-admin-id with adminCounselorId:", id);
      
      if (!id || isNaN(parseInt(id))) {
        console.log("Invalid adminCounselorId provided:", id);
        return res.status(400).json({ message: "Invalid counselor ID" });
      }
      
      // Get admin ID for scoped lookup
      let adminId = null;
      
      if (userRole === 'admin') {
        adminId = userId;
      } else {
        return res.status(403).json({ message: "Unauthorized: Only admins can access individual counselor details" });
      }
      
      if (!adminId) {
        return res.status(403).json({ message: "Unauthorized: Unable to determine admin context" });
      }
      
      const counselor = await storage.getCounselorByAdminCounselorId(parseInt(id), adminId);
      console.log("Counselor found via by-admin-id:", !!counselor);
      
      if (!counselor) {
        return res.status(404).json({ message: "Counselor not found" });
      }
      
      res.json(counselor);
    } catch (error) {
      console.error("Error fetching counselor via by-admin-id:", error);
      res.status(500).json({ message: "Failed to fetch counselor" });
    }
  });

  app.post('/api/counselors', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      const data = insertCounselorSchema.parse(req.body);
      const counselor = await storage.createCounselor(data);
      res.json(counselor);
    } catch (error) {
      console.error("Error creating counselor:", error);
      res.status(500).json({ message: "Failed to create counselor" });
    }
  });

  app.put('/api/counselors/:id', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const data = insertCounselorSchema.partial().parse(req.body);
      const userId = req.session.user.id;
      
      console.log("Updating counselor with adminCounselorId:", id);
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ message: "Invalid counselor ID" });
      }
      
      // Get admin ID for scoped lookup - only admins can use this route
      const adminId = userId;
      
      // Get the counselor first to find the associated record
      const counselor = await storage.getCounselorByAdminCounselorId(parseInt(id), adminId);
      if (!counselor) {
        return res.status(404).json({ message: "Counselor not found" });
      }
      
      // Update using the serial ID
      const updatedCounselor = await storage.updateCounselor(counselor.id, data);
      res.json(updatedCounselor);
    } catch (error) {
      console.error("Error updating counselor:", error);
      res.status(500).json({ message: "Failed to update counselor" });
    }
  });

  app.patch('/api/counselors/:id', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const data = insertCounselorSchema.partial().parse(req.body);
      const userId = req.session.user.id;
      
      console.log("Updating counselor fields with adminCounselorId:", id);
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ message: "Invalid counselor ID" });
      }
      
      // Filter out undefined and null values, but allow empty strings
      const filteredData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined && value !== null)
      );
      
      if (Object.keys(filteredData).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
      
      // Get admin ID for scoped lookup - only admins can use this route
      const adminId = userId;
      
      // Get the counselor first to find the associated record
      const counselor = await storage.getCounselorByAdminCounselorId(parseInt(id), adminId);
      if (!counselor) {
        return res.status(404).json({ message: "Counselor not found" });
      }
      
      // Update using the serial ID
      const updatedCounselor = await storage.updateCounselor(counselor.id, filteredData);
      res.json(updatedCounselor);
    } catch (error) {
      console.error("Error updating counselor:", error);
      res.status(500).json({ message: "Failed to update counselor" });
    }
  });

  app.delete('/api/counselors/:id', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user.id;
      
      console.log("Deleting counselor with adminCounselorId:", id);
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ message: "Invalid counselor ID" });
      }
      
      // Get admin ID for scoped lookup - only admins can use this route
      const adminId = userId;
      
      // Find counselor by adminCounselorId within admin scope
      const counselor = await storage.getCounselorByAdminCounselorId(parseInt(id), adminId);
      if (!counselor) {
        return res.status(404).json({ message: "Counselor not found" });
      }
      
      // Delete using the serial ID
      await storage.deleteCounselor(counselor.id, req.session.user.id);
      res.json({ message: "Counselor deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting counselor:", error);
      
      // Check if error is about assigned students
      if (error.message && error.message.includes("Cannot delete counselor")) {
        return res.status(409).json({ message: error.message });
      }
      
      res.status(500).json({ message: "Failed to delete counselor" });
    }
  });

  // Counselor self-profile routes - counselors can view and update their own profile
  app.get('/api/counselor/profile', requireAuth, requireRole(['counselor']), async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      
      const counselor = await storage.getCounselorByUserId(userId);
      if (!counselor) {
        return res.status(404).json({ message: "Counselor profile not found" });
      }
      
      res.json(counselor);
    } catch (error) {
      console.error("Error fetching counselor profile:", error);
      res.status(500).json({ message: "Failed to fetch counselor profile" });
    }
  });

  app.put('/api/counselor/profile', requireAuth, requireRole(['counselor']), async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      const { contactEmail, specialization, bio } = req.body;
      
      const counselor = await storage.getCounselorByUserId(userId);
      if (!counselor) {
        return res.status(404).json({ message: "Counselor profile not found" });
      }
      
      const updateData: Partial<Counselor> = {};
      if (contactEmail !== undefined) updateData.contactEmail = contactEmail;
      if (specialization !== undefined) updateData.specialization = specialization;
      if (bio !== undefined) updateData.bio = bio;
      
      const updatedCounselor = await storage.updateCounselor(counselor.id, updateData);
      res.json(updatedCounselor);
    } catch (error) {
      console.error("Error updating counselor profile:", error);
      res.status(500).json({ message: "Failed to update counselor profile" });
    }
  });

  // Profile fields routes - now admin-scoped
  app.get('/api/profile-fields', requireAuth, async (req: any, res) => {
    try {
      const { category } = req.query;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      // Get admin ID for filtering
      let adminId = null;
      if (userRole === 'admin') {
        adminId = userId;
      } else if (userRole === 'counselor') {
        const counselor = await storage.getCounselorByUserId(userId);
        adminId = counselor?.adminId;
      } else if (userRole === 'student') {
        // For students, get the adminId from their user record
        const user = await storage.getUser(userId);
        adminId = user?.adminId;
      }
      
      // Fail-closed security safeguard: Students and counselors must have an adminId
      if ((userRole === 'student' || userRole === 'counselor') && !adminId) {
        console.error(`Security violation: ${userRole} ${userId} has no adminId assigned`);
        return res.status(403).json({ 
          message: "User not properly assigned to an administrator. Please contact support." 
        });
      }
      
      const fields = await storage.getProfileFields(category as string, adminId);
      res.json(fields);
    } catch (error) {
      console.error("Error fetching profile fields:", error);
      res.status(500).json({ message: "Failed to fetch profile fields" });
    }
  });

  app.post('/api/profile-fields', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      const data = insertProfileFieldSchema.parse(req.body);
      const adminId = req.session.user.id;
      
      // Server-side validation for reserved field names
      const RESERVED_FIELD_NAMES = [
        "student_id", "studentid", "id",
        "email", "email_address", "emailaddress", 
        "password", "pwd", "pass",
        "user_id", "userid", "created_at", "updated_at", "deleted_at"
      ];
      
      if (RESERVED_FIELD_NAMES.includes(data.fieldName.toLowerCase())) {
        return res.status(400).json({ 
          message: `Field name '${data.fieldName}' conflicts with system fields. Please choose a different name.` 
        });
      }
      
      // Check for duplicate field names within admin's organization
      const existingFields = await storage.getProfileFields(undefined, adminId);
      const duplicateField = existingFields.find(
        field => field.fieldName.toLowerCase() === data.fieldName.toLowerCase()
      );
      
      if (duplicateField) {
        return res.status(400).json({ 
          message: `A field with the name '${data.fieldName}' already exists. Please choose a different name.` 
        });
      }
      
      // Add adminId to the profile field
      const field = await storage.createProfileField({ ...data, adminId });
      res.json(field);
    } catch (error) {
      console.error("Error creating profile field:", error);
      res.status(500).json({ message: "Failed to create profile field" });
    }
  });

  app.put('/api/profile-fields/:id', requireAuth, requireRole(['admin']), async (req, res) => {
    try {
      const { id } = req.params;
      const data = insertProfileFieldSchema.partial().parse(req.body);
      const field = await storage.updateProfileField(parseInt(id), data);
      res.json(field);
    } catch (error) {
      console.error("Error updating profile field:", error);
      res.status(500).json({ message: "Failed to update profile field" });
    }
  });

  app.delete('/api/profile-fields/:id', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const deletedBy = req.session.user.id;
      await storage.deleteProfileField(parseInt(id), deletedBy);
      res.json({ message: "Profile field archived successfully" });
    } catch (error: any) {
      console.error("Error deleting profile field:", error);
      if (error.message && error.message.startsWith("Cannot delete field")) {
        return res.status(409).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to delete profile field" });
    }
  });

  // Profile field categories routes - admin-scoped
  app.get('/api/profile-field-categories', requireAuth, requireRole(['admin', 'counselor', 'student']), async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      // Get admin ID for filtering
      let adminId = null;
      if (userRole === 'admin') {
        adminId = userId;
      } else if (userRole === 'counselor') {
        const counselor = await storage.getCounselorByUserId(userId);
        adminId = counselor?.adminId;
      } else if (userRole === 'student') {
        // For students, get the adminId from their user record
        const user = await storage.getUser(userId);
        adminId = user?.adminId;
      }
      
      // Fail-closed security safeguard: Students and counselors must have an adminId
      if ((userRole === 'student' || userRole === 'counselor') && !adminId) {
        console.error(`Security violation: ${userRole} ${userId} has no adminId assigned`);
        return res.status(403).json({ 
          message: "User not properly assigned to an administrator. Please contact support." 
        });
      }
      
      const categories = await storage.getProfileFieldCategories(adminId);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching profile field categories:", error);
      res.status(500).json({ message: "Failed to fetch profile field categories" });
    }
  });

  app.post('/api/profile-field-categories', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      const data = insertProfileFieldCategorySchema.parse(req.body);
      const adminId = req.session.user.id;
      
      // Check for duplicate category names within admin's organization
      const existingCategories = await storage.getProfileFieldCategories(adminId);
      const duplicateCategory = existingCategories.find(
        category => category.name.toLowerCase() === data.name.toLowerCase() ||
                   category.value.toLowerCase() === data.value.toLowerCase()
      );
      
      if (duplicateCategory) {
        return res.status(409).json({ 
          message: `A category with the name '${data.name}' or value '${data.value}' already exists. Please choose different names.` 
        });
      }
      
      // Add adminId to the profile field category
      const category = await storage.createProfileFieldCategory({ ...data, adminId } as any);
      res.json(category);
    } catch (error: any) {
      console.error("Error creating profile field category:", error);
      
      // Handle validation errors
      if (error.name === 'ZodError') {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.errors
        });
      }
      
      res.status(500).json({ message: "Failed to create profile field category" });
    }
  });

  app.put('/api/profile-field-categories/:id', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const data = insertProfileFieldCategorySchema.partial().parse(req.body);
      const adminId = req.session.user.id;
      
      // Get existing category to verify ownership
      const existingCategories = await storage.getProfileFieldCategories(adminId);
      const existingCategory = existingCategories.find(cat => cat.id === parseInt(id));
      
      if (!existingCategory) {
        return res.status(404).json({ message: "Profile field category not found or you don't have permission to access it" });
      }
      
      // Check for duplicate names/values if updating them
      if (data.name || data.value) {
        const duplicateCategory = existingCategories.find(
          category => category.id !== parseInt(id) && (
            (data.name && category.name.toLowerCase() === data.name.toLowerCase()) ||
            (data.value && category.value.toLowerCase() === data.value.toLowerCase())
          )
        );
        
        if (duplicateCategory) {
          return res.status(409).json({ 
            message: `A category with the name '${data.name || ''}' or value '${data.value || ''}' already exists. Please choose different names.` 
          });
        }
      }
      
      const category = await storage.updateProfileFieldCategory(parseInt(id), data);
      res.json(category);
    } catch (error: any) {
      console.error("Error updating profile field category:", error);
      
      // Handle validation errors
      if (error.name === 'ZodError') {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.errors
        });
      }
      
      res.status(500).json({ message: "Failed to update profile field category" });
    }
  });

  app.delete('/api/profile-field-categories/:id', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const adminId = req.session.user.id;
      
      // Get existing category to verify ownership
      const existingCategories = await storage.getProfileFieldCategories(adminId);
      const existingCategory = existingCategories.find(cat => cat.id === parseInt(id));
      
      if (!existingCategory) {
        return res.status(404).json({ message: "Profile field category not found or you don't have permission to access it" });
      }
      
      // Prevent deletion of default categories
      if (existingCategory.isDefault) {
        return res.status(400).json({ message: "Cannot delete default profile field categories" });
      }

      const deletedBy = req.session.user.id;
      await storage.deleteProfileFieldCategory(parseInt(id), deletedBy);
      res.json({ message: "Profile field category archived successfully" });
    } catch (error: any) {
      console.error("Error deleting profile field category:", error);
      if (error.message && error.message.startsWith("Cannot archive category")) {
        return res.status(409).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to delete profile field category" });
    }
  });

  app.get('/api/profile-field-categories/archived', requireAuth, requireRole(['admin']), async (req: any, res) => {
    try {
      const adminId = req.session.user.id;
      const archived = await storage.getArchivedProfileFieldCategories(adminId);
      res.json(archived);
    } catch (error) {
      console.error("Error fetching archived profile field categories:", error);
      res.status(500).json({ message: "Failed to fetch archived profile fields" });
    }
  });

  // Student profile routes
  app.get('/api/students/:id/profile', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      let studentId = null;
      
      if (userRole === 'student') {
        // Students access their own profile - use their session to get student info
        const student = await storage.getStudentByUserId(userId);
        if (!student) {
          return res.status(403).json({ message: "Student not found" });
        }
        studentId = student.id;
      } else if (userRole === 'admin') {
        // Admin accesses student by adminStudentId within their scope
        const adminId = userId;
        const student = await storage.getStudentByAdminStudentId(parseInt(id), adminId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }
        studentId = student.id;
      } else if (userRole === 'counselor') {
        // Counselor accesses student by adminStudentId within their admin scope
        const counselor = await storage.getCounselorByUserId(userId);
        const adminId = counselor?.adminId;
        if (!adminId) {
          return res.status(403).json({ message: "Counselor not associated with an admin" });
        }
        const student = await storage.getStudentByAdminStudentId(parseInt(id), adminId);
        if (!student || student.counselorId !== counselor.id) {
          return res.status(403).json({ message: "Unauthorized: You can only access students assigned to you" });
        }
        studentId = student.id;
      }
      
      if (!studentId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const profile = await storage.getStudentProfile(studentId);
      res.json(profile);
    } catch (error) {
      console.error("Error fetching student profile:", error);
      res.status(500).json({ message: "Failed to fetch student profile" });
    }
  });

  app.put('/api/students/:id/profile', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { fieldId, value } = req.body;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      let studentId = null;
      
      if (userRole === 'student') {
        // Students update their own profile - use their session to get student info
        const student = await storage.getStudentByUserId(userId);
        if (!student) {
          return res.status(403).json({ message: "Student not found" });
        }
        
        // Check if field is already confirmed for students
        const existingProfile = await storage.getStudentProfile(student.id);
        const existingField = existingProfile.find(p => p.fieldId === fieldId);
        if (existingField && existingField.isConfirmed) {
          return res.status(400).json({ message: "Field is already confirmed and cannot be edited" });
        }
        studentId = student.id;
      } else if (userRole === 'admin') {
        // Admin updates student profile by adminStudentId within their scope
        const adminId = userId;
        const student = await storage.getStudentByAdminStudentId(parseInt(id), adminId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }
        studentId = student.id;
      } else if (userRole === 'counselor') {
        // Counselor updates student profile by adminStudentId within their admin scope
        const counselor = await storage.getCounselorByUserId(userId);
        const adminId = counselor?.adminId;
        if (!adminId) {
          return res.status(403).json({ message: "Counselor not associated with an admin" });
        }
        const student = await storage.getStudentByAdminStudentId(parseInt(id), adminId);
        if (!student || Number(student.counselorId) !== Number(counselor.id)) {
          return res.status(403).json({ message: "Unauthorized: You can only access students assigned to you" });
        }
        studentId = student.id;
      }
      
      if (!studentId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Validate required fields — reject empty values for required profile fields
      const targetField = await storage.getProfileFieldById(fieldId);
      if (targetField?.isRequired && (!value || !String(value).trim())) {
        return res.status(400).json({ message: `${targetField.fieldLabel || targetField.fieldName} is required` });
      }
      
      const profile = await storage.upsertStudentProfile(studentId, fieldId, value);
      res.json(profile);
    } catch (error) {
      console.error("Error updating student profile:", error);
      res.status(500).json({ message: "Failed to update student profile" });
    }
  });

  // Batch update: save multiple profile fields in one request (used by student section Save button)
  app.put('/api/students/:id/profile/batch', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { fields } = req.body; // [{ fieldId, value }]
      const userId = req.session.user.id;
      const userRole = req.session.user.role;

      if (!Array.isArray(fields) || fields.length === 0) {
        return res.status(400).json({ message: "fields must be a non-empty array" });
      }

      let studentId: number | null = null;

      if (userRole === 'student') {
        const student = await storage.getStudentByUserId(userId);
        if (!student) return res.status(403).json({ message: "Student not found" });
        studentId = student.id;
      } else if (userRole === 'admin') {
        const adminId = userId;
        const student = await storage.getStudentByAdminStudentId(parseInt(id), adminId);
        if (!student) return res.status(404).json({ message: "Student not found" });
        studentId = student.id;
      } else if (userRole === 'counselor') {
        const counselor = await storage.getCounselorByUserId(userId);
        const adminId = counselor?.adminId;
        if (!adminId) return res.status(403).json({ message: "Counselor not associated with an admin" });
        const student = await storage.getStudentByAdminStudentId(parseInt(id), adminId);
        if (!student || Number(student.counselorId) !== Number(counselor.id)) {
          return res.status(403).json({ message: "Unauthorized: You can only access students assigned to you" });
        }
        studentId = student.id;
      }

      if (!studentId) return res.status(403).json({ message: "Unauthorized" });

      // For students: fetch the existing profile once so we can check confirmed fields
      let existingProfile: any[] = [];
      if (userRole === 'student') {
        existingProfile = await storage.getStudentProfile(studentId);
      }

      // Validate all fields before persisting anything (fail-fast before write)
      for (const { fieldId, value } of fields) {
        if (userRole === 'student') {
          const existingField = existingProfile.find((p: any) => p.fieldId === fieldId);
          if (existingField?.isConfirmed) {
            return res.status(400).json({ message: "Field is already confirmed and cannot be edited" });
          }
        }
        const targetField = await storage.getProfileFieldById(fieldId);
        if (targetField?.isRequired && (!value || !String(value).trim())) {
          return res.status(400).json({ message: `${targetField.fieldLabel || targetField.fieldName} is required` });
        }
      }

      // All fields passed validation — persist atomically in a single transaction
      const results = await storage.batchUpsertStudentProfile(studentId, fields);
      res.json(results);
    } catch (error) {
      console.error("Error batch-updating student profile:", error);
      res.status(500).json({ message: "Failed to update student profile" });
    }
  });

  app.put('/api/students/:id/profile/:fieldId/confirm', requireAuth, requireRole(['student']), async (req: any, res) => {
    try {
      const { id, fieldId } = req.params;
      const userId = req.session.user.id;
      
      // Students can only confirm their own profile fields
      const student = await storage.getStudentByUserId(userId);
      if (!student) {
        return res.status(403).json({ message: "Student not found" });
      }
      
      const profile = await storage.confirmStudentProfileField(student.id, parseInt(fieldId));
      res.json(profile);
    } catch (error) {
      console.error("Error confirming profile field:", error);
      res.status(500).json({ message: "Failed to confirm profile field" });
    }
  });

  // University routes - now admin-scoped
  app.get('/api/universities', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      // Get admin ID for filtering
      let adminId = null;
      if (userRole === 'admin') {
        adminId = userId;
      } else if (userRole === 'counselor') {
        const counselor = await storage.getCounselorByUserId(userId);
        adminId = counselor?.adminId;
      } else if (userRole === 'student') {
        // Students should see universities from their admin (traced through their counselor)
        const student = await storage.getStudentByUserId(userId);
        if (student && student.counselorId) {
          const counselor = await storage.getCounselor(student.counselorId);
          adminId = counselor?.adminId;
        } else {
          // Fallback to checking user's adminId directly
          const user = await storage.getUser(userId);
          adminId = user?.adminId;
        }
      }
      
      const universities = await storage.getUniversities(adminId);
      res.json(universities);
    } catch (error) {
      console.error("Error fetching universities:", error);
      res.status(500).json({ message: "Failed to fetch universities" });
    }
  });

  // Get single university by ID
  app.get('/api/universities/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const university = await storage.getUniversity(parseInt(id));
      
      if (!university) {
        return res.status(404).json({ message: "University not found" });
      }
      
      // Check if user has access to this university
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      let adminId = null;
      if (userRole === 'admin') {
        adminId = userId;
      } else if (userRole === 'counselor') {
        const counselor = await storage.getCounselorByUserId(userId);
        adminId = counselor?.adminId;
      } else if (userRole === 'student') {
        const student = await storage.getStudentByUserId(userId);
        if (student && student.counselorId) {
          const counselor = await storage.getCounselor(student.counselorId);
          adminId = counselor?.adminId;
        } else {
          const user = await storage.getUser(userId);
          adminId = user?.adminId;
        }
      }
      
      // Check if user has access to this university
      if (university.adminId !== adminId) {
        return res.status(403).json({ message: "Unauthorized access to university" });
      }
      
      res.json(university);
    } catch (error) {
      console.error("Error fetching university:", error);
      res.status(500).json({ message: "Failed to fetch university" });
    }
  });

  app.post('/api/universities', requireAuth, requireRole(['admin', 'counselor']), async (req: any, res) => {
    try {
      const data = insertUniversitySchema.parse(req.body);
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      // Get admin ID
      let adminId = null;
      if (userRole === 'admin') {
        adminId = userId;
      } else if (userRole === 'counselor') {
        const counselor = await storage.getCounselorByUserId(userId);
        adminId = counselor?.adminId;
      }
      
      const university = await storage.createUniversity({ ...data, adminId });
      
      // If counselor created this university, notify admin
      if (userRole === 'counselor' && adminId) {
        const counselorUser = await storage.getUser(userId);
        const counselorName = counselorUser ? `${counselorUser.firstName} ${counselorUser.lastName}` : 'Counselor';
        await createNotificationForCounselorAction(
          userId,
          adminId,
          'counselor_university_created',
          'Counselor Added University',
          `${counselorName} added a new university: ${university.name}`,
          undefined,
          university.id
        );
      }
      
      res.json(university);
    } catch (error) {
      console.error("Error creating university:", error);
      res.status(500).json({ message: "Failed to create university" });
    }
  });

  app.put('/api/universities/:id', requireAuth, requireRole(['admin', 'counselor']), async (req, res) => {
    try {
      const { id } = req.params;
      const data = insertUniversitySchema.partial().parse(req.body);
      const university = await storage.updateUniversity(parseInt(id), data);
      
      // If counselor updated this university, notify admin
      const userId = (req as any).session.user.id;
      const userRole = (req as any).session.user.role;
      if (userRole === 'counselor') {
        const counselor = await storage.getCounselorByUserId(userId);
        if (counselor?.adminId) {
          const counselorUser = await storage.getUser(userId);
          const counselorName = counselorUser ? `${counselorUser.firstName} ${counselorUser.lastName}` : 'Counselor';
          await createNotificationForCounselorAction(
            userId,
            counselor.adminId,
            'counselor_university_updated',
            'Counselor Updated University',
            `${counselorName} updated university: ${university.name}`,
            undefined,
            university.id
          );
        }
      }
      
      res.json(university);
    } catch (error) {
      console.error("Error updating university:", error);
      res.status(500).json({ message: "Failed to update university" });
    }
  });

  app.delete('/api/universities/:id', requireAuth, requireRole(['admin', 'counselor']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      // Get university details before deletion for notification
      const university = await storage.getUniversity(parseInt(id));
      
      await storage.deleteUniversity(parseInt(id));
      
      // If counselor deleted this university, notify admin
      if (userRole === 'counselor' && university) {
        const counselor = await storage.getCounselorByUserId(userId);
        if (counselor?.adminId) {
          const counselorUser = await storage.getUser(userId);
          const counselorName = counselorUser ? `${counselorUser.firstName} ${counselorUser.lastName}` : 'Counselor';
          await createNotificationForCounselorAction(
            userId,
            counselor.adminId,
            'counselor_university_deleted',
            'Counselor Deleted University',
            `${counselorName} deleted university: ${university.name}`,
            undefined,
            parseInt(id)
          );
        }
      }
      
      res.json({ message: "University deleted successfully" });
    } catch (error) {
      console.error("Error deleting university:", error);
      res.status(500).json({ message: "Failed to delete university" });
    }
  });

  // Student university routes
  app.get('/api/students/:id/universities', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      let studentId = null;
      
      if (userRole === 'student') {
        // Students access their own universities - use their session to get student info
        const student = await storage.getStudentByUserId(userId);
        if (!student) {
          return res.status(403).json({ message: "Student not found" });
        }
        studentId = student.id;
      } else if (userRole === 'admin') {
        // Admin accesses student universities by adminStudentId within their scope
        const adminId = userId;
        const student = await storage.getStudentByAdminStudentId(parseInt(id), adminId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }
        studentId = student.id;
      } else if (userRole === 'counselor') {
        // Counselor accesses student universities by adminStudentId within their admin scope
        const counselor = await storage.getCounselorByUserId(userId);
        const adminId = counselor?.adminId;
        if (!adminId) {
          return res.status(403).json({ message: "Counselor not associated with an admin" });
        }
        const student = await storage.getStudentByAdminStudentId(parseInt(id), adminId);
        if (!student || student.counselorId !== counselor.id) {
          return res.status(403).json({ message: "Unauthorized: You can only access students assigned to you" });
        }
        studentId = student.id;
      }
      
      if (!studentId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const universities = await storage.getStudentUniversities(studentId);
      res.json(universities);
    } catch (error) {
      console.error("Error fetching student universities:", error);
      res.status(500).json({ message: "Failed to fetch student universities" });
    }
  });

  app.post('/api/students/:id/universities', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { universityId, category } = req.body;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      let studentId = null;
      
      if (userRole === 'student') {
        // Students add to their own list - use their session to get student info
        const student = await storage.getStudentByUserId(userId);
        if (!student) {
          return res.status(403).json({ message: "Student not found" });
        }
        studentId = student.id;
      } else if (userRole === 'admin') {
        // Admin adds to student university list by adminStudentId within their scope
        const adminId = userId;
        const student = await storage.getStudentByAdminStudentId(parseInt(id), adminId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }
        studentId = student.id;
      } else if (userRole === 'counselor') {
        // Counselor adds to student university list by adminStudentId within their admin scope
        const counselor = await storage.getCounselorByUserId(userId);
        const adminId = counselor?.adminId;
        if (!adminId) {
          return res.status(403).json({ message: "Counselor not associated with an admin" });
        }
        const student = await storage.getStudentByAdminStudentId(parseInt(id), adminId);
        if (!student || student.counselorId !== counselor.id) {
          return res.status(403).json({ message: "Unauthorized: You can only access students assigned to you" });
        }
        studentId = student.id;
      }
      
      if (!studentId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Validate category
      const validCategories = ['reach', 'target', 'safety'];
      const finalCategory = validCategories.includes(category) ? category : 'target';
      
      await storage.addStudentUniversity(studentId, universityId, finalCategory as "reach" | "target" | "safety");
      res.json({ message: "University added successfully" });
    } catch (error: any) {
      console.error("Error adding student university:", error);
      // Check if it's a duplicate error
      if (error.message === "This university is already in your wishlist") {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to add university" });
      }
    }
  });

  app.put('/api/students/:id/universities/:universityId', requireAuth, async (req: any, res) => {
    try {
      const { id, universityId } = req.params;
      const { category } = req.body;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      let studentId = null;
      
      if (userRole === 'student') {
        // Students update their own list - use their session to get student info
        const student = await storage.getStudentByUserId(userId);
        if (!student) {
          return res.status(403).json({ message: "Student not found" });
        }
        studentId = student.id;
      } else if (userRole === 'admin') {
        // Admin updates student university category by adminStudentId within their scope
        const adminId = userId;
        const student = await storage.getStudentByAdminStudentId(parseInt(id), adminId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }
        studentId = student.id;
      } else if (userRole === 'counselor') {
        // Counselor updates student university category by adminStudentId within their admin scope
        const counselor = await storage.getCounselorByUserId(userId);
        const adminId = counselor?.adminId;
        if (!adminId) {
          return res.status(403).json({ message: "Counselor not associated with an admin" });
        }
        const student = await storage.getStudentByAdminStudentId(parseInt(id), adminId);
        if (!student || student.counselorId !== counselor.id) {
          return res.status(403).json({ message: "Unauthorized: You can only access students assigned to you" });
        }
        studentId = student.id;
      }
      
      if (!studentId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Validate category
      const validCategories = ['reach', 'target', 'safety'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({ message: "Invalid category" });
      }
      
      await storage.updateStudentUniversityCategory(studentId, parseInt(universityId), category as "reach" | "target" | "safety");
      res.json({ message: "University category updated successfully" });
    } catch (error) {
      console.error("Error updating student university category:", error);
      res.status(500).json({ message: "Failed to update university category" });
    }
  });

  app.delete('/api/students/:id/universities/:universityId', requireAuth, async (req: any, res) => {
    try {
      const { id, universityId } = req.params;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      let studentId = null;
      
      if (userRole === 'student') {
        // Students remove from their own list - use their session to get student info
        const student = await storage.getStudentByUserId(userId);
        if (!student) {
          return res.status(403).json({ message: "Student not found" });
        }
        studentId = student.id;
      } else if (userRole === 'admin') {
        // Admin removes from student university list by adminStudentId within their scope
        const adminId = userId;
        const student = await storage.getStudentByAdminStudentId(parseInt(id), adminId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }
        studentId = student.id;
      } else if (userRole === 'counselor') {
        // Counselor removes from student university list by adminStudentId within their admin scope
        const counselor = await storage.getCounselorByUserId(userId);
        const adminId = counselor?.adminId;
        if (!adminId) {
          return res.status(403).json({ message: "Counselor not associated with an admin" });
        }
        const student = await storage.getStudentByAdminStudentId(parseInt(id), adminId);
        if (!student || student.counselorId !== counselor.id) {
          return res.status(403).json({ message: "Unauthorized: You can only access students assigned to you" });
        }
        studentId = student.id;
      }
      
      if (!studentId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      await storage.removeStudentUniversity(studentId, parseInt(universityId));
      res.json({ message: "University removed successfully" });
    } catch (error) {
      console.error("Error removing student university:", error);
      res.status(500).json({ message: "Failed to remove university" });
    }
  });

  // Task routes - now admin-scoped
  app.get('/api/tasks', requireAuth, async (req: any, res) => {
    try {
      const { studentId, counselorId } = req.query;
      const limit = Math.min(parseInt(req.query.limit as string) || 1000, 1000); // Increased default limit to 1000 with max cap
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      // Get admin ID for filtering
      let adminId = null;
      let filterStudentId: number | undefined;
      let filterCounselorId: number | undefined;
      
      if (userRole === 'admin') {
        adminId = userId;
        if (studentId) filterStudentId = parseInt(studentId);
        if (counselorId) filterCounselorId = parseInt(counselorId);
      } else if (userRole === 'counselor') {
        const counselor = await storage.getCounselorByUserId(userId);
        adminId = counselor?.adminId;
        // Counselors only see tasks for their assigned students
        if (counselor) {
          filterCounselorId = counselor.id;
          // Also include admin-created tasks for assigned students by fetching their student IDs
          const assignedStudents = await (storage as any).getStudents(undefined, counselor.id, adminId);
          const assignedStudentIds = new Set(assignedStudents.map((s: any) => s.id));
          const allAdminTasks = await storage.getTasks(undefined, undefined, adminId, limit);
          res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          });
          res.removeHeader('ETag');
          return res.json(allAdminTasks.filter(t => assignedStudentIds.has(t.studentId)));
        }
      } else if (userRole === 'student') {
        const student = await storage.getStudentByUserId(userId);
        filterStudentId = student?.id;
        
        // Set cache-busting headers to ensure fresh data
        res.set({
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        res.removeHeader('ETag');
        
        // For students, we don't filter by admin, just their tasks
        const tasks = await storage.getTasks(filterStudentId, undefined, undefined, limit);
        return res.json(tasks);
      }
      
      // Set cache-busting headers to ensure fresh data
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.removeHeader('ETag');
      
      const tasks = await storage.getTasks(filterStudentId, filterCounselorId, adminId, limit);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.post('/api/tasks', requireAuth, requireRole(['admin', 'counselor']), async (req: any, res) => {
    try {
      const data = insertTaskSchema.parse(req.body);
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      // Get admin ID and counselor ID
      let adminId: string | null = null;
      let counselorId: number | undefined = undefined;
      let counselorData: any = null;
      
      if (userRole === 'admin') {
        adminId = userId;
      } else if (userRole === 'counselor') {
        counselorData = await storage.getCounselorByUserId(userId);
        adminId = counselorData?.adminId || null;
        counselorId = counselorData?.id;
      }

      // Verify the target student belongs to the caller's tenant (and is assigned to counselor)
      const targetStudent = await storage.getStudent(data.studentId);
      if (!targetStudent) {
        return res.status(404).json({ message: "Student not found" });
      }
      if (targetStudent.adminId !== adminId) {
        return res.status(403).json({ message: "Unauthorized: Student does not belong to your tenant" });
      }
      if (userRole === 'counselor' && targetStudent.counselorId !== counselorData?.id) {
        return res.status(403).json({ message: "Unauthorized: Student is not assigned to you" });
      }
      
      const task = await storage.createTask({ ...data, adminId: adminId!, counselorId });
      
      // Respond immediately with the task
      res.json(task);
      
      // Handle notifications and planner events asynchronously after response
      setImmediate(async () => {
        try {
          // Fetch all required data in parallel to avoid redundant calls
          const [studentRecord, studentUser, counselorUser] = await Promise.all([
            storage.getStudent(task.studentId),
            storage.getStudent(task.studentId).then(s => s ? storage.getUser(s.userId) : null),
            userRole === 'counselor' ? storage.getUser(userId) : Promise.resolve(null)
          ]);
          
          if (!studentRecord || !studentUser) {
            console.error('Student not found for task notifications:', task.studentId);
            return;
          }
          
          const studentName = `${studentUser.firstName} ${studentUser.lastName}`;
          
          // Create optimized notifications with pre-fetched data
          await createOptimizedNotificationForTask(
            task.id,
            task.studentId,
            'task_assigned',
            'New Task Assigned',
            `New task assigned to ${studentName}: ${task.title}`,
            studentRecord,
            studentUser
          );
          
          // If counselor created this task, notify admin
          if (userRole === 'counselor' && adminId && counselorUser) {
            const counselorName = `${counselorUser.firstName} ${counselorUser.lastName}`;
            await createNotificationForCounselorAction(
              userId,
              adminId,
              'counselor_task_created',
              'Counselor Created Task',
              `${counselorName} created a task for ${studentName}: ${task.title}`,
              task.studentId,
              task.id
            );
          }
          
          // Create planner event if task has a due date
          if (task.dueDate && studentUser) {
            await storage.createPlannerEvent({
              userId: studentUser.id,
              createdById: userId,
              title: `Task Due: ${task.title}`,
              description: task.description || `Task: ${task.title}`,
              startDate: task.dueDate,
              endDate: null,
              reminderCount: 0,
              reminderInterval: null
            });
          }
        } catch (error) {
          console.error("Error creating task notifications/planner events:", error);
          // Don't fail the request - notifications are supplementary
        }
      });
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  app.put('/api/tasks/:id', requireAuth, requireRole(['admin', 'counselor']), async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).session.user.id;
      const userRole = (req as any).session.user.role;
      const data = insertTaskSchema.partial().parse(req.body);

      // Determine caller's adminId for tenant-scoped lookup
      let callerAdminId: string | null = null;
      let callerCounselor: any = null;
      if (userRole === 'admin') {
        callerAdminId = userId;
      } else if (userRole === 'counselor') {
        callerCounselor = await storage.getCounselorByUserId(userId);
        callerAdminId = callerCounselor?.adminId || null;
      }
      if (!callerAdminId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Get the existing task scoped to caller's tenant
      const allTasks = await storage.getTasks(undefined, undefined, callerAdminId);
      const existingTask = allTasks.find(t => t.id === parseInt(id));
      if (!existingTask) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Counselors may only update tasks for students assigned to them
      if (userRole === 'counselor' && callerCounselor) {
        const taskStudent = await storage.getStudent(existingTask.studentId);
        if (taskStudent?.counselorId !== callerCounselor.id) {
          return res.status(403).json({ message: "Unauthorized: Task belongs to a student not assigned to you" });
        }
      }
      
      const task = await storage.updateTask(parseInt(id), data);
      
      // Handle planner event updates when due date changes
      if (data.dueDate !== undefined) {
        const student = await storage.getStudent(task.studentId);
        if (student) {
          // Find existing planner event for this task
          const allEvents = await storage.getPlannerEvents(student.userId);
          const taskEvent = allEvents.find((event: PlannerEvent) => 
            event.title === `Task Due: ${existingTask.title}` && 
            existingTask.dueDate && 
            event.startDate.getTime() === new Date(existingTask.dueDate).getTime()
          );
          
          if (data.dueDate === null) {
            // If due date is removed, delete the planner event
            if (taskEvent) {
              await storage.deletePlannerEvent(taskEvent.id);
            }
          } else {
            // If due date is added or changed
            if (taskEvent) {
              // Update existing planner event
              await storage.updatePlannerEvent(taskEvent.id, {
                title: `Task Due: ${task.title}`,
                description: task.description || `Task: ${task.title}`,
                startDate: task.dueDate!,
              });
            } else {
              // Create new planner event
              await storage.createPlannerEvent({
                userId: student.userId,
                createdById: userId,
                title: `Task Due: ${task.title}`,
                description: task.description || `Task: ${task.title}`,
                startDate: task.dueDate!,
                endDate: null,
                reminderCount: 0,
                reminderInterval: null
              });
            }
          }
        }
      } else if (data.title !== undefined && existingTask.dueDate) {
        // If only title is updated and task has a due date, update the planner event title
        const student = await storage.getStudent(task.studentId);
        if (student) {
          const allEvents = await storage.getPlannerEvents(student.userId);
          const taskEvent = allEvents.find((event: PlannerEvent) => 
            event.title === `Task Due: ${existingTask.title}` && 
            event.startDate.getTime() === existingTask.dueDate!.getTime()
          );
          
          if (taskEvent) {
            await storage.updatePlannerEvent(taskEvent.id, {
              title: `Task Due: ${task.title}`,
              description: task.description || `Task: ${task.title}`,
            });
          }
        }
      }
      
      // If counselor updated this task, notify admin
      if (userRole === 'counselor') {
        const counselor = await storage.getCounselorByUserId(userId);
        if (counselor?.adminId) {
          const counselorUser = await storage.getUser(userId);
          const counselorName = counselorUser ? `${counselorUser.firstName} ${counselorUser.lastName}` : 'Counselor';
          const student = await storage.getUser((await storage.getStudent(task.studentId))?.userId || '');
          const studentName = student ? `${student.firstName} ${student.lastName}` : 'Student';
          await createNotificationForCounselorAction(
            userId,
            counselor.adminId,
            'counselor_task_updated',
            'Counselor Updated Task',
            `${counselorName} updated a task for ${studentName}: ${task.title}`,
            task.studentId,
            task.id
          );
        }
      }
      
      res.json(task);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.delete('/api/tasks/:id', requireAuth, requireRole(['admin', 'counselor']), async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).session.user.id;
      const userRole = (req as any).session.user.role;

      // Determine caller's adminId for tenant-scoped lookup
      let callerAdminId: string | null = null;
      let callerCounselor: any = null;
      if (userRole === 'admin') {
        callerAdminId = userId;
      } else if (userRole === 'counselor') {
        callerCounselor = await storage.getCounselorByUserId(userId);
        callerAdminId = callerCounselor?.adminId || null;
      }
      if (!callerAdminId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Get the task scoped to caller's tenant
      const allTasks = await storage.getTasks(undefined, undefined, callerAdminId);
      const task = allTasks.find(t => t.id === parseInt(id));
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Counselors may only delete tasks for students assigned to them
      if (userRole === 'counselor' && callerCounselor) {
        const taskStudent = await storage.getStudent(task.studentId);
        if (taskStudent?.counselorId !== callerCounselor.id) {
          return res.status(403).json({ message: "Unauthorized: Task belongs to a student not assigned to you" });
        }
      }
      
      if (task && task.dueDate) {
        const student = await storage.getStudent(task.studentId);
        if (student) {
          // Find and delete the associated planner event
          const allEvents = await storage.getPlannerEvents(student.userId);
          const taskEvent = allEvents.find((event: PlannerEvent) => 
            event.title === `Task Due: ${task.title}` && 
            event.startDate.getTime() === task.dueDate!.getTime()
          );
          
          if (taskEvent) {
            await storage.deletePlannerEvent(taskEvent.id);
          }
        }
      }
      
      // If counselor deleted this task, notify admin
      if (userRole === 'counselor' && task) {
        const counselor = callerCounselor || await storage.getCounselorByUserId(userId);
        if (counselor?.adminId) {
          const counselorUser = await storage.getUser(userId);
          const counselorName = counselorUser ? `${counselorUser.firstName} ${counselorUser.lastName}` : 'Counselor';
          const student = await storage.getUser((await storage.getStudent(task.studentId))?.userId || '');
          const studentName = student ? `${student.firstName} ${student.lastName}` : 'Student';
          await createNotificationForCounselorAction(
            userId,
            counselor.adminId,
            'counselor_task_deleted',
            'Counselor Deleted Task',
            `${counselorName} deleted a task for ${studentName}: ${task.title}`,
            task.studentId,
            task.id
          );
        }
      }
      
      await storage.deleteTask(parseInt(id));
      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // Student-specific task status update route
  app.put('/api/tasks/:id/status', requireAuth, requireRole(['student', 'counselor', 'admin']), async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.session.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const userRole = req.session.user?.role;
      
      if (userRole === 'student') {
        // For students, verify the task belongs to them
        const student = await storage.getStudentByUserId(userId);
        if (!student) {
          return res.status(404).json({ message: "Student profile not found" });
        }

        const task = await storage.getTasks(student.id);
        const targetTask = task.find(t => t.id === parseInt(id));
        
        if (!targetTask) {
          return res.status(404).json({ message: "Task not found or not assigned to you" });
        }
      } else if (userRole === 'counselor' || userRole === 'admin') {
        // For counselors/admins, get user's adminId to check if task belongs to their students
        const user = await storage.getUser(userId);
        const adminId = userRole === 'admin' ? user?.adminId : (await storage.getCounselorByUserId(userId))?.adminId;
        
        if (!adminId) {
          return res.status(403).json({ message: "Access denied" });
        }

        // Get all tasks for this admin and verify the target task exists
        const allTasks = await storage.getTasks(undefined, undefined, adminId);
        const targetTask = allTasks.find(t => t.id === parseInt(id));
        
        if (!targetTask) {
          return res.status(404).json({ message: "Task not found" });
        }
      }

      // Update only the status field
      const updatedTask = await storage.updateTask(parseInt(id), { status });
      
      // Create notification if task is completed
      if (status === 'complete') {
        const taskStudent = await storage.getStudent(updatedTask.studentId);
        const studentUser = await storage.getUser(taskStudent?.userId || '');
        const studentName = studentUser ? `${studentUser.firstName} ${studentUser.lastName}` : 'Student';
        await createNotificationForTask(
          updatedTask.id,
          updatedTask.studentId,
          'task_completed',
          'Task Completed',
          `${studentName} completed task: ${updatedTask.title}`
        );
      }
      
      res.json(updatedTask);
    } catch (error) {
      console.error("Error updating task status:", error);
      res.status(500).json({ message: "Failed to update task status" });
    }
  });

  // Activity routes
  app.get('/api/students/:id/activities', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      const targetStudent = await storage.getStudent(parseInt(id));
      if (!targetStudent) {
        return res.status(404).json({ message: "Student not found" });
      }

      if (userRole === 'student') {
        const student = await storage.getStudentByUserId(userId);
        if (!student || student.id !== targetStudent.id) {
          return res.status(403).json({ message: "Unauthorized" });
        }
      } else if (userRole === 'admin') {
        if (targetStudent.adminId !== userId) {
          return res.status(403).json({ message: "Unauthorized: Student does not belong to your tenant" });
        }
      } else if (userRole === 'counselor') {
        const counselor = await storage.getCounselorByUserId(userId);
        if (!counselor || targetStudent.adminId !== counselor.adminId || targetStudent.counselorId !== counselor.id) {
          return res.status(403).json({ message: "Unauthorized: Student is not assigned to you" });
        }
      } else {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const activities = await storage.getActivities(targetStudent.id);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });



  // Planner routes
  app.get('/api/planner', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      const events = await storage.getPlannerEvents(userId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching planner events:", error);
      res.status(500).json({ message: "Failed to fetch planner events" });
    }
  });

  app.post('/api/planner', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      const data = insertPlannerEventSchema.parse({ ...req.body, userId });
      const event = await storage.createPlannerEvent({ ...data, createdById: userId });
      res.json(event);
    } catch (error) {
      console.error("Error creating planner event:", error);
      res.status(500).json({ message: "Failed to create planner event" });
    }
  });

  app.put('/api/planner/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      // Get the specific event to check authorization
      const event = await storage.getPlannerEvent(parseInt(id));
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      const isCreator = event.createdById === userId;
      if (!isCreator) {
        // Non-creators must have scoped access to the event's owning user
        if (userRole === 'admin') {
          const eventUser = await storage.getUser(event.userId);
          if (!eventUser || eventUser.adminId !== userId) {
            return res.status(403).json({ message: "Unauthorized - event belongs to another tenant" });
          }
        } else if (userRole === 'counselor') {
          const counselor = await storage.getCounselorByUserId(userId);
          const eventStudent = await storage.getStudentByUserId(event.userId);
          if (!counselor || !eventStudent || eventStudent.counselorId !== counselor.id) {
            return res.status(403).json({ message: "Unauthorized - event belongs to a student not assigned to you" });
          }
        } else {
          return res.status(403).json({ message: "Unauthorized - you can only modify events you created" });
        }
      }
      
      const data = insertPlannerEventSchema.partial().parse(req.body);
      const updatedEvent = await storage.updatePlannerEvent(parseInt(id), data);
      res.json(updatedEvent);
    } catch (error) {
      console.error("Error updating planner event:", error);
      res.status(500).json({ message: "Failed to update planner event" });
    }
  });

  app.delete('/api/planner/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      // Get the specific event to check authorization
      const event = await storage.getPlannerEvent(parseInt(id));
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      const isCreator = event.createdById === userId;
      if (!isCreator) {
        // Non-creators must have scoped access to the event's owning user
        if (userRole === 'admin') {
          const eventUser = await storage.getUser(event.userId);
          if (!eventUser || eventUser.adminId !== userId) {
            return res.status(403).json({ message: "Unauthorized - event belongs to another tenant" });
          }
        } else if (userRole === 'counselor') {
          const counselor = await storage.getCounselorByUserId(userId);
          const eventStudent = await storage.getStudentByUserId(event.userId);
          if (!counselor || !eventStudent || eventStudent.counselorId !== counselor.id) {
            return res.status(403).json({ message: "Unauthorized - event belongs to a student not assigned to you" });
          }
        } else {
          return res.status(403).json({ message: "Unauthorized - you can only delete events you created" });
        }
      }
      
      await storage.deletePlannerEvent(parseInt(id));
      res.json({ message: "Planner event deleted successfully" });
    } catch (error) {
      console.error("Error deleting planner event:", error);
      res.status(500).json({ message: "Failed to delete planner event" });
    }
  });

  // Student planner management for admins and counselors
  app.get('/api/students/:studentId/planner', requireAuth, requireRole(['admin', 'counselor']), async (req: any, res) => {
    try {
      const { studentId } = req.params;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      console.log("Fetching planner events for adminStudentId:", studentId);
      
      if (!studentId || isNaN(parseInt(studentId))) {
        return res.status(400).json({ message: "Invalid student ID" });
      }
      
      // Get admin ID for scoped lookup
      let adminId = null;
      
      if (userRole === 'admin') {
        adminId = userId;
      } else if (userRole === 'counselor') {
        // Get counselor's admin ID
        const counselor = await storage.getCounselorByUserId(userId);
        adminId = counselor?.adminId;
        
        if (!adminId) {
          return res.status(403).json({ message: "Counselor not associated with an admin" });
        }
      }
      
      if (!adminId) {
        return res.status(403).json({ message: "Unauthorized: Unable to determine admin context" });
      }
      
      // Get the student by adminStudentId within admin scope
      const student = await storage.getStudentByAdminStudentId(parseInt(studentId), adminId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // Additional authorization for counselors - they can only access their assigned students
      if (userRole === 'counselor') {
        const counselor = await storage.getCounselorByUserId(userId);
        if (!counselor || Number(student.counselorId) !== Number(counselor.id)) {
          return res.status(403).json({ message: "Unauthorized: You can only access students assigned to you" });
        }
      }
      
      const events = await storage.getStudentPlannerEvents(student.userId, adminId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching student planner events:", error);
      res.status(500).json({ message: "Failed to fetch student planner events" });
    }
  });

  app.post('/api/students/:studentId/planner', requireAuth, requireRole(['admin', 'counselor']), async (req: any, res) => {
    try {
      const { studentId } = req.params;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      console.log("Creating planner event for adminStudentId:", studentId);
      
      if (!studentId || isNaN(parseInt(studentId))) {
        return res.status(400).json({ message: "Invalid student ID" });
      }
      
      // Get admin ID for scoped lookup
      let adminId = null;
      
      if (userRole === 'admin') {
        adminId = userId;
      } else if (userRole === 'counselor') {
        // Get counselor's admin ID
        const counselor = await storage.getCounselorByUserId(userId);
        adminId = counselor?.adminId;
        
        if (!adminId) {
          return res.status(403).json({ message: "Counselor not associated with an admin" });
        }
      }
      
      if (!adminId) {
        return res.status(403).json({ message: "Unauthorized: Unable to determine admin context" });
      }
      
      // Get the student by adminStudentId within admin scope
      const student = await storage.getStudentByAdminStudentId(parseInt(studentId), adminId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // Additional authorization for counselors - they can only access their assigned students
      if (userRole === 'counselor') {
        const counselor = await storage.getCounselorByUserId(userId);
        if (!counselor || Number(student.counselorId) !== Number(counselor.id)) {
          return res.status(403).json({ message: "Unauthorized: You can only access students assigned to you" });
        }
      }
      
      const data = insertPlannerEventSchema.parse({ ...req.body, userId: student.userId });
      
      const event = await storage.createStudentPlannerEvent({ ...data, createdById: userId }, adminId);
      
      // If counselor created this planner event, notify admin
      if (userRole === 'counselor' && adminId) {
        const counselorUser = await storage.getUser(userId);
        const counselorName = counselorUser ? `${counselorUser.firstName} ${counselorUser.lastName}` : 'Counselor';
        const studentUser = await storage.getUser(student.userId);
        const studentName = studentUser ? `${studentUser.firstName} ${studentUser.lastName}` : 'Student';
        await createNotificationForCounselorAction(
          userId,
          adminId,
          'counselor_planner_event_created',
          'Counselor Created Planner Event',
          `${counselorName} created a planner event for ${studentName}: ${event.title}`,
          student.id,
          event.id
        );
      }
      
      res.json(event);
    } catch (error) {
      console.error("Error creating student planner event:", error);
      res.status(500).json({ message: "Failed to create student planner event" });
    }
  });

  // Delete student planner event
  app.delete('/api/students/:studentId/planner/:eventId', requireAuth, requireRole(['admin', 'counselor']), async (req: any, res) => {
    try {
      const { studentId, eventId } = req.params;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      console.log("Deleting planner event for adminStudentId:", studentId, "eventId:", eventId);
      
      if (!studentId || isNaN(parseInt(studentId))) {
        return res.status(400).json({ message: "Invalid student ID" });
      }
      
      if (!eventId || isNaN(parseInt(eventId))) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      // Get admin ID for scoped lookup
      let adminId = null;
      
      if (userRole === 'admin') {
        adminId = userId;
      } else if (userRole === 'counselor') {
        // Get counselor's admin ID
        const counselor = await storage.getCounselorByUserId(userId);
        adminId = counselor?.adminId;
        
        if (!adminId) {
          return res.status(403).json({ message: "Counselor not associated with an admin" });
        }
      }
      
      if (!adminId) {
        return res.status(403).json({ message: "Unauthorized: Unable to determine admin context" });
      }
      
      // Get the student by adminStudentId within admin scope
      const student = await storage.getStudentByAdminStudentId(parseInt(studentId), adminId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // Additional authorization for counselors - they can only access their assigned students
      if (userRole === 'counselor') {
        const counselor = await storage.getCounselorByUserId(userId);
        if (!counselor || Number(student.counselorId) !== Number(counselor.id)) {
          return res.status(403).json({ message: "Unauthorized: You can only access students assigned to you" });
        }
      }
      
      // Check if the event exists and belongs to this student
      const eventExists = await storage.getPlannerEvents(student.userId);
      const eventToDelete = eventExists.find(e => e.id === parseInt(eventId));
      
      if (!eventToDelete) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // If counselor deleted this planner event, notify admin
      if (userRole === 'counselor' && adminId) {
        const counselorUser = await storage.getUser(userId);
        const counselorName = counselorUser ? `${counselorUser.firstName} ${counselorUser.lastName}` : 'Counselor';
        const studentUser = await storage.getUser(student.userId);
        const studentName = studentUser ? `${studentUser.firstName} ${studentUser.lastName}` : 'Student';
        await createNotificationForCounselorAction(
          userId,
          adminId,
          'counselor_planner_event_deleted',
          'Counselor Deleted Planner Event',
          `${counselorName} deleted a planner event for ${studentName}: ${eventToDelete.title}`,
          student.id,
          parseInt(eventId)
        );
      }
      
      await storage.deletePlannerEvent(parseInt(eventId));
      res.json({ message: "Planner event deleted successfully" });
    } catch (error) {
      console.error("Error deleting student planner event:", error);
      res.status(500).json({ message: "Failed to delete student planner event" });
    }
  });

  // Activity routes
  app.get('/api/activities/:studentId', requireAuth, async (req: any, res) => {
    try {
      const { studentId } = req.params;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      console.log("Fetching activities for adminStudentId:", studentId);
      
      let studentIdToUse = null;
      
      if (userRole === 'student') {
        // Students access their own activities - use their session to get student info
        const student = await storage.getStudentByUserId(userId);
        if (!student) {
          return res.status(403).json({ message: "Student not found" });
        }
        studentIdToUse = student.id;
      } else if (userRole === 'admin') {
        // Admin accesses student activities by adminStudentId within their scope
        if (!studentId || isNaN(parseInt(studentId))) {
          return res.status(400).json({ message: "Invalid student ID" });
        }
        const adminId = userId;
        const student = await storage.getStudentByAdminStudentId(parseInt(studentId), adminId);
        if (!student) {
          return res.status(404).json({ message: "Student not found" });
        }
        studentIdToUse = student.id;
      } else if (userRole === 'counselor') {
        // Counselor accesses student activities by adminStudentId within their admin scope
        if (!studentId || isNaN(parseInt(studentId))) {
          return res.status(400).json({ message: "Invalid student ID" });
        }
        const counselor = await storage.getCounselorByUserId(userId);
        const adminId = counselor?.adminId;
        if (!adminId) {
          return res.status(403).json({ message: "Counselor not associated with an admin" });
        }
        const student = await storage.getStudentByAdminStudentId(parseInt(studentId), adminId);
        if (!student || student.counselorId !== counselor.id) {
          return res.status(403).json({ message: "Unauthorized: You can only access students assigned to you" });
        }
        studentIdToUse = student.id;
      }
      
      if (!studentIdToUse) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const activities = await storage.getActivities(studentIdToUse);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  app.post('/api/activities', requireAuth, async (req: any, res) => {
    try {
      console.log("=== Activity creation endpoint hit ===");
      console.log("Session:", req.session);
      console.log("User from session:", req.session?.user);
      
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      console.log("Activity creation request:", { userId, userRole, body: req.body });
      
      // For students, auto-assign their studentId
      let requestData = { ...req.body };
      if (userRole === 'student') {
        const student = await storage.getStudentByUserId(userId);
        console.log("Found student:", student);
        if (!student) {
          return res.status(403).json({ message: "Student not found" });
        }
        requestData.studentId = student.id;
      }
      
      console.log("Request data before validation:", requestData);
      
      // Ensure studentId is present for validation
      if (!requestData.studentId) {
        return res.status(400).json({ message: "Student ID is required" });
      }
      
      const data = insertActivitySchema.parse(requestData);
      console.log("Parsed data:", data);

      // For admin/counselor, verify target student belongs to their tenant
      if (userRole === 'admin' || userRole === 'counselor') {
        const targetStudent = await storage.getStudent(data.studentId);
        if (!targetStudent) {
          return res.status(404).json({ message: "Student not found" });
        }
        if (userRole === 'admin' && targetStudent.adminId !== userId) {
          return res.status(403).json({ message: "Unauthorized: Student does not belong to your tenant" });
        }
        if (userRole === 'counselor') {
          const counselor = await storage.getCounselorByUserId(userId);
          if (!counselor || targetStudent.adminId !== counselor.adminId || targetStudent.counselorId !== counselor.id) {
            return res.status(403).json({ message: "Unauthorized: Student is not assigned to you" });
          }
        }
      }
      
      const activity = await storage.createActivity(data);
      
      // Create notification for counselors and admins
      const student = await storage.getUser(activity.studentId ? (await storage.getStudent(activity.studentId))?.userId || '' : '');
      const studentName = student ? `${student.firstName} ${student.lastName}` : 'Student';
      await createNotificationForActivity(
        activity.id,
        activity.studentId,
        'activity_created',
        'New Activity Created',
        `${studentName} created a new ${activity.type}: ${activity.title}`
      );
      
      res.json(activity);
    } catch (error) {
      console.error("Error creating activity:", error);
      res.status(500).json({ message: "Failed to create activity" });
    }
  });

  app.put('/api/activities/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      const data = insertActivitySchema.partial().parse(req.body);

      // Load the activity to verify ownership/tenant
      const existingActivity = await storage.getActivity(parseInt(id));
      if (!existingActivity) {
        return res.status(404).json({ message: "Activity not found" });
      }

      if (userRole === 'student') {
        const student = await storage.getStudentByUserId(userId);
        if (!student || existingActivity.studentId !== student.id) {
          return res.status(403).json({ message: "Unauthorized" });
        }
      } else if (userRole === 'admin') {
        const targetStudent = await storage.getStudent(existingActivity.studentId);
        if (!targetStudent || targetStudent.adminId !== userId) {
          return res.status(403).json({ message: "Unauthorized: Activity does not belong to your tenant" });
        }
      } else if (userRole === 'counselor') {
        const counselor = await storage.getCounselorByUserId(userId);
        const targetStudent = await storage.getStudent(existingActivity.studentId);
        if (!counselor || !targetStudent || targetStudent.adminId !== counselor.adminId || targetStudent.counselorId !== counselor.id) {
          return res.status(403).json({ message: "Unauthorized: Activity belongs to a student not assigned to you" });
        }
      }
      
      const activity = await storage.updateActivity(parseInt(id), data);
      
      // Create notification for activity updates
      if (activity.studentId) {
        const student = await storage.getUser((await storage.getStudent(activity.studentId))?.userId || '');
        const studentName = student ? `${student.firstName} ${student.lastName}` : 'Student';
        
        // Check if status was updated to completed
        if (data.status === 'completed') {
          await createNotificationForActivity(
            activity.id,
            activity.studentId,
            'activity_completed',
            'Activity Completed',
            `${studentName} completed ${activity.type}: ${activity.title}`
          );
        } else {
          await createNotificationForActivity(
            activity.id,
            activity.studentId,
            'activity_updated',
            'Activity Updated',
            `${studentName} updated ${activity.type}: ${activity.title}`
          );
        }
      }
      
      res.json(activity);
    } catch (error) {
      console.error("Error updating activity:", error);
      res.status(500).json({ message: "Failed to update activity" });
    }
  });

  app.delete('/api/activities/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;

      // Load the activity to verify ownership/tenant
      const existingActivity = await storage.getActivity(parseInt(id));
      if (!existingActivity) {
        return res.status(404).json({ message: "Activity not found" });
      }

      if (userRole === 'student') {
        const student = await storage.getStudentByUserId(userId);
        if (!student || existingActivity.studentId !== student.id) {
          return res.status(403).json({ message: "Unauthorized" });
        }
      } else if (userRole === 'admin') {
        const targetStudent = await storage.getStudent(existingActivity.studentId);
        if (!targetStudent || targetStudent.adminId !== userId) {
          return res.status(403).json({ message: "Unauthorized: Activity does not belong to your tenant" });
        }
      } else if (userRole === 'counselor') {
        const counselor = await storage.getCounselorByUserId(userId);
        const targetStudent = await storage.getStudent(existingActivity.studentId);
        if (!counselor || !targetStudent || targetStudent.adminId !== counselor.adminId || targetStudent.counselorId !== counselor.id) {
          return res.status(403).json({ message: "Unauthorized: Activity belongs to a student not assigned to you" });
        }
      }
      
      await storage.deleteActivity(parseInt(id));
      res.json({ message: "Activity deleted successfully" });
    } catch (error) {
      console.error("Error deleting activity:", error);
      res.status(500).json({ message: "Failed to delete activity" });
    }
  });

  // Activity feedback routes
  app.get('/api/activity-feedback/:activityId', requireAuth, async (req: any, res) => {
    try {
      const { activityId } = req.params;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;

      // Verify caller can access the activity before returning feedback
      const activity = await storage.getActivity(parseInt(activityId));
      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }
      const activityStudent = await storage.getStudent(activity.studentId);
      if (!activityStudent) {
        return res.status(404).json({ message: "Student not found" });
      }

      if (userRole === 'student') {
        const student = await storage.getStudentByUserId(userId);
        if (!student || student.id !== activityStudent.id) {
          return res.status(403).json({ message: "Unauthorized" });
        }
      } else if (userRole === 'admin') {
        if (activityStudent.adminId !== userId) {
          return res.status(403).json({ message: "Unauthorized: Activity does not belong to your tenant" });
        }
      } else if (userRole === 'counselor') {
        const counselor = await storage.getCounselorByUserId(userId);
        if (!counselor || activityStudent.adminId !== counselor.adminId || activityStudent.counselorId !== counselor.id) {
          return res.status(403).json({ message: "Unauthorized: Activity belongs to a student not assigned to you" });
        }
      } else {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const feedback = await storage.getActivityFeedback(parseInt(activityId));
      res.json(feedback);
    } catch (error) {
      console.error("Error fetching activity feedback:", error);
      res.status(500).json({ message: "Failed to fetch activity feedback" });
    }
  });

  app.post('/api/activity-feedback', requireAuth, requireRole(['admin', 'counselor']), async (req: any, res) => {
    try {
      const { activityId, feedback } = req.body;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;

      // Verify the activity belongs to the caller's tenant
      const activity = await storage.getActivity(parseInt(activityId));
      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }
      const activityStudent = await storage.getStudent(activity.studentId);
      if (!activityStudent) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      let counselorId: number;
      if (userRole === 'counselor') {
        const counselor = await storage.getCounselorByUserId(userId);
        if (!counselor) {
          return res.status(403).json({ message: "Counselor not found" });
        }
        if (activityStudent.adminId !== counselor.adminId || activityStudent.counselorId !== counselor.id) {
          return res.status(403).json({ message: "Unauthorized: Activity belongs to a student not assigned to you" });
        }
        counselorId = counselor.id;
      } else {
        // Admin can provide feedback for their own tenant's students only
        const adminId = req.session.user.id;
        if (activityStudent.adminId !== adminId) {
          return res.status(403).json({ message: "Unauthorized: Activity does not belong to your tenant" });
        }
        const counselors = await storage.getCounselors(adminId);
        if (counselors.length === 0) {
          return res.status(400).json({ message: "No counselors available" });
        }
        counselorId = counselors[0].id;
      }
      
      const activityFeedback = await storage.createActivityFeedback(activityId, counselorId, feedback);
      
      // Send response immediately for better performance
      res.json(activityFeedback);
      
      // Handle notification asynchronously after response is sent
      if (userRole === 'counselor') {
        // Use setImmediate to handle notification after response is sent
        setImmediate(async () => {
          try {
            const counselor = await storage.getCounselor(counselorId);
            if (counselor?.adminId) {
              const counselorUser = await storage.getUser(userId);
              const counselorName = counselorUser ? `${counselorUser.firstName} ${counselorUser.lastName}` : 'Counselor';
              await createNotificationForCounselorAction(
                userId,
                counselor.adminId,
                'counselor_feedback_provided',
                'Counselor Provided Feedback',
                `${counselorName} provided feedback on a student activity`,
                undefined,
                activityId
              );
            }
          } catch (notifError) {
            console.error("Error creating notification for counselor feedback:", notifError);
            // Don't throw - notification failure shouldn't affect the main operation
          }
        });
      }
    } catch (error) {
      console.error("Error creating activity feedback:", error);
      res.status(500).json({ message: "Failed to create activity feedback" });
    }
  });

  // Document routes
  app.get('/api/documents/:studentId', requireAuth, async (req: any, res) => {
    console.log(`🚀 [ROUTE] GET /api/documents/${req.params.studentId} - Starting request`);
    const routeStartTime = Date.now();
    try {
      const { studentId } = req.params;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      console.log(`🚀 [ROUTE] User: ${userId}, Role: ${userRole}, Student: ${studentId}`);
      
      // Check permissions — enforce tenant and assignment scoping for all roles
      if (userRole === 'student') {
        const student = await storage.getStudentByUserId(userId);
        if (!student || student.id !== parseInt(studentId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (userRole === 'counselor') {
        const counselor = await storage.getCounselorByUserId(userId);
        if (!counselor) {
          return res.status(403).json({ message: "Access denied" });
        }
        const student = await storage.getStudent(parseInt(studentId));
        if (!student || Number(student.counselorId) !== Number(counselor.id)) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (userRole === 'admin') {
        const student = await storage.getStudent(parseInt(studentId));
        if (!student || student.adminId !== userId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      // Students see all their documents (both public and private)
      // Counselors should only see public documents (isPublic = true)
      // Admins can see all documents
      const visibleToCounselorOnly = userRole === 'counselor'; // True for counselors to only show public documents
      
      console.log(`🚀 [ROUTE] Calling storage.getDocuments...`);
      const storageStartTime = Date.now();
      const documents = await storage.getDocuments(parseInt(studentId), undefined, visibleToCounselorOnly);
      const storageTime = Date.now() - storageStartTime;
      
      const totalTime = Date.now() - routeStartTime;
      console.log(`🚀 [ROUTE] Completed in ${totalTime}ms (storage: ${storageTime}ms), returning ${documents.length} documents`);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.post('/api/documents/upload', requireAuth, upload.single('file'), async (req: any, res) => {
    try {
      const { title, description, documentType, studentId, isPublic } = req.body;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Validate studentId and permissions
      let targetStudentId = parseInt(studentId);
      let counselorId: number | null = null;
      
      if (userRole === 'student') {
        const student = await storage.getStudentByUserId(userId);
        if (!student) {
          return res.status(403).json({ message: "Student not found" });
        }
        targetStudentId = student.id;
      } else if (userRole === 'counselor') {
        const counselor = await storage.getCounselorByUserId(userId);
        if (!counselor) {
          return res.status(403).json({ message: "Counselor not found" });
        }
        counselorId = counselor.id;
        // Verify the target student is assigned to this counselor
        const targetStudent = await storage.getStudent(targetStudentId);
        if (!targetStudent || Number(targetStudent.counselorId) !== Number(counselor.id)) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (userRole === 'admin') {
        // Verify the target student belongs to this admin's tenant
        const targetStudent = await storage.getStudent(targetStudentId);
        if (!targetStudent || targetStudent.adminId !== userId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      const documentData = {
        studentId: targetStudentId,
        counselorId,
        title: title || req.file.originalname,
        description: description || '',
        fileName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        documentType,
        uploadedBy: userRole,
        isPublic: isPublic === 'true' || isPublic === true
      };
      
      const newDocument = await storage.createDocument(documentData);
      
      // Create notification for document upload (only when student uploads)
      if (userRole === 'student') {
        const studentUser = await storage.getUser(userId);
        const studentName = studentUser ? `${studentUser.firstName} ${studentUser.lastName}` : 'Student';
        await createNotificationForDocument(
          newDocument.id,
          targetStudentId,
          'New Document Uploaded',
          `${studentName} uploaded a new document: ${newDocument.title}`
        );
      }
      
      res.json(newDocument);
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  app.get('/api/documents/download/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      const document = await storage.getDocument(parseInt(id));
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Check permissions — enforce tenant and assignment scoping for all roles
      if (userRole === 'student') {
        const student = await storage.getStudentByUserId(userId);
        if (!student || student.id !== document.studentId) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (userRole === 'counselor') {
        const counselor = await storage.getCounselorByUserId(userId);
        if (!counselor) {
          return res.status(403).json({ message: "Access denied" });
        }
        const student = await storage.getStudent(document.studentId);
        if (!student || Number(student.counselorId) !== Number(counselor.id)) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (userRole === 'admin') {
        const student = await storage.getStudent(document.studentId);
        if (!student || student.adminId !== userId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      if (!fs.existsSync(document.filePath)) {
        return res.status(404).json({ message: "File not found on server" });
      }
      
      res.download(document.filePath, document.fileName);
    } catch (error) {
      console.error("Error downloading document:", error);
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  app.put('/api/documents/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { title, description, documentType, isPublic } = req.body;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      const document = await storage.getDocument(parseInt(id));
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Check permissions - only uploader or admin can edit
      if (userRole === 'student') {
        const student = await storage.getStudentByUserId(userId);
        if (!student || student.id !== document.studentId || document.uploadedBy !== 'student') {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (userRole === 'counselor') {
        const counselor = await storage.getCounselorByUserId(userId);
        if (!counselor) {
          return res.status(403).json({ message: "Access denied" });
        }
        const student = await storage.getStudent(document.studentId);
        // Counselor may edit only if: (a) they own the document (counselorId matches) AND
        // (b) the student belongs to them. Both conditions are required to prevent cross-tenant edits.
        const isOwnerOfDocument = document.uploadedBy === 'counselor' && Number(document.counselorId) === Number(counselor.id);
        const isAssignedStudent = student && Number(student.counselorId) === Number(counselor.id);
        if (!isOwnerOfDocument && !isAssignedStudent) {
          return res.status(403).json({ message: "Access denied" });
        }
        // Even if the counselor owns the document, the student must still belong to them
        if (!isAssignedStudent) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (userRole === 'admin') {
        const student = await storage.getStudent(document.studentId);
        if (!student || student.adminId !== userId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      const updatedDocument = await storage.updateDocument(parseInt(id), {
        title,
        description,
        documentType,
        isPublic
      });
      
      res.json(updatedDocument);
    } catch (error) {
      console.error("Error updating document:", error);
      res.status(500).json({ message: "Failed to update document" });
    }
  });

  app.delete('/api/documents/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user.id;
      const userRole = req.session.user.role;
      
      const document = await storage.getDocument(parseInt(id));
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Check permissions - only uploader or admin can delete
      if (userRole === 'student') {
        const student = await storage.getStudentByUserId(userId);
        if (!student || student.id !== document.studentId || document.uploadedBy !== 'student') {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (userRole === 'counselor') {
        const counselor = await storage.getCounselorByUserId(userId);
        if (!counselor) {
          return res.status(403).json({ message: "Access denied" });
        }
        const student = await storage.getStudent(document.studentId);
        // Counselor may delete only if the student is assigned to them (tenant scope).
        // Additionally, for counselor-uploaded documents, they must be the uploader (counselorId matches).
        const isAssignedStudent = student && Number(student.counselorId) === Number(counselor.id);
        if (!isAssignedStudent) {
          return res.status(403).json({ message: "Access denied" });
        }
        if (document.uploadedBy === 'counselor' && Number(document.counselorId) !== Number(counselor.id)) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (userRole === 'admin') {
        const student = await storage.getStudent(document.studentId);
        if (!student || student.adminId !== userId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      // Delete file from filesystem
      if (fs.existsSync(document.filePath)) {
        fs.unlinkSync(document.filePath);
      }
      
      await storage.deleteDocument(parseInt(id));
      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Developer API endpoints
  app.get('/api/developer/admins', requireAuth, requireRole(['developer']), async (req: any, res) => {
    try {
      const admins = await storage.getAllAdmins();
      res.json(admins);
    } catch (error) {
      console.error("Error fetching admins:", error);
      res.status(500).json({ message: "Failed to fetch admins" });
    }
  });

  app.get('/api/developer/deleted-admins', requireAuth, requireRole(['developer']), async (req: any, res) => {
    try {
      const deletedAdmins = await storage.getDeletedAdmins();
      res.json(deletedAdmins);
    } catch (error) {
      console.error("Error fetching deleted admins:", error);
      res.status(500).json({ message: "Failed to fetch deleted admins" });
    }
  });

  app.get('/api/users/archived', requireAuth, requireRole(['developer']), async (req: any, res) => {
    try {
      const archivedAdmins = await storage.getArchivedAdmins();
      res.json(archivedAdmins);
    } catch (error) {
      console.error("Error fetching archived admins:", error);
      res.status(500).json({ message: "Failed to fetch archived admins" });
    }
  });

  app.put('/api/users/:adminId/restore', requireAuth, requireRole(['developer']), async (req: any, res) => {
    try {
      const { adminId } = req.params;
      
      if (!adminId) {
        return res.status(400).json({ message: "Admin ID is required" });
      }

      // Validate request body
      const parseResult = restoreRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: parseResult.error.errors 
        });
      }

      const { email } = parseResult.data;

      // Only developers can restore admin accounts
      const restoredAdmin = await storage.restoreAdmin(adminId, email);
      
      res.json({ 
        message: "Admin restored successfully with original information", 
        admin: restoredAdmin 
      });
    } catch (error: any) {
      console.error("Error restoring admin:", error);
      
      // Handle specific error messages from storage layer
      if (error.message.includes("not found")) {
        return res.status(404).json({ message: error.message });
      }
      if (error.message.includes("not archived")) {
        return res.status(400).json({ message: error.message });
      }
      if (error.message.includes("already in use")) {
        return res.status(409).json({ message: error.message });
      }
      if (error.message.includes("required")) {
        return res.status(400).json({ message: error.message });
      }
      
      res.status(500).json({ message: "Failed to restore admin" });
    }
  });

  app.get('/api/developer/stats', requireAuth, requireRole(['developer']), async (req: any, res) => {
    try {
      const totalAdmins = await storage.getAdminCount();
      const totalCounselors = await storage.getCounselorCount();
      const totalStudents = await storage.getStudentCount();
      
      res.json({
        totalAdmins,
        totalCounselors,
        totalStudents,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.post('/api/developer/admins', requireAuth, requireRole(['developer']), async (req: any, res) => {
    try {
      const { email, firstName, lastName, password } = req.body;
      
      if (!email || !firstName || !lastName || !password) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Check if email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const adminUser = await storage.upsertUser({
        id: crypto.randomUUID(),
        email,
        firstName,
        lastName,
        role: 'admin',
        password: hashedPassword,
        adminId: null, // Admins don't have an admin
      });

      res.json(adminUser);
    } catch (error) {
      console.error("Error creating admin:", error);
      res.status(500).json({ message: "Failed to create admin" });
    }
  });

  // Update admin
  app.put('/api/developer/admins/:id', requireAuth, requireRole(['developer']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { email, firstName, lastName, password } = req.body;
      
      console.log(`[DEBUG] Admin update request for ID ${id}:`, { email, firstName, lastName, passwordProvided: !!password, passwordLength: password?.length });
      
      // Validation
      if (!email || !firstName || !lastName) {
        return res.status(400).json({ message: 'Email, first name, and last name are required' });
      }
      
      const updateData: any = { email, firstName, lastName };
      if (password && password.trim() !== '') {
        updateData.password = password;
        console.log(`[DEBUG] Password will be updated for admin ${id}`);
      } else {
        console.log(`[DEBUG] Password will NOT be updated for admin ${id} (empty or not provided)`);
      }
      
      await storage.updateAdmin(id, updateData);
      res.json({ message: 'Admin updated successfully' });
    } catch (error) {
      console.error('Update admin error:', error);
      res.status(500).json({ message: 'Failed to update admin' });
    }
  });

  app.delete('/api/developer/admins/:id', requireAuth, requireRole(['developer']), async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Soft delete the admin and all their related data
      await storage.deleteUser(id);
      
      res.json({ message: "Admin deleted successfully" });
    } catch (error) {
      console.error("Error deleting admin:", error);
      res.status(500).json({ message: "Failed to delete admin" });
    }
  });

  // System Settings endpoints
  app.get('/api/system-settings', requireAuth, requireRole(['developer']), async (req: any, res) => {
    try {
      const settings = await storage.getSystemSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching system settings:", error);
      res.status(500).json({ message: "Failed to fetch system settings" });
    }
  });

  app.put('/api/system-settings', requireAuth, requireRole(['developer']), async (req: any, res) => {
    try {
      const updatedSettings = await storage.updateSystemSettings(req.body, req.session.userId);
      res.json(updatedSettings);
    } catch (error) {
      console.error("Error updating system settings:", error);
      res.status(500).json({ message: "Failed to update system settings" });
    }
  });

  app.get('/api/system-settings/database-status', requireAuth, requireRole(['developer']), async (req: any, res) => {
    try {
      const status = await storage.checkDatabaseStatus();
      res.json(status);
    } catch (error) {
      console.error("Error checking database status:", error);
      res.status(500).json({ message: "Failed to check database status" });
    }
  });

  // Notification routes
  app.get('/api/notifications', requireAuth, requireRole(['admin', 'counselor', 'student']), async (req: any, res) => {
    const startTime = Date.now();
    console.log(`🔔 [PERF] GET /api/notifications - Starting request for user: ${req.session.user.id}`);
    
    try {
      const userId = req.session.user.id;
      const limit = parseInt(req.query.limit as string) || 20;
      
      // Set cache-busting headers to ensure fresh data
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      const dbStartTime = Date.now();
      const notifications = await storage.getNotifications(userId, limit);
      const dbTime = Date.now() - dbStartTime;
      
      const totalTime = Date.now() - startTime;
      console.log(`🔔 [PERF] GET /api/notifications completed in ${totalTime}ms (db: ${dbTime}ms), returned ${notifications.length} notifications`);
      
      res.json(notifications);
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`🔔 [ERROR] GET /api/notifications failed after ${totalTime}ms:`, error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.get('/api/notifications/count', requireAuth, requireRole(['admin', 'counselor', 'student']), async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      
      // Set cache-busting headers to ensure fresh data
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching notification count:", error);
      res.status(500).json({ message: "Failed to fetch notification count" });
    }
  });

  app.put('/api/notifications/:id/read', requireAuth, requireRole(['admin', 'counselor', 'student']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user.id;
      await storage.markNotificationAsRead(parseInt(id), userId);
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      if ((error as Error).message === "Notification not found or access denied") {
        res.status(404).json({ message: "Notification not found" });
      } else {
        res.status(500).json({ message: "Failed to mark notification as read" });
      }
    }
  });

  app.put('/api/notifications/read-all', requireAuth, requireRole(['admin', 'counselor', 'student']), async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // Endpoint to create event reminder notifications
  app.post('/api/notifications/create-reminders', requireAuth, requireRole(['admin', 'developer']), async (req: any, res) => {
    try {
      await storage.createEventReminders();
      res.json({ message: "Event reminders created successfully" });
    } catch (error) {
      console.error("Error creating event reminders:", error);
      res.status(500).json({ message: "Failed to create event reminders" });
    }
  });

  // Push notification routes
  app.post('/api/push/subscribe', requireAuth, requireRole(['counselor', 'student']), async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      const subscription = req.body;
      
      await storage.updatePushSubscription(userId, subscription);
      res.json({ message: "Push subscription saved successfully" });
    } catch (error) {
      console.error("Error saving push subscription:", error);
      res.status(500).json({ message: "Failed to save push subscription" });
    }
  });

  app.put('/api/push/preference', requireAuth, requireRole(['counselor', 'student']), async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      const { enabled } = req.body;
      
      await storage.updatePushNotificationPreference(userId, enabled);
      res.json({ message: "Push notification preference updated successfully" });
    } catch (error) {
      console.error("Error updating push notification preference:", error);
      res.status(500).json({ message: "Failed to update push notification preference" });
    }
  });

  app.get('/api/push/vapid-public-key', async (req: any, res) => {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      return res.status(500).json({ message: "VAPID public key not configured" });
    }
    res.json({ publicKey: vapidPublicKey });
  });

  // Helper function to create notification for new messages
  async function createNotificationForMessage(messageId: number, senderId: string, receiverId: string, subject: string) {
    try {
      // Get sender info for notification message
      const sender = await storage.getUser(senderId);
      const senderName = sender?.firstName ? `${sender.firstName} ${sender.lastName || ''}`.trim() : sender?.email || 'Someone';
      
      const notificationTitle = 'New Message';
      const notificationMessage = `You have a new message from ${senderName}: "${subject}"`;
      
      await storage.createNotification({
        userId: receiverId,
        studentId: null, // Messages are between users directly, not tied to a specific student record
        type: 'message_received',
        title: notificationTitle,
        message: notificationMessage,
        relatedId: messageId,
        isRead: false
      });
      
      // Send push notification
      await sendPushNotification(receiverId, notificationTitle, notificationMessage);
    } catch (error) {
      console.error("Error creating message notification:", error);
    }
  }

  // Message routes
  app.get('/api/messages', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const messages = await storage.getMessages(userId, limit);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.get('/api/messages/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user.id;
      
      const message = await storage.getMessageById(parseInt(id));
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      // Check if user is sender or receiver
      if (message.senderId !== userId && message.receiverId !== userId) {
        return res.status(403).json({ message: "Unauthorized to view this message" });
      }

      res.json(message);
    } catch (error) {
      console.error("Error fetching message:", error);
      res.status(500).json({ message: "Failed to fetch message" });
    }
  });

  app.post('/api/messages', requireAuth, requireRole(['admin', 'counselor']), async (req: any, res) => {
    try {
      const senderId = req.session.user.id;
      const messageData = insertMessageSchema.parse({
        ...req.body,
        senderId
      });

      // Additional authorization: counselors can only message their assigned students
      if (req.session.user.role === 'counselor') {
        // Get counselor info
        const counselor = await storage.getCounselorByUserId(senderId);
        if (!counselor) {
          return res.status(403).json({ message: "Counselor record not found" });
        }

        // Check if the receiver is one of their assigned students
        const receiverUser = await storage.getUser(messageData.receiverId);
        if (!receiverUser || receiverUser.role !== 'student') {
          return res.status(403).json({ message: "Can only send messages to students" });
        }

        const receiverStudent = await storage.getStudentByUserId(messageData.receiverId);
        if (!receiverStudent || receiverStudent.counselorId !== counselor.id) {
          return res.status(403).json({ message: "Can only send messages to your assigned students" });
        }
      }

      const newMessage = await storage.createMessage(messageData);

      // Create notification for the receiver
      await createNotificationForMessage(
        newMessage.id, 
        newMessage.senderId, 
        newMessage.receiverId, 
        newMessage.subject
      );

      res.status(201).json(newMessage);
    } catch (error) {
      console.error("Error creating message:", error);
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid message data", errors: (error as any).errors });
      }
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  app.put('/api/messages/:id/read', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user.id;
      
      const message = await storage.getMessageById(parseInt(id));
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      // Only the receiver can mark a message as read
      if (message.receiverId !== userId) {
        return res.status(403).json({ message: "Can only mark messages sent to you as read" });
      }

      const updatedMessage = await storage.markMessageAsRead(parseInt(id));
      res.json(updatedMessage);
    } catch (error) {
      console.error("Error marking message as read:", error);
      res.status(500).json({ message: "Failed to mark message as read" });
    }
  });

  app.get('/api/messages/count/unread', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      const count = await storage.getUnreadMessageCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread message count:", error);
      res.status(500).json({ message: "Failed to fetch unread message count" });
    }
  });

  // Static file serving for document downloads
  app.use('/uploads', requireAuth, (req: any, res, next) => {
    // Add additional permission checks here if needed
    next();
  });

  const httpServer = createServer(app);
  return httpServer;
}
