import crypto from "crypto";

// Encryption configuration
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits (recommended for GCM)
const SALT_LENGTH = 32; // 256 bits
const TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits
const PBKDF2_ITERATIONS = 100000; // Increased for better security

// Get encryption key from environment variable
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "";

if (!ENCRYPTION_KEY && process.env.NODE_ENV === "production") {
  throw new Error("ENCRYPTION_KEY environment variable must be set in production");
}

// For development, use a default key (insecure but functional)
const DEFAULT_DEV_KEY = "dev-key-12345678901234567890123456789012";

/**
 * Derives an encryption key from the master key using PBKDF2
 */
function deriveKey(salt: Buffer): Buffer {
  const masterKey = ENCRYPTION_KEY || DEFAULT_DEV_KEY;
  return crypto.pbkdf2Sync(masterKey, salt, PBKDF2_ITERATIONS, KEY_LENGTH, "sha512");
}

/**
 * Creates a deterministic hash for email lookups while preserving encryption
 * Uses HMAC-SHA256 for secure, consistent hashing
 */
export function hashEmail(email: string): string {
  if (!email || email.trim() === "") {
    return "";
  }
  
  const masterKey = ENCRYPTION_KEY || DEFAULT_DEV_KEY;
  const hmac = crypto.createHmac("sha256", masterKey);
  hmac.update(email.toLowerCase().trim());
  return "hash:" + hmac.digest("hex");
}

/**
 * Encrypts a string value using AES-256-GCM
 * Returns base64-encoded encrypted data with embedded salt, IV, and auth tag
 */
export function encryptField(plaintext: string): string {
  if (!plaintext || plaintext.trim() === "") {
    return plaintext; // Don't encrypt empty values
  }
  
  // Check if already encrypted to prevent double encryption
  if (isFieldEncrypted(plaintext)) {
    return plaintext;
  }

  try {
    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Derive encryption key
    const key = deriveKey(salt);
    
    // Create cipher with proper IV
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    cipher.setAAD(salt); // Use salt as additional authenticated data
    
    // Encrypt the data
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final()
    ]);
    
    // Get authentication tag
    const tag = cipher.getAuthTag();
    
    // Combine salt + iv + tag + encrypted data and encode as base64
    const combined = Buffer.concat([
      salt,
      iv, 
      tag,
      encrypted
    ]);
    
    return "enc:" + combined.toString("base64");
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt field");
  }
}

/**
 * Decrypts a base64-encoded encrypted string using AES-256-GCM
 * Returns the original plaintext value
 */
export function decryptField(encryptedData: string): string {
  if (!encryptedData || !encryptedData.startsWith("enc:")) {
    return encryptedData; // Return as-is if not encrypted (backwards compatibility)
  }

  try {
    // Remove prefix and decode from base64
    const combined = Buffer.from(encryptedData.slice(4), "base64");
    
    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    
    // Derive decryption key
    const key = deriveKey(salt);
    
    // Create decipher with proper IV
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    decipher.setAAD(salt);
    
    // Decrypt the data
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return decrypted.toString("utf8");
  } catch (error) {
    console.error("Decryption error:", error);
    // Throw error instead of returning sentinel string for proper error handling
    throw new Error(`Failed to decrypt field: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Checks if a field value is encrypted
 */
export function isFieldEncrypted(value: string): boolean {
  return value?.startsWith("enc:") || false;
}

/**
 * Encrypts multiple fields in an object
 * Only encrypts fields that are specified in the fieldsToEncrypt array
 */
export function encryptObjectFields<T extends Record<string, any>>(
  obj: T, 
  fieldsToEncrypt: (keyof T)[]
): T {
  const result = { ...obj };
  
  for (const field of fieldsToEncrypt) {
    if (result[field] && typeof result[field] === "string") {
      (result as any)[field] = encryptField(result[field] as string);
    }
  }
  
  return result;
}

/**
 * Decrypts multiple fields in an object
 * Only decrypts fields that are specified in the fieldsToDecrypt array
 */
export function decryptObjectFields<T extends Record<string, any>>(
  obj: T, 
  fieldsToDecrypt: (keyof T)[]
): T {
  const result = { ...obj };
  
  for (const field of fieldsToDecrypt) {
    if (result[field] && typeof result[field] === "string") {
      (result as any)[field] = decryptField(result[field] as string);
    }
  }
  
  return result;
}

/**
 * Utility for bulk encryption operations
 * Encrypts an array of objects with specified fields
 */
export function encryptArray<T extends Record<string, any>>(
  array: T[],
  fieldsToEncrypt: (keyof T)[]
): T[] {
  return array.map(item => encryptObjectFields(item, fieldsToEncrypt));
}

/**
 * Utility for bulk decryption operations  
 * Decrypts an array of objects with specified fields
 */
export function decryptArray<T extends Record<string, any>>(
  array: T[],
  fieldsToDecrypt: (keyof T)[]
): T[] {
  return array.map(item => decryptObjectFields(item, fieldsToDecrypt));
}

/**
 * Generates a secure random encryption key for use in environment variable
 * This is a utility function for initial setup
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Health check for encryption system
 * Tests that encryption/decryption is working correctly
 */
export function testEncryption(): { success: boolean; error?: string } {
  try {
    const testData = "Hello, this is a test encryption message!";
    const encrypted = encryptField(testData);
    const decrypted = decryptField(encrypted);
    
    if (testData === decrypted) {
      return { success: true };
    } else {
      return { success: false, error: "Decrypted data does not match original" };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

// Configuration for which fields to encrypt in each table
export const ENCRYPTION_CONFIG = {
  users: ["email", "firstName", "lastName", "phoneNumber"],
  counselors: ["contactEmail", "bio"],  
  studentProfiles: ["value"],
  messages: ["subject", "content"],
  documents: ["description"],
  activities: ["description", "responsibilities", "learning", "achievements"],
  activityFeedback: ["feedback"],
  systemSettings: ["smtpUser", "smtpPassword"]
} as const;

// Type helper for encryption config
export type EncryptionConfig = typeof ENCRYPTION_CONFIG;
export type EncryptableTable = keyof EncryptionConfig;