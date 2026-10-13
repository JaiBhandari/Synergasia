// One-time migration script to normalize existing user data
// 
// This script ensures all users have properly encrypted data and normalized email hashes.
// It safely handles existing data by:
// 1. Reading all users from the database
// 2. Decrypting sensitive fields to check if they need normalization
// 3. Re-encrypting and updating emailHash if needed
// 4. Detecting and handling potential duplicates
// 5. Preserving all existing relationships and data
//
// CRITICAL: Run this script only once per environment.
// It is safe to run multiple times (idempotent) but unnecessary.

import { DatabaseStorage } from './server/storage.js';
import { db } from './server/db.js';
import { 
  users, 
  students, 
  counselors, 
  plannerEvents, 
  notifications, 
  messages 
} from './shared/schema.js';
import { eq, isNull, or } from 'drizzle-orm';
import { decryptField, encryptField, hashEmail } from './server/encryption.js';

interface UserRecord {
  id: string;
  email: string | null;
  emailHash: string | null;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  role: "developer" | "admin" | "counselor" | "student";
  adminId: string | null;
  password: string | null;
  isDeleted: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

async function migrateUsers() {
  try {
    console.log('🔄 Starting user data migration...');
    console.log('This script will normalize email addresses and ensure proper encryption.');
    
    const storage = new DatabaseStorage();
    
    // Get all users from the database (including deleted ones for completeness)
    const allUsers = await db
      .select()
      .from(users)
      .orderBy(users.createdAt);
      
    console.log(`📊 Found ${allUsers.length} users to process`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const duplicateEmails = new Map<string, string[]>(); // emailHash -> user IDs
    
    for (const user of allUsers) {
      try {
        console.log(`🔍 Processing user ${user.id} (${user.role})...`);
        
        let needsUpdate = false;
        const updates: Partial<UserRecord> = {};
        
        // Handle email normalization
        if (user.email) {
          try {
            // Try to decrypt the email to check if it's properly formatted
            const decryptedEmail = user.email.startsWith('enc:') 
              ? decryptField(user.email) 
              : user.email;
              
            // Normalize the email (toLowerCase and trim)
            const normalizedEmail = decryptedEmail.toLowerCase().trim();
            const expectedEmailHash = hashEmail(normalizedEmail);
            
            // Check if email normalization or hash is needed
            if (decryptedEmail !== normalizedEmail || user.emailHash !== expectedEmailHash) {
              console.log(`  📧 Email normalization needed: ${decryptedEmail} -> ${normalizedEmail}`);
              updates.email = encryptField(normalizedEmail);
              updates.emailHash = expectedEmailHash;
              needsUpdate = true;
            }
            
            // Track potential duplicates by emailHash
            if (expectedEmailHash) {
              if (!duplicateEmails.has(expectedEmailHash)) {
                duplicateEmails.set(expectedEmailHash, []);
              }
              duplicateEmails.get(expectedEmailHash)!.push(user.id);
            }
            
          } catch (decryptError) {
            console.log(`  ❌ Could not decrypt email for user ${user.id}, treating as plain text`);
            
            // Assume it's plain text and encrypt it
            const normalizedEmail = user.email.toLowerCase().trim();
            const expectedEmailHash = hashEmail(normalizedEmail);
            
            updates.email = encryptField(normalizedEmail);
            updates.emailHash = expectedEmailHash;
            needsUpdate = true;
            
            if (expectedEmailHash) {
              if (!duplicateEmails.has(expectedEmailHash)) {
                duplicateEmails.set(expectedEmailHash, []);
              }
              duplicateEmails.get(expectedEmailHash)!.push(user.id);
            }
          }
        } else if (!user.emailHash) {
          console.log(`  ⚠️  User ${user.id} has no email - skipping email processing`);
        }
        
        // Handle other encrypted fields normalization (firstName, lastName, phoneNumber)
        for (const fieldName of ['firstName', 'lastName', 'phoneNumber'] as const) {
          const fieldValue = user[fieldName];
          if (fieldValue && !fieldValue.startsWith('enc:')) {
            // Field exists but isn't encrypted - encrypt it
            console.log(`  🔐 Encrypting ${fieldName} for user ${user.id}`);
            updates[fieldName] = encryptField(fieldValue);
            needsUpdate = true;
          }
        }
        
        // Apply updates if needed
        if (needsUpdate) {
          console.log(`  ✅ Updating user ${user.id}`);
          // Only include valid update fields (exclude role from updates to avoid type issues)
          const validUpdates = Object.fromEntries(
            Object.entries(updates).filter(([key]) => key !== 'role')
          );
          await db
            .update(users)
            .set({
              ...validUpdates,
              updatedAt: new Date(),
            })
            .where(eq(users.id, user.id));
          updatedCount++;
        } else {
          console.log(`  ✨ User ${user.id} already properly formatted`);
          skippedCount++;
        }
        
      } catch (userError) {
        console.error(`  ❌ Error processing user ${user.id}:`, userError);
        errorCount++;
      }
    }
    
    // Handle duplicate users by merging them
    console.log('\n🔍 Checking for and merging duplicate users...');
    let duplicatesProcessed = 0;
    let duplicatesMerged = 0;
    
    for (const [emailHash, userIds] of duplicateEmails.entries()) {
      if (userIds.length > 1) {
        duplicatesProcessed++;
        console.log(`⚠️  Found ${userIds.length} duplicate users with same email hash ${emailHash}: ${userIds.join(', ')}`);
        
        // Get details of these users
        const duplicateUsers = await db
          .select()
          .from(users)
          .where(eq(users.emailHash, emailHash))
          .orderBy(users.createdAt); // Order by creation date
          
        // Select the canonical user (earliest created, non-deleted preferred)
        let canonicalUser = duplicateUsers[0];
        for (const user of duplicateUsers) {
          if (!user.isDeleted && canonicalUser.isDeleted) {
            canonicalUser = user;
          } else if (user.createdAt < canonicalUser.createdAt && !user.isDeleted) {
            canonicalUser = user;
          }
        }
        
        console.log(`   📌 Selected canonical user: ${canonicalUser.id} (${canonicalUser.role})`);
        
        // Get the duplicate users to merge/delete
        const usersToMerge = duplicateUsers.filter(u => u.id !== canonicalUser.id);
        
        for (const duplicateUser of usersToMerge) {
          console.log(`   🔄 Merging user ${duplicateUser.id} into ${canonicalUser.id}...`);
          
          try {
            // Update related records to point to canonical user
            
            // Update students table
            const studentsUpdated = await db
              .update(students)
              .set({ userId: canonicalUser.id })
              .where(eq(students.userId, duplicateUser.id));
            
            // Update counselors table
            const counselorsUpdated = await db
              .update(counselors)
              .set({ userId: canonicalUser.id })
              .where(eq(counselors.userId, duplicateUser.id));
            
            // Update planner events
            const plannerEventsUpdated = await db
              .update(plannerEvents)
              .set({ userId: canonicalUser.id })
              .where(eq(plannerEvents.userId, duplicateUser.id));
            
            // Update notifications
            const notificationsUpdated = await db
              .update(notifications)
              .set({ userId: canonicalUser.id })
              .where(eq(notifications.userId, duplicateUser.id));
            
            // Update messages (both sender and recipient)
            const messagesSentUpdated = await db
              .update(messages)
              .set({ senderId: canonicalUser.id })
              .where(eq(messages.senderId, duplicateUser.id));
              
            const messagesReceivedUpdated = await db
              .update(messages)
              .set({ recipientId: canonicalUser.id })
              .where(eq(messages.recipientId, duplicateUser.id));
            
            // Mark the duplicate user as deleted
            await db
              .update(users)
              .set({ 
                isDeleted: true, 
                deletedAt: new Date(),
                email: null, // Clear email to prevent conflicts
                emailHash: null // Clear hash to prevent conflicts
              })
              .where(eq(users.id, duplicateUser.id));
            
            console.log(`   ✅ Successfully merged user ${duplicateUser.id} into ${canonicalUser.id}`);
            duplicatesMerged++;
            
          } catch (mergeError) {
            console.error(`   ❌ Error merging user ${duplicateUser.id}:`, mergeError);
            errorCount++;
          }
        }
      }
    }
    
    // Final summary
    console.log('\n📋 Migration Summary:');
    console.log(`   ✅ Users updated: ${updatedCount}`);
    console.log(`   ✨ Users already normalized: ${skippedCount}`);
    console.log(`   🔄 Duplicate groups processed: ${duplicatesProcessed}`);
    console.log(`   📦 Users merged: ${duplicatesMerged}`);
    console.log(`   ❌ Users with errors: ${errorCount}`);
    console.log(`   📊 Total users processed: ${allUsers.length}`);
    
    if (errorCount === 0) {
      console.log('\n🎉 Migration completed successfully!');
    } else {
      console.log('\n⚠️  Migration completed with some errors. Please review the logs above.');
    }
    
    // Verify a few key users can be found by email
    console.log('\n🔍 Verifying email lookups...');
    const testEmails = ['admin@synergasia.com', 'developer@synergasia.com'];
    
    for (const email of testEmails) {
      try {
        const foundUser = await storage.getUserByEmail(email);
        if (foundUser) {
          console.log(`   ✅ Email lookup for ${email}: Found user ${foundUser.id}`);
        } else {
          console.log(`   ❌ Email lookup for ${email}: No user found`);
        }
      } catch (lookupError) {
        console.log(`   ❌ Email lookup for ${email}: Error - ${lookupError}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    console.log('\n🏁 Migration script completed.');
  }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateUsers()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { migrateUsers };