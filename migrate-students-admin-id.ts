#!/usr/bin/env tsx

/**
 * CRITICAL DATA MIGRATION: Backfill students.adminId column
 * 
 * This script migrates existing student records to populate the new adminId column
 * which is required for the per-admin student ID implementation.
 * 
 * IMPORTANT: Run this BEFORE applying the schema changes that make adminId NOT NULL
 */

import { db } from "./server/db";
import { students, users } from "./shared/schema";
import { eq, isNull, and } from "drizzle-orm";

interface StudentWithUser {
  studentId: number;
  userId: string;
  adminId: string | null;
  currentAdminId: string | null;
}

async function migrateStudentsAdminId() {
  console.log("=== STUDENTS ADMIN ID MIGRATION ===");
  console.log("Starting migration to backfill students.adminId column...\n");

  try {
    // Step 1: Find all students without adminId set (or with null adminId)
    console.log("Step 1: Finding students without adminId...");
    
    const studentsNeedingUpdate = await db
      .select({
        studentId: students.id,
        userId: students.userId,
        currentAdminId: students.adminId,
      })
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .where(
        and(
          isNull(students.adminId), // Find students where adminId is null
          isNull(users.isDeleted)   // Exclude deleted users
        )
      );

    console.log(`Found ${studentsNeedingUpdate.length} students needing adminId update`);

    if (studentsNeedingUpdate.length === 0) {
      console.log("✅ No migration needed - all students already have adminId set");
      return;
    }

    // Step 2: For each student, get their user's adminId
    console.log("\nStep 2: Processing students...");
    let updateCount = 0;
    let errorCount = 0;

    for (const student of studentsNeedingUpdate) {
      try {
        // Get the user data to find their adminId
        const [userData] = await db
          .select({ adminId: users.adminId })
          .from(users)
          .where(eq(users.id, student.userId));

        if (!userData?.adminId) {
          console.warn(`⚠️  Student ID ${student.studentId}: User ${student.userId} has no adminId - skipping`);
          errorCount++;
          continue;
        }

        // Update the student record with the adminId
        await db
          .update(students)
          .set({ adminId: userData.adminId })
          .where(eq(students.id, student.studentId));

        console.log(`✅ Updated student ID ${student.studentId}: adminId = ${userData.adminId}`);
        updateCount++;

      } catch (error) {
        console.error(`❌ Error updating student ID ${student.studentId}:`, error);
        errorCount++;
      }
    }

    console.log("\n=== MIGRATION SUMMARY ===");
    console.log(`✅ Successfully updated: ${updateCount} students`);
    console.log(`❌ Errors/Skipped: ${errorCount} students`);
    console.log(`📊 Total processed: ${studentsNeedingUpdate.length} students`);

    if (errorCount > 0) {
      console.log("\n⚠️  WARNING: Some students could not be updated. Please review the errors above.");
      console.log("Students without proper adminId will need manual intervention before schema changes.");
    }

    // Step 3: Validation - check for remaining null adminIds
    console.log("\nStep 3: Validating migration...");
    
    const remainingNulls = await db
      .select({ count: students.id })
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .where(
        and(
          isNull(students.adminId),
          isNull(users.isDeleted)
        )
      );

    if (remainingNulls.length > 0) {
      console.error(`❌ VALIDATION FAILED: ${remainingNulls.length} students still have null adminId`);
      console.error("Schema migration will fail until all students have adminId set");
      process.exit(1);
    } else {
      console.log("✅ VALIDATION PASSED: All active students now have adminId set");
    }

  } catch (error) {
    console.error("\n❌ MIGRATION FAILED:", error);
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("Running students adminId migration...");
  migrateStudentsAdminId()
    .then(() => {
      console.log("\n🎉 Migration completed successfully!");
      console.log("You can now proceed with the schema changes to make adminId NOT NULL.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Migration failed:", error);
      process.exit(1);
    });
}

export { migrateStudentsAdminId };