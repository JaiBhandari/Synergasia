import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// In production, use PROD_DATABASE_URL (separate Neon DB).
// In development, fall back to the Replit-provisioned DATABASE_URL.
const connectionString = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "No database URL found. Set PROD_DATABASE_URL (production) or DATABASE_URL (development).",
  );
}

if (process.env.PROD_DATABASE_URL) {
  console.log('[DB] Using PRODUCTION database (PROD_DATABASE_URL)');
} else {
  console.log('[DB] Using DEVELOPMENT database (DATABASE_URL)');
}

export const pool = new Pool({ 
  connectionString,
  max: 10,
  // Keep connections alive so DNS is only resolved once at startup.
  // Without this, idle connections close and each new request triggers
  // a fresh DNS lookup that can fail transiently (EAI_AGAIN).
  idleTimeoutMillis: 600000,   // 10 minutes — keeps connections warm
  connectionTimeoutMillis: 10000, // 10s timeout acquiring a connection
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[DB] Pool error:', err);
});

export const db = drizzle({ client: pool, schema });
