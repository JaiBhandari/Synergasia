import {
  users,
  students,
  counselors,
  profileFields,
  profileFieldCategories,
  studentProfiles,
  universities,
  studentUniversities,
  tasks,
  activities,
  activityFeedback,
  plannerEvents,
  documents,
  notifications,
  messages,
  systemSettings,
  type User,
  type UpsertUser,
  type Student,
  type InsertStudent,
  type Counselor,
  type InsertCounselor,
  type ProfileField,
  type InsertProfileField,
  type ProfileFieldCategory,
  type InsertProfileFieldCategory,
  type StudentProfile,
  type University,
  type InsertUniversity,
  type Task,
  type InsertTask,
  type Activity,
  type InsertActivity,
  type ActivityFeedback,
  type PlannerEvent,
  type InsertPlannerEvent,
  type Document,
  type InsertDocument,
  type Notification,
  type InsertNotification,
  type Message,
  type InsertMessage,
  type SystemSettings,
  type InsertSystemSettings,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, like, or, desc, asc, gte, gt, isNull, isNotNull, sql, count, max, inArray } from "drizzle-orm";
import { 
  encryptObjectFields, 
  decryptObjectFields, 
  encryptField, 
  decryptField, 
  hashEmail,
  ENCRYPTION_CONFIG 
} from "./encryption";

/**
 * CRITICAL SECURITY WARNING: USER CREATION REQUIREMENTS
 * 
 * All user creation MUST go through this storage layer's upsertUser() method.
 * NEVER create users by directly inserting into the database using raw SQL.
 * 
 * The upsertUser() method ensures:
 * - Sensitive fields (email, firstName, lastName, etc.) are properly encrypted
 * - Email hashes are generated for efficient lookups and uniqueness constraints
 * - All security requirements are met
 * 
 * Bypassing this layer creates critical security vulnerabilities:
 * - Unencrypted PII stored in database
 * - Missing email hashes break email lookup functionality
 * - Potential for duplicate emails due to hash normalization issues
 * 
 * If you need to create users in scripts, setup files, or migrations:
 * - Import this DatabaseStorage class
 * - Use the upsertUser() method
 * - See setup-admin.js and setup-developer.js for correct examples
 */

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  updateUserPassword(id: string, password: string): Promise<void>;
  setResetToken(id: string, token: string, expiry: Date): Promise<void>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  
  // Student operations
  getStudents(search?: string, counselorId?: number): Promise<Student[]>;
  getStudent(id: number): Promise<Student | undefined>;
  getStudentByAdminStudentId(adminStudentId: number, adminId: string): Promise<Student | undefined>;
  getStudentByUserId(userId: string): Promise<Student | undefined>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: number, student: Partial<Student>): Promise<Student>;
  deleteStudent(id: number, deletedBy: string): Promise<void>;
  
  // Counselor operations
  getCounselors(): Promise<Counselor[]>;
  getCounselor(id: number): Promise<Counselor | undefined>;
  getCounselorByAdminCounselorId(adminCounselorId: number, adminId: string): Promise<Counselor | undefined>;
  getCounselorByUserId(userId: string): Promise<Counselor | undefined>;
  createCounselor(counselor: InsertCounselor): Promise<Counselor>;
  updateCounselor(id: number, counselor: Partial<Counselor>): Promise<Counselor>;
  deleteCounselor(id: number, deletedBy: string): Promise<void>;
  
  // Profile field operations - admin-scoped
  getProfileFields(category?: string, adminId?: string): Promise<ProfileField[]>;
  getProfileFieldById(id: number): Promise<ProfileField | undefined>;
  createProfileField(field: InsertProfileField): Promise<ProfileField>;
  updateProfileField(id: number, field: Partial<ProfileField>): Promise<ProfileField>;
  deleteProfileField(id: number, deletedBy: string): Promise<void>;
  
  // Profile field category operations - admin-scoped
  getProfileFieldCategories(adminId?: string): Promise<ProfileFieldCategory[]>;
  createProfileFieldCategory(category: InsertProfileFieldCategory): Promise<ProfileFieldCategory>;
  updateProfileFieldCategory(id: number, category: Partial<ProfileFieldCategory>): Promise<ProfileFieldCategory>;
  deleteProfileFieldCategory(id: number, deletedBy: string): Promise<void>;
  getArchivedProfileFieldCategories(adminId: string): Promise<any[]>;
  
  // Student profile operations
  getStudentProfile(studentId: number): Promise<StudentProfile[]>;
  upsertStudentProfile(studentId: number, fieldId: number, value: string): Promise<StudentProfile>;
  batchUpsertStudentProfile(studentId: number, fields: { fieldId: number; value: string }[]): Promise<StudentProfile[]>;
  confirmStudentProfileField(studentId: number, fieldId: number): Promise<StudentProfile>;
  
  // University operations - admin-scoped
  getUniversities(adminId?: string): Promise<University[]>;
  getUniversity(universityId: number): Promise<University | undefined>;
  createUniversity(university: InsertUniversity): Promise<University>;
  updateUniversity(id: number, university: Partial<University>): Promise<University>;
  deleteUniversity(id: number): Promise<void>;
  
  // Student university operations
  getStudentUniversities(studentId: number): Promise<any[]>;
  addStudentUniversity(studentId: number, universityId: number, category?: "reach" | "target" | "safety"): Promise<void>;
  removeStudentUniversity(studentId: number, universityId: number): Promise<void>;
  updateStudentUniversityCategory(studentId: number, universityId: number, category: "reach" | "target" | "safety"): Promise<void>;
  
  // Task operations - admin-scoped
  getTasks(studentId?: number, counselorId?: number, adminId?: string, limit?: number): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<Task>): Promise<Task>;
  deleteTask(id: number): Promise<void>;
  
  // Activity operations
  getActivities(studentId: number): Promise<Activity[]>;
  getActivity(id: number): Promise<Activity | undefined>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  updateActivity(id: number, activity: Partial<Activity>): Promise<Activity>;
  deleteActivity(id: number): Promise<void>;
  
  // Activity feedback operations
  getActivityFeedback(activityId: number): Promise<ActivityFeedback[]>;
  createActivityFeedback(activityId: number, counselorId: number, feedback: string): Promise<ActivityFeedback>;
  
  // Planner operations
  getPlannerEvents(userId: string): Promise<PlannerEvent[]>;
  getPlannerEvent(id: number): Promise<PlannerEvent | undefined>;
  createPlannerEvent(event: InsertPlannerEvent): Promise<PlannerEvent>;
  updatePlannerEvent(id: number, event: Partial<PlannerEvent>): Promise<PlannerEvent>;
  deletePlannerEvent(id: number): Promise<void>;

  // Document operations
  getDocuments(studentId: number, counselorId?: number, visibleToCounselorOnly?: boolean): Promise<Document[]>;
  getDocument(id: number): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: number, document: Partial<Document>): Promise<Document>;
  deleteDocument(id: number): Promise<void>;
  
  // Notification operations
  getNotifications(userId: string, limit?: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number, userId: string): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  createEventReminders(): Promise<void>;
  updatePushNotificationPreference(userId: string, enabled: boolean): Promise<void>;
  updatePushSubscription(userId: string, subscription: any): Promise<void>;
  getUsersWithPushEnabled(userIds: string[]): Promise<User[]>;
  
  // Message operations
  getMessages(userId: string, limit?: number): Promise<Message[]>;
  getMessageById(id: number): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(id: number): Promise<Message>;
  getUnreadMessageCount(userId: string): Promise<number>;
  
  // Developer operations
  getAllAdmins(): Promise<any[]>;
  getDeletedAdmins(): Promise<any[]>;
  getAdminCount(): Promise<number>;
  getCounselorCount(): Promise<number>;
  getStudentCount(): Promise<number>;
  deleteUser(id: string): Promise<void>;
  
  // Archived data operations
  getArchivedStudents(adminId: string): Promise<Student[]>;
  getArchivedCounselors(adminId: string): Promise<Counselor[]>;
  getArchivedAdmins(): Promise<any[]>;
  
  // Restore operations
  restoreStudent(adminStudentId: number, adminId: string, email: string): Promise<Student>;
  restoreCounselor(adminCounselorId: number, adminId: string, email: string): Promise<Counselor>;
  restoreAdmin(adminId: string, email: string): Promise<User>;
  
  // System Settings operations
  getSystemSettings(): Promise<SystemSettings | undefined>;
  updateSystemSettings(settings: Partial<InsertSystemSettings>, updatedBy: string): Promise<SystemSettings>;
  checkDatabaseStatus(): Promise<{ connected: boolean; activeConnections?: number; maxConnections?: number }>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.id, id),
        or(isNull(users.isDeleted), eq(users.isDeleted, false))
      ));
    
    // Decrypt sensitive fields before returning
    if (user) {
      return decryptObjectFields(user, [...ENCRYPTION_CONFIG.users]);
    }
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // CRITICAL: Explicitly normalize email before processing to ensure consistent storage and lookups
    let normalizedUserData = { ...userData };
    if (userData.email) {
      // Normalize email: lowercase and trim whitespace for consistent hashing
      normalizedUserData.email = userData.email.toLowerCase().trim();
    }
    
    // Check if a user with this email already exists
    if (normalizedUserData.email) {
      const existingUser = await this.getUserByEmail(normalizedUserData.email);
      if (existingUser) {
        // Update the existing user with new data
        const updatedUserData = {
          ...existingUser,
          ...normalizedUserData,
          updatedAt: new Date(),
        };
        
        // Encrypt sensitive fields before storing
        const encryptedUserData = encryptObjectFields(updatedUserData, [...ENCRYPTION_CONFIG.users]);
        
        // Add emailHash for efficient lookups
        (encryptedUserData as any).emailHash = hashEmail(normalizedUserData.email);
        
        const [user] = await db
          .update(users)
          .set({
            ...encryptedUserData,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingUser.id))
          .returning();
        
        // Decrypt before returning
        return decryptObjectFields(user, [...ENCRYPTION_CONFIG.users]);
      }
    }
    
    // Encrypt sensitive fields before storing
    const encryptedUserData = encryptObjectFields(normalizedUserData, [...ENCRYPTION_CONFIG.users]);
    
    // Add emailHash for efficient lookups - only if email is provided
    if (normalizedUserData.email) {
      (encryptedUserData as any).emailHash = hashEmail(normalizedUserData.email);
    }
    
    const [user] = await db
      .insert(users)
      .values(encryptedUserData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...encryptedUserData,
          updatedAt: new Date(),
        },
      })
      .returning();
    
    // Decrypt before returning
    return decryptObjectFields(user, [...ENCRYPTION_CONFIG.users]);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    // CRITICAL: Explicitly normalize email before lookup to ensure consistent hash computation
    const normalizedEmail = email.toLowerCase().trim();
    
    // Use emailHash for efficient O(1) lookup instead of O(n) decryption scan
    const emailHashValue = hashEmail(normalizedEmail);
    
    const [user] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.emailHash, emailHashValue),
        or(isNull(users.isDeleted), eq(users.isDeleted, false))
      ));
    
    // Decrypt sensitive fields before returning
    if (user) {
      const decryptedUser = decryptObjectFields(user, [...ENCRYPTION_CONFIG.users]);
      // Double check the email matches to avoid hash collisions
      if (decryptedUser.email?.toLowerCase().trim() === normalizedEmail) {
        return decryptedUser;
      }
    }
    return undefined;
  }

  async updateUserPassword(id: string, password: string): Promise<void> {
    await db
      .update(users)
      .set({ password, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async setResetToken(id: string, token: string, expiry: Date): Promise<void> {
    await db
      .update(users)
      .set({ resetToken: token, resetTokenExpiry: expiry, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.resetToken, token), gte(users.resetTokenExpiry, new Date())));
    return user;
  }

  // Student operations - now admin-scoped
  async getStudents(search?: string, counselorId?: number, adminId?: string): Promise<Student[]> {
    let whereConditions = [or(isNull(users.isDeleted), eq(users.isDeleted, false))];
    
    // Add admin filtering for multi-tenancy using students.adminId column
    if (adminId) {
      whereConditions.push(eq(students.adminId, adminId));
    }
    
    // Add counselor filter at SQL level for better performance
    if (counselorId) {
      whereConditions.push(eq(students.counselorId, counselorId));
    }
    
    // Add search filter at SQL level for better performance  
    if (search) {
      const searchTerm = `%${search.toLowerCase()}%`;
      whereConditions.push(
        or(
          sql`LOWER(${users.firstName}) LIKE ${searchTerm}`,
          sql`LOWER(${users.lastName}) LIKE ${searchTerm}`,
          sql`LOWER(${users.email}) LIKE ${searchTerm}`
        )
      );
    }

    const allStudents = await db
      .select()
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(counselors, eq(students.counselorId, counselors.id))
      .where(and(...whereConditions))
      .orderBy(desc(students.lastActivity));

    // Transform and decrypt only the filtered results
    return allStudents.map(row => ({
      ...row.students,
      user: row.users ? decryptObjectFields(row.users, [...ENCRYPTION_CONFIG.users]) : null,
      counselor: row.counselors ? {
        ...row.counselors,
        user: null // We'll fetch counselor user info separately if needed
      } : null
    }));
  }

  async getStudent(id: number): Promise<Student | undefined> {
    const [result] = await db
      .select()
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(counselors, eq(students.counselorId, counselors.id))
      .where(and(
        eq(students.id, id),
        or(isNull(users.isDeleted), eq(users.isDeleted, false))
      ));
    
    if (!result) return undefined;
    
    // If student has a counselor, fetch the counselor's user info
    let counselorWithUser = null;
    if (result.counselors) {
      const [counselorUserResult] = await db
        .select()
        .from(users)
        .where(eq(users.id, result.counselors.userId));
      
      counselorWithUser = {
        ...result.counselors,
        user: counselorUserResult ? decryptObjectFields(counselorUserResult, [...ENCRYPTION_CONFIG.users]) : null
      };
    }
    
    // Get the most recent profile update timestamp
    const [profileUpdateResult] = await db
      .select({ maxUpdatedAt: max(studentProfiles.updatedAt) })
      .from(studentProfiles)
      .where(eq(studentProfiles.studentId, id));
    
    return {
      ...result.students,
      user: result.users ? decryptObjectFields(result.users, [...ENCRYPTION_CONFIG.users]) : null,
      counselor: counselorWithUser,
      profileLastUpdated: profileUpdateResult?.maxUpdatedAt || null
    } as any;
  }

  async getStudentByAdminStudentId(adminStudentId: number, adminId: string): Promise<Student | undefined> {
    const [result] = await db
      .select()
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(counselors, eq(students.counselorId, counselors.id))
      .where(and(
        eq(students.adminStudentId, adminStudentId),
        eq(students.adminId, adminId), // Use the direct adminId column in students table
        or(isNull(users.isDeleted), eq(users.isDeleted, false))
      ));
    
    if (!result) return undefined;
    
    // If student has a counselor, fetch the counselor's user info
    let counselorWithUser = null;
    if (result.counselors) {
      const [counselorUserResult] = await db
        .select()
        .from(users)
        .where(eq(users.id, result.counselors.userId));
      
      counselorWithUser = {
        ...result.counselors,
        user: counselorUserResult ? decryptObjectFields(counselorUserResult, [...ENCRYPTION_CONFIG.users]) : null
      };
    }
    
    // Get the most recent profile update timestamp
    const [profileUpdateResult] = await db
      .select({ maxUpdatedAt: max(studentProfiles.updatedAt) })
      .from(studentProfiles)
      .where(eq(studentProfiles.studentId, result.students.id));
    
    return {
      ...result.students,
      user: result.users ? decryptObjectFields(result.users, [...ENCRYPTION_CONFIG.users]) : null,
      counselor: counselorWithUser,
      profileLastUpdated: profileUpdateResult?.maxUpdatedAt || null
    } as any;
  }

  async getStudentByUserId(userId: string): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.userId, userId));
    return student;
  }

  async createStudent(student: InsertStudent): Promise<Student> {
    return await db.transaction(async (tx) => {
      // Look up the user to find their adminId
      const [user] = await tx.select().from(users).where(eq(users.id, student.userId));
      if (!user) {
        throw new Error(`User not found with ID: ${student.userId}`);
      }
      
      if (!user.adminId) {
        throw new Error(`User ${student.userId} does not have an assigned admin`);
      }
      
      // Lock existing student rows for this admin to prevent race conditions during ID generation
      // This ensures only one concurrent student creation per admin at a time
      await tx
        .select({ id: students.id })
        .from(students)
        .where(eq(students.adminId, user.adminId))
        .for('update');
      
      // Now safely get the maximum adminStudentId for this admin
      const [maxResult] = await tx
        .select({ maxAdminStudentId: max(students.adminStudentId) })
        .from(students)
        .where(eq(students.adminId, user.adminId));
      
      // Generate the next sequential adminStudentId for this admin (starting from 1)
      const nextAdminStudentId = (maxResult?.maxAdminStudentId ?? 0) + 1;
      
      // Insert the student with the generated adminStudentId and adminId
      const [newStudent] = await tx.insert(students).values({
        ...student,
        adminId: user.adminId, // Set the adminId directly from user
        adminStudentId: nextAdminStudentId
      }).returning();
      
      return newStudent;
    });
  }

  async updateStudent(id: number, student: Partial<Student>): Promise<Student> {
    const [updatedStudent] = await db
      .update(students)
      .set(student)
      .where(eq(students.id, id))
      .returning();
    return updatedStudent;
  }

  async deleteStudent(id: number, deletedBy: string): Promise<void> {
    // Get the student to find the associated user
    const [student] = await db.select().from(students).where(eq(students.id, id));
    if (student) {
      // Delete all related data for this student explicitly
      // (cascade on students.id won't fire since we soft-delete the user, not the student record)
      await db.delete(tasks).where(eq(tasks.studentId, id));
      await db.delete(activities).where(eq(activities.studentId, id));
      await db.delete(documents).where(eq(documents.studentId, id));
      await db.delete(notifications).where(eq(notifications.studentId, id));

      // Delete planner events created for this student's user account
      await db.delete(plannerEvents).where(eq(plannerEvents.userId, student.userId));

      // Mark the user as deleted instead of removing the student record
      await db
        .update(users)
        .set({ 
          isDeleted: true, 
          deletedAt: new Date(),
          deletedBy,
          email: null, // Clear email to allow reuse
          emailHash: null // Clear emailHash to allow reuse
        })
        .where(eq(users.id, student.userId));
    }
  }

  // Counselor operations - now admin-scoped
  async getCounselors(adminId?: string): Promise<Counselor[]> {
    let whereConditions = [or(isNull(users.isDeleted), eq(users.isDeleted, false))];
    
    // Add admin filtering for multi-tenancy
    if (adminId) {
      whereConditions.push(eq(counselors.adminId, adminId));
    }

    const allCounselors = await db
      .select()
      .from(counselors)
      .leftJoin(users, eq(counselors.userId, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(counselors.createdAt));

    // Get student counts for each counselor and decrypt sensitive fields
    const counselorWithCounts = await Promise.all(
      allCounselors.map(async (row) => {
        const studentCount = await db
          .select({ count: count() })
          .from(students)
          .leftJoin(users, eq(students.userId, users.id))
          .where(and(
            eq(students.counselorId, row.counselors.id),
            or(isNull(users.isDeleted), eq(users.isDeleted, false))
          ));

        // Decrypt sensitive counselor fields
        const decryptedCounselor = decryptObjectFields(row.counselors, [...ENCRYPTION_CONFIG.counselors]);
        // Decrypt sensitive user fields
        const decryptedUser = row.users ? decryptObjectFields(row.users, [...ENCRYPTION_CONFIG.users]) : row.users;

        return {
          ...decryptedCounselor,
          user: decryptedUser,
          studentCount: Number(studentCount[0]?.count || 0)
        };
      })
    );

    return counselorWithCounts;
  }

  async getCounselor(id: number): Promise<Counselor | undefined> {
    const [result] = await db
      .select()
      .from(counselors)
      .leftJoin(users, eq(counselors.userId, users.id))
      .where(and(
        eq(counselors.id, id),
        or(isNull(users.isDeleted), eq(users.isDeleted, false))
      ));
    
    if (!result) return undefined;
    
    // Decrypt sensitive counselor and user fields
    const decryptedCounselor = decryptObjectFields(result.counselors, [...ENCRYPTION_CONFIG.counselors]);
    const decryptedUser = result.users ? decryptObjectFields(result.users, [...ENCRYPTION_CONFIG.users]) : result.users;
    
    return {
      ...decryptedCounselor,
      user: decryptedUser
    } as any;
  }

  async getCounselorByAdminCounselorId(adminCounselorId: number, adminId: string): Promise<Counselor | undefined> {
    const [result] = await db
      .select()
      .from(counselors)
      .leftJoin(users, eq(counselors.userId, users.id))
      .where(and(
        eq(counselors.adminCounselorId, adminCounselorId),
        eq(counselors.adminId, adminId), // Use the direct adminId column in counselors table
        or(isNull(users.isDeleted), eq(users.isDeleted, false))
      ));
    
    if (!result) return undefined;
    
    // Decrypt sensitive counselor and user fields
    const decryptedCounselor = decryptObjectFields(result.counselors, [...ENCRYPTION_CONFIG.counselors]);
    const decryptedUser = result.users ? decryptObjectFields(result.users, [...ENCRYPTION_CONFIG.users]) : result.users;
    
    return {
      ...decryptedCounselor,
      user: decryptedUser
    } as any;
  }

  async getCounselorByUserId(userId: string): Promise<Counselor | undefined> {
    const [counselor] = await db.select().from(counselors).where(eq(counselors.userId, userId));
    
    // Decrypt sensitive fields before returning
    if (counselor) {
      return decryptObjectFields(counselor, [...ENCRYPTION_CONFIG.counselors]);
    }
    return counselor;
  }

  async createCounselor(counselor: InsertCounselor): Promise<Counselor> {
    return await db.transaction(async (tx) => {
      // Look up the user to validate the adminId matches
      const [user] = await tx.select().from(users).where(eq(users.id, counselor.userId));
      if (!user) {
        throw new Error(`User not found with ID: ${counselor.userId}`);
      }
      
      if (!user.adminId) {
        throw new Error(`User ${counselor.userId} does not have an assigned admin`);
      }
      
      // Validate that the provided adminId matches the user's adminId for security
      if (counselor.adminId !== user.adminId) {
        throw new Error(`AdminId mismatch: provided ${counselor.adminId}, user has ${user.adminId}`);
      }
      
      // Lock existing counselor rows for this admin to prevent race conditions during ID generation
      // This ensures only one concurrent counselor creation per admin at a time
      await tx
        .select({ id: counselors.id })
        .from(counselors)
        .where(eq(counselors.adminId, counselor.adminId))
        .for('update');
      
      // Now safely get the maximum adminCounselorId for this admin
      const [maxResult] = await tx
        .select({ maxAdminCounselorId: max(counselors.adminCounselorId) })
        .from(counselors)
        .where(eq(counselors.adminId, counselor.adminId));
      
      // Generate the next sequential adminCounselorId for this admin (starting from 1)
      const nextAdminCounselorId = (maxResult?.maxAdminCounselorId ?? 0) + 1;
      
      // Encrypt sensitive fields before storing
      const encryptedCounselor = encryptObjectFields(counselor, [...ENCRYPTION_CONFIG.counselors]);
      
      // Insert the counselor with the generated adminCounselorId
      const [newCounselor] = await tx.insert(counselors).values({
        ...encryptedCounselor,
        adminCounselorId: nextAdminCounselorId
      }).returning();
      
      // Decrypt before returning to caller
      return decryptObjectFields(newCounselor, [...ENCRYPTION_CONFIG.counselors]);
    });
  }

  async updateCounselor(id: number, counselor: Partial<Counselor>): Promise<Counselor> {
    // Encrypt sensitive fields before storing
    const encryptedCounselor = encryptObjectFields(counselor, [...ENCRYPTION_CONFIG.counselors]);
    
    const [updatedCounselor] = await db
      .update(counselors)
      .set(encryptedCounselor)
      .where(eq(counselors.id, id))
      .returning();
    
    // Decrypt before returning to caller
    return decryptObjectFields(updatedCounselor, [...ENCRYPTION_CONFIG.counselors]);
  }

  async deleteCounselor(id: number, deletedBy: string): Promise<void> {
    // Get the counselor to find the associated user
    const [counselor] = await db.select().from(counselors).where(eq(counselors.id, id));
    if (counselor) {
      // Check if counselor has assigned students
      const assignedStudents = await db
        .select({ count: count() })
        .from(students)
        .leftJoin(users, eq(students.userId, users.id))
        .where(and(
          eq(students.counselorId, counselor.id),
          or(isNull(users.isDeleted), eq(users.isDeleted, false))
        ));
      
      if ((assignedStudents[0]?.count || 0) > 0) {
        throw new Error(`Cannot delete counselor - they have ${assignedStudents[0]?.count || 0} student(s) assigned. Please unassign all students first.`);
      }
      
      // Mark the user as deleted instead of removing the counselor record
      await db
        .update(users)
        .set({ 
          isDeleted: true, 
          deletedAt: new Date(),
          deletedBy,
          email: null, // Clear email to allow reuse
          emailHash: null // Clear emailHash to allow reuse
        })
        .where(eq(users.id, counselor.userId));
    }
  }

  // Profile field operations - now admin-scoped
  async getProfileFields(category?: string, adminId?: string): Promise<ProfileField[]> {
    let whereConditions: any[] = [
      or(isNull(profileFields.isDeleted), eq(profileFields.isDeleted, false)),
    ];
    
    if (adminId) {
      whereConditions.push(eq(profileFields.adminId, adminId));
    }
    
    if (category) {
      // Join with categories table to filter by category value
      whereConditions.push(eq(profileFieldCategories.value, category));
    }
    
    const results = await db
      .select({
        id: profileFields.id,
        adminId: profileFields.adminId,
        categoryId: profileFields.categoryId,
        fieldName: profileFields.fieldName,
        fieldLabel: profileFields.fieldLabel,
        fieldType: profileFields.fieldType,
        isRequired: profileFields.isRequired,
        isEditable: profileFields.isEditable,
        options: profileFields.options,
        createdAt: profileFields.createdAt,
        // Category fields with prefixes to avoid nested selection
        categoryId_: profileFieldCategories.id,
        categoryName: profileFieldCategories.name,
        categoryValue: profileFieldCategories.value,
        categoryIsDefault: profileFieldCategories.isDefault,
      })
      .from(profileFields)
      .leftJoin(profileFieldCategories, eq(profileFields.categoryId, profileFieldCategories.id))
      .where(and(...whereConditions))
      .orderBy(asc(profileFieldCategories.name), asc(profileFields.fieldName));

    // Transform results to include nested category object
    return results.map(row => ({
      id: row.id,
      adminId: row.adminId,
      categoryId: row.categoryId,
      fieldName: row.fieldName,
      fieldLabel: row.fieldLabel,
      fieldType: row.fieldType,
      isRequired: row.isRequired,
      isEditable: row.isEditable,
      options: row.options,
      createdAt: row.createdAt,
      category: row.categoryId_ ? {
        id: row.categoryId_,
        name: row.categoryName,
        value: row.categoryValue,
        isDefault: row.categoryIsDefault,
      } : null,
    })) as ProfileField[];
  }

  async getProfileFieldById(id: number): Promise<ProfileField | undefined> {
    const [field] = await db
      .select()
      .from(profileFields)
      .where(eq(profileFields.id, id))
      .limit(1);
    return field as ProfileField | undefined;
  }

  async createProfileField(field: InsertProfileField): Promise<ProfileField> {
    const [newField] = await db.insert(profileFields).values(field).returning();
    return newField;
  }

  async updateProfileField(id: number, field: Partial<ProfileField>): Promise<ProfileField> {
    const [updatedField] = await db
      .update(profileFields)
      .set(field)
      .where(eq(profileFields.id, id))
      .returning();
    return updatedField;
  }

  async deleteProfileField(id: number, deletedBy: string): Promise<void> {
    // Check if any active students have data for this field
    const activeUsage = await db
      .select({ count: count() })
      .from(studentProfiles)
      .innerJoin(students, eq(studentProfiles.studentId, students.id))
      .innerJoin(users, eq(students.userId, users.id))
      .where(and(
        eq(studentProfiles.fieldId, id),
        or(isNull(users.isDeleted), eq(users.isDeleted, false))
      ));

    if ((activeUsage[0]?.count || 0) > 0) {
      throw new Error(`Cannot delete field - ${activeUsage[0]?.count} active student(s) have data in this field. Remove or archive those students first.`);
    }

    // Soft-delete the field
    await db
      .update(profileFields)
      .set({ isDeleted: true, deletedAt: new Date(), deletedBy })
      .where(eq(profileFields.id, id));
  }

  // Profile field category operations - admin-scoped
  async getProfileFieldCategories(adminId?: string): Promise<ProfileFieldCategory[]> {
    let whereConditions: any[] = [
      or(isNull(profileFieldCategories.isDeleted), eq(profileFieldCategories.isDeleted, false)),
    ];
    
    if (adminId) {
      // For specific admin, return only their custom categories
      whereConditions.push(eq(profileFieldCategories.adminId, adminId));
    }
    
    return await db
      .select()
      .from(profileFieldCategories)
      .where(and(...whereConditions))
      .orderBy(asc(profileFieldCategories.name));
  }

  async createProfileFieldCategory(category: InsertProfileFieldCategory): Promise<ProfileFieldCategory> {
    const [newCategory] = await db.insert(profileFieldCategories).values(category).returning();
    return newCategory;
  }

  async updateProfileFieldCategory(id: number, category: Partial<ProfileFieldCategory>): Promise<ProfileFieldCategory> {
    const [updatedCategory] = await db
      .update(profileFieldCategories)
      .set(category)
      .where(eq(profileFieldCategories.id, id))
      .returning();
    return updatedCategory;
  }

  async deleteProfileFieldCategory(id: number, deletedBy: string): Promise<void> {
    // Get all fields in this category
    const fieldsInCategory = await db
      .select({ id: profileFields.id })
      .from(profileFields)
      .where(and(
        eq(profileFields.categoryId, id),
        or(isNull(profileFields.isDeleted), eq(profileFields.isDeleted, false))
      ));

    // Check if any active students have data for any field in this category
    if (fieldsInCategory.length > 0) {
      const fieldIds = fieldsInCategory.map(f => f.id);
      const activeUsage = await db
        .select({ count: count() })
        .from(studentProfiles)
        .innerJoin(students, eq(studentProfiles.studentId, students.id))
        .innerJoin(users, eq(students.userId, users.id))
        .where(and(
          inArray(studentProfiles.fieldId, fieldIds),
          or(isNull(users.isDeleted), eq(users.isDeleted, false))
        ));

      if ((activeUsage[0]?.count || 0) > 0) {
        throw new Error(`Cannot archive category - ${activeUsage[0]?.count} active student(s) have data in fields within this category. Remove or archive those students first.`);
      }

      // Soft-delete all fields in the category
      await db
        .update(profileFields)
        .set({ isDeleted: true, deletedAt: new Date(), deletedBy })
        .where(inArray(profileFields.id, fieldIds));
    }

    // Soft-delete the category
    await db
      .update(profileFieldCategories)
      .set({ isDeleted: true, deletedAt: new Date(), deletedBy })
      .where(eq(profileFieldCategories.id, id));
  }

  async getArchivedProfileFieldCategories(adminId: string): Promise<any[]> {
    // Get all archived categories for this admin
    const archivedCategories = await db
      .select()
      .from(profileFieldCategories)
      .where(and(
        eq(profileFieldCategories.adminId, adminId),
        eq(profileFieldCategories.isDeleted, true)
      ))
      .orderBy(desc(profileFieldCategories.deletedAt));

    // For each category, get its archived fields and the deleter's info
    const result = await Promise.all(archivedCategories.map(async (cat) => {
      const fields = await db
        .select()
        .from(profileFields)
        .where(and(
          eq(profileFields.categoryId, cat.id),
          eq(profileFields.isDeleted, true)
        ))
        .orderBy(asc(profileFields.fieldName));

      // Get deleter info if available
      let deletedByUser = null;
      if (cat.deletedBy) {
        const [deleter] = await db.select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
        }).from(users).where(eq(users.id, cat.deletedBy));
        if (deleter) {
          deletedByUser = decryptObjectFields(deleter, ['firstName', 'lastName']);
        }
      }

      return {
        ...cat,
        fields,
        deletedByUser,
      };
    }));

    return result;
  }

  // Student profile operations
  async getStudentProfile(studentId: number): Promise<StudentProfile[]> {
    const results = await db
      .select({
        id: studentProfiles.id,
        studentId: studentProfiles.studentId,
        fieldId: studentProfiles.fieldId,
        value: studentProfiles.value,
        isConfirmed: studentProfiles.isConfirmed,
        updatedAt: studentProfiles.updatedAt,
        // Profile field properties with prefixes
        fieldId_: profileFields.id,
        fieldCategoryId: profileFields.categoryId,
        fieldName: profileFields.fieldName,
        fieldLabel: profileFields.fieldLabel,
        fieldType: profileFields.fieldType,
        fieldIsRequired: profileFields.isRequired,
        fieldIsEditable: profileFields.isEditable,
        fieldOptions: profileFields.options,
        // Category properties with prefixes
        categoryId: profileFieldCategories.id,
        categoryName: profileFieldCategories.name,
        categoryValue: profileFieldCategories.value,
        categoryIsDefault: profileFieldCategories.isDefault,
      })
      .from(studentProfiles)
      .leftJoin(profileFields, eq(studentProfiles.fieldId, profileFields.id))
      .leftJoin(profileFieldCategories, eq(profileFields.categoryId, profileFieldCategories.id))
      .where(eq(studentProfiles.studentId, studentId));

    // Transform results and decrypt sensitive fields
    return results.map(row => {
      const decryptedValue = row.value ? decryptField(row.value) : row.value;
      return {
        id: row.id,
        studentId: row.studentId,
        fieldId: row.fieldId,
        value: decryptedValue, // Decrypt the sensitive profile value
        isConfirmed: row.isConfirmed,
        updatedAt: row.updatedAt,
        field: row.fieldId_ ? {
          id: row.fieldId_,
          categoryId: row.fieldCategoryId,
          fieldName: row.fieldName,
          fieldLabel: row.fieldLabel,
          fieldType: row.fieldType,
          isRequired: row.fieldIsRequired,
          isEditable: row.fieldIsEditable,
          options: row.fieldOptions,
          category: row.categoryId ? {
            id: row.categoryId,
            name: row.categoryName,
            value: row.categoryValue,
            isDefault: row.categoryIsDefault,
          } : null,
        } : null,
      };
    }) as StudentProfile[];
  }

  async upsertStudentProfile(studentId: number, fieldId: number, value: string): Promise<StudentProfile> {
    // Encrypt the sensitive profile value before storing
    const encryptedValue = value ? encryptField(value) : value;
    
    const [profile] = await db
      .insert(studentProfiles)
      .values({ studentId, fieldId, value: encryptedValue, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [studentProfiles.studentId, studentProfiles.fieldId],
        set: { value: encryptedValue, updatedAt: new Date() },
      })
      .returning();
    
    // Decrypt before returning to caller
    return {
      ...profile,
      value: profile.value ? decryptField(profile.value) : profile.value
    };
  }

  async batchUpsertStudentProfile(studentId: number, fields: { fieldId: number; value: string }[]): Promise<StudentProfile[]> {
    return await db.transaction(async (tx) => {
      const results: StudentProfile[] = [];
      for (const { fieldId, value } of fields) {
        const encryptedValue = value ? encryptField(value) : value;
        const [profile] = await tx
          .insert(studentProfiles)
          .values({ studentId, fieldId, value: encryptedValue, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: [studentProfiles.studentId, studentProfiles.fieldId],
            set: { value: encryptedValue, updatedAt: new Date() },
          })
          .returning();
        results.push({
          ...profile,
          value: profile.value ? decryptField(profile.value) : profile.value,
        } as StudentProfile);
      }
      return results;
    });
  }

  async confirmStudentProfileField(studentId: number, fieldId: number): Promise<StudentProfile> {
    const [profile] = await db
      .update(studentProfiles)
      .set({ isConfirmed: true, updatedAt: new Date() })
      .where(
        and(
          eq(studentProfiles.studentId, studentId),
          eq(studentProfiles.fieldId, fieldId)
        )
      )
      .returning();
    return profile;
  }

  // University operations
  async getUniversities(adminId?: string): Promise<University[]> {
    const whereConditions = adminId ? [eq(universities.adminId, adminId)] : [];
    
    return db
      .select()
      .from(universities)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(asc(universities.name));
  }

  async getUniversity(universityId: number): Promise<University | undefined> {
    const [university] = await db
      .select()
      .from(universities)
      .where(eq(universities.id, universityId));
    return university;
  }

  async createUniversity(university: InsertUniversity): Promise<University> {
    const [newUniversity] = await db.insert(universities).values(university).returning();
    return newUniversity;
  }

  async updateUniversity(id: number, university: Partial<University>): Promise<University> {
    const [updatedUniversity] = await db
      .update(universities)
      .set({ ...university, updatedAt: new Date() })
      .where(eq(universities.id, id))
      .returning();
    return updatedUniversity;
  }

  async deleteUniversity(id: number): Promise<void> {
    await db.delete(universities).where(eq(universities.id, id));
  }

  // Student university operations
  async getStudentUniversities(studentId: number): Promise<any[]> {
    const result = await db
      .select({
        id: studentUniversities.id,
        addedAt: studentUniversities.addedAt,
        category: studentUniversities.category,
        universityId: studentUniversities.universityId,
        // Select all university fields with prefixes
        university_id: universities.id,
        university_adminId: universities.adminId,
        university_name: universities.name,
        university_ranking: universities.overallRanking,
        university_subjectRanking: universities.subjectRankings,
        university_courseLink: universities.courseLink,
        university_location: universities.location,
        university_cityDescription: universities.cityDescription,
        university_setting: universities.campusSetting,
        university_academicsGrade: universities.academicGrade,
        university_safetyGrade: universities.safetyGrade,
        university_tuitionFee: universities.tuitionFee,
        university_totalCostOfAttendance: universities.totalCostOfAttendance,
        university_admissionRate: universities.admissionRate,
        university_intlUndergrad: universities.intlUndergrad,
        university_intlTotal: universities.intlTotal,
        university_additionalAcademicRequirements: universities.additionalAcademicRequirements,
        university_financialAid: universities.financialAidInfo,
        university_coopInternship: universities.coopInternshipPrograms,
        university_additionalRemarks: universities.additionalRemarks,
        university_website: universities.website,
      })
      .from(studentUniversities)
      .leftJoin(universities, eq(studentUniversities.universityId, universities.id))
      .where(eq(studentUniversities.studentId, studentId));
    
    // Transform the flat result into nested structure
    return result.map(row => ({
      id: row.id,
      addedAt: row.addedAt,
      category: row.category,
      universityId: row.universityId,
      university: row.university_id ? {
        id: row.university_id,
        adminId: row.university_adminId,
        name: row.university_name,
        ranking: row.university_ranking,
        subjectRanking: row.university_subjectRanking,
        courseLink: row.university_courseLink,
        location: row.university_location,
        cityDescription: row.university_cityDescription,
        setting: row.university_setting,
        academicsGrade: row.university_academicsGrade,
        safetyGrade: row.university_safetyGrade,
        tuitionFee: row.university_tuitionFee,
        totalCostOfAttendance: row.university_totalCostOfAttendance,
        admissionRate: row.university_admissionRate,
        intlUndergrad: row.university_intlUndergrad,
        intlTotal: row.university_intlTotal,
        additionalAcademicRequirements: row.university_additionalAcademicRequirements,
        financialAid: row.university_financialAid,
        coopInternship: row.university_coopInternship,
        additionalRemarks: row.university_additionalRemarks,
        website: row.university_website,
      } : null,
    }));
  }

  async addStudentUniversity(studentId: number, universityId: number, category: "reach" | "target" | "safety" = "target"): Promise<void> {
    // Check if the university is already in the student's wishlist
    const existing = await db
      .select()
      .from(studentUniversities)
      .where(
        and(
          eq(studentUniversities.studentId, studentId),
          eq(studentUniversities.universityId, universityId)
        )
      );
    
    if (existing.length > 0) {
      throw new Error("This university is already in your wishlist");
    }
    
    await db.insert(studentUniversities).values({ studentId, universityId, category });
  }

  async removeStudentUniversity(studentId: number, universityId: number): Promise<void> {
    await db
      .delete(studentUniversities)
      .where(
        and(
          eq(studentUniversities.studentId, studentId),
          eq(studentUniversities.universityId, universityId)
        )
      );
  }

  async updateStudentUniversityCategory(studentId: number, universityId: number, category: "reach" | "target" | "safety"): Promise<void> {
    await db
      .update(studentUniversities)
      .set({ category })
      .where(
        and(
          eq(studentUniversities.studentId, studentId),
          eq(studentUniversities.universityId, universityId)
        )
      );
  }

  // Task operations
  async getTasks(studentId?: number, counselorId?: number, adminId?: string, limit: number = 100): Promise<Task[]> {
    const conditions = [];
    if (studentId) conditions.push(eq(tasks.studentId, studentId));
    if (counselorId) conditions.push(eq(tasks.counselorId, counselorId));
    if (adminId) conditions.push(eq(tasks.adminId, adminId));
    
    if (conditions.length > 0) {
      return await db
        .select()
        .from(tasks)
        .where(and(...conditions))
        .orderBy(desc(tasks.createdAt))
        .limit(limit);
    }
    
    return await db
      .select()
      .from(tasks)
      .orderBy(desc(tasks.createdAt))
      .limit(limit);
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values(task).returning();
    return newTask;
  }

  async updateTask(id: number, task: Partial<Task>): Promise<Task> {
    const [updatedTask] = await db
      .update(tasks)
      .set(task)
      .where(eq(tasks.id, id))
      .returning();
    return updatedTask;
  }

  async deleteTask(id: number): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  // Activity operations
  async getActivities(studentId: number): Promise<Activity[]> {
    const activitiesResult = await db
      .select()
      .from(activities)
      .where(eq(activities.studentId, studentId))
      .orderBy(desc(activities.createdAt));
    
    // Decrypt sensitive fields before returning
    return activitiesResult.map(activity => 
      decryptObjectFields(activity, [...ENCRYPTION_CONFIG.activities])
    );
  }

  async getActivity(id: number): Promise<Activity | undefined> {
    const [activity] = await db
      .select()
      .from(activities)
      .where(eq(activities.id, id))
      .limit(1);
    if (!activity) return undefined;
    return decryptObjectFields(activity, [...ENCRYPTION_CONFIG.activities]);
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    // Encrypt sensitive fields before storing
    const encryptedActivity = encryptObjectFields(activity, [...ENCRYPTION_CONFIG.activities]);
    
    const [newActivity] = await db.insert(activities).values(encryptedActivity).returning();
    
    // Decrypt before returning to caller
    return decryptObjectFields(newActivity, [...ENCRYPTION_CONFIG.activities]);
  }

  async updateActivity(id: number, activity: Partial<Activity>): Promise<Activity> {
    // Encrypt sensitive fields before storing
    const encryptedActivity = encryptObjectFields(activity, [...ENCRYPTION_CONFIG.activities]);
    
    const [updatedActivity] = await db
      .update(activities)
      .set(encryptedActivity)
      .where(eq(activities.id, id))
      .returning();
    
    // Decrypt before returning to caller
    return decryptObjectFields(updatedActivity, [...ENCRYPTION_CONFIG.activities]);
  }

  async deleteActivity(id: number): Promise<void> {
    await db.delete(activities).where(eq(activities.id, id));
  }

  // Activity feedback operations
  async getActivityFeedback(activityId: number): Promise<any[]> {
    // Simple query with joins to fetch feedback with counselor and user data
    const feedbackData = await db
      .select({
        feedback: activityFeedback,
        counselor: counselors,
        user: users
      })
      .from(activityFeedback)
      .leftJoin(counselors, eq(activityFeedback.counselorId, counselors.id))
      .leftJoin(users, eq(counselors.userId, users.id))
      .where(eq(activityFeedback.activityId, activityId))
      .orderBy(desc(activityFeedback.createdAt));
    
    // Transform the result and decrypt sensitive feedback data
    return feedbackData.map(row => {
      // Decrypt the sensitive feedback field
      const decryptedFeedback = row.feedback ? {
        ...row.feedback,
        feedback: row.feedback.feedback ? decryptField(row.feedback.feedback) : row.feedback.feedback
      } : row.feedback;
      
      return {
        ...decryptedFeedback,
        counselor: row.counselor ? {
          ...row.counselor,
          user: row.user
        } : null
      };
    });
  }

  async createActivityFeedback(activityId: number, counselorId: number, feedback: string): Promise<ActivityFeedback> {
    // Encrypt the sensitive feedback field before storing
    const encryptedFeedback = feedback ? encryptField(feedback) : feedback;
    
    const [newFeedback] = await db
      .insert(activityFeedback)
      .values({ activityId, counselorId, feedback: encryptedFeedback })
      .returning();
    
    // Decrypt before returning to caller
    return {
      ...newFeedback,
      feedback: newFeedback.feedback ? decryptField(newFeedback.feedback) : newFeedback.feedback
    };
  }

  // Planner operations
  async getPlannerEvents(userId: string): Promise<PlannerEvent[]> {
    return db
      .select()
      .from(plannerEvents)
      .where(eq(plannerEvents.userId, userId))
      .orderBy(asc(plannerEvents.startDate));
  }

  async getPlannerEvent(id: number): Promise<PlannerEvent | undefined> {
    const [event] = await db
      .select()
      .from(plannerEvents)
      .where(eq(plannerEvents.id, id))
      .limit(1);
    return event;
  }

  async getStudentPlannerEvents(studentUserId: string, adminId: string): Promise<PlannerEvent[]> {
    // Verify the student belongs to this admin
    const student = await db
      .select()
      .from(users)
      .where(and(eq(users.id, studentUserId), eq(users.adminId, adminId)))
      .limit(1);
    
    if (student.length === 0) {
      throw new Error("Student not found or not authorized");
    }

    const events = await db
      .select()
      .from(plannerEvents)
      .where(eq(plannerEvents.userId, studentUserId))
      .orderBy(asc(plannerEvents.startDate));
      
    return events;
  }

  async createPlannerEvent(event: InsertPlannerEvent & { createdById: string }): Promise<PlannerEvent> {
    const [newEvent] = await db.insert(plannerEvents).values(event).returning();
    return newEvent;
  }

  async createStudentPlannerEvent(event: InsertPlannerEvent & { createdById: string }, adminId: string): Promise<PlannerEvent> {
    // Verify the student belongs to this admin
    const student = await db
      .select()
      .from(users)
      .where(and(eq(users.id, event.userId), eq(users.adminId, adminId)))
      .limit(1);
    
    if (student.length === 0) {
      throw new Error("Student not found or not authorized");
    }

    const [newEvent] = await db.insert(plannerEvents).values(event).returning();
    return newEvent;
  }

  async updatePlannerEvent(id: number, event: Partial<PlannerEvent>): Promise<PlannerEvent> {
    const [updatedEvent] = await db
      .update(plannerEvents)
      .set(event)
      .where(eq(plannerEvents.id, id))
      .returning();
    return updatedEvent;
  }

  async deletePlannerEvent(id: number): Promise<void> {
    await db.delete(plannerEvents).where(eq(plannerEvents.id, id));
  }

  // Document operations
  async getDocuments(studentId: number, counselorId?: number, visibleToCounselorOnly?: boolean): Promise<Document[]> {
    console.log(`[PERF] getDocuments called for studentId: ${studentId}, counselorId: ${counselorId}, visibleToCounselorOnly: ${visibleToCounselorOnly}`);
    const startTime = Date.now();
    
    // Skip expensive existence check for now due to system-wide DB performance issues
    // Instead use a direct count query that's more efficient
    console.log(`[PERF] Starting optimized count query...`);
    const countStartTime = Date.now();
    
    let countConditions = [eq(documents.studentId, studentId)];
    
    if (visibleToCounselorOnly) {
      countConditions.push(eq(documents.isPublic, true));
    }
    
    if (counselorId) {
      countConditions.push(eq(documents.counselorId, counselorId));
    }

    // Use simple count query without joins first
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(documents)
      .where(and(...countConditions));
    
    const countTime = Date.now() - countStartTime;
    const docCount = Number(countResult[0]?.count ?? 0);
    console.log(`[PERF] Count query took ${countTime}ms, found ${docCount} documents`);
    
    // If no documents exist, return empty array immediately
    if (docCount === 0) {
      const totalTime = Date.now() - startTime;
      console.log(`[PERF] getDocuments completed (no documents) in ${totalTime}ms`);
      return [];
    }

    // Documents exist, perform full query with joins
    console.log(`[PERF] Starting full query with joins...`);
    const fullQueryStartTime = Date.now();
    
    let conditions = [
      eq(documents.studentId, studentId),
      or(isNull(users.isDeleted), eq(users.isDeleted, false))
    ];

    // If requesting only documents visible to counselors, filter by isPublic = true
    // isPublic = true means visible to counselors/admins
    // isPublic = false means only visible to the student
    if (visibleToCounselorOnly) {
      conditions.push(eq(documents.isPublic, true));
    }

    // If filtering by counselor, add that condition
    if (counselorId) {
      conditions.push(eq(documents.counselorId, counselorId));
    }

    let query = db
      .select()
      .from(documents)
      .leftJoin(students, eq(documents.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(counselors, eq(documents.counselorId, counselors.id))
      .where(and(...conditions))
      .orderBy(desc(documents.createdAt));

    const results = await query;
    const fullQueryTime = Date.now() - fullQueryStartTime;
    console.log(`[PERF] Full query took ${fullQueryTime}ms, returned ${results.length} rows`);
    
    console.log(`[PERF] Starting decryption process...`);
    const decryptionStartTime = Date.now();
    
    const decryptedResults = results.map(row => {
      // Decrypt sensitive document fields
      const decryptedDocument = decryptObjectFields(row.documents, [...ENCRYPTION_CONFIG.documents]);
      
      return {
        ...decryptedDocument,
        student: row.students ? {
          ...row.students,
          user: row.users
        } : null,
        counselor: row.counselors || null
      };
    });
    
    const decryptionTime = Date.now() - decryptionStartTime;
    const totalTime = Date.now() - startTime;
    console.log(`[PERF] Decryption took ${decryptionTime}ms`);
    console.log(`[PERF] getDocuments completed (${results.length} documents) in ${totalTime}ms`);
    
    return decryptedResults as any;
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [result] = await db
      .select()
      .from(documents)
      .leftJoin(students, eq(documents.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(counselors, eq(documents.counselorId, counselors.id))
      .where(and(
        eq(documents.id, id),
        or(isNull(users.isDeleted), eq(users.isDeleted, false))
      ));
    
    if (!result) return undefined;
    
    // Decrypt sensitive document fields
    const decryptedDocument = decryptObjectFields(result.documents, [...ENCRYPTION_CONFIG.documents]);
    
    return {
      ...decryptedDocument,
      student: result.students ? {
        ...result.students,
        user: result.users
      } : null,
      counselor: result.counselors || null
    } as any;
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    // Encrypt sensitive fields before storing
    const encryptedDocument = encryptObjectFields(document, [...ENCRYPTION_CONFIG.documents]);
    
    const [newDocument] = await db.insert(documents).values(encryptedDocument).returning();
    
    // Decrypt before returning to caller
    return decryptObjectFields(newDocument, [...ENCRYPTION_CONFIG.documents]);
  }

  async updateDocument(id: number, document: Partial<Document>): Promise<Document> {
    // Encrypt sensitive fields before storing
    const encryptedDocument = encryptObjectFields(document, [...ENCRYPTION_CONFIG.documents]);
    
    const [updatedDocument] = await db
      .update(documents)
      .set({ ...encryptedDocument, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    
    // Decrypt before returning to caller
    return decryptObjectFields(updatedDocument, [...ENCRYPTION_CONFIG.documents]);
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  // Notification operations
  async getNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    const startTime = Date.now();
    
    // First, get notifications without expensive JOINs for better performance
    const baseNotifications = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
    
    const baseQueryTime = Date.now() - startTime;
    console.log(`🔔 [PERF-DB] Base notifications query took ${baseQueryTime}ms, found ${baseNotifications.length} notifications`);
    
    // Only fetch student/user data for notifications that have studentId
    const notificationsWithStudentIds = baseNotifications.filter(n => n.studentId);
    
    let studentData: Record<number, any> = {};
    
    if (notificationsWithStudentIds.length > 0) {
      const joinStartTime = Date.now();
      const studentIds = Array.from(new Set(notificationsWithStudentIds.map(n => n.studentId!)));
      
      // Batch fetch student and user data for all unique student IDs
      const studentsWithUsers = await db
        .select()
        .from(students)
        .leftJoin(users, eq(students.userId, users.id))
        .where(and(
          inArray(students.id, studentIds),
          or(isNull(users.isDeleted), eq(users.isDeleted, false))
        ));
      
      const joinQueryTime = Date.now() - joinStartTime;
      console.log(`🔔 [PERF-DB] Student/user JOIN query took ${joinQueryTime}ms for ${studentIds.length} students`);
      
      // Build lookup map
      studentsWithUsers.forEach(row => {
        if (row.students) {
          studentData[row.students.id] = {
            ...row.students,
            user: row.users ? decryptObjectFields(row.users, [...ENCRYPTION_CONFIG.users]) : null
          };
        }
      });
    }
    
    // Combine results
    const result = baseNotifications.map(notification => ({
      ...notification,
      student: notification.studentId ? studentData[notification.studentId] || null : null,
    })) as any[];
    
    const totalTime = Date.now() - startTime;
    console.log(`🔔 [PERF-DB] Total getNotifications took ${totalTime}ms (base: ${baseQueryTime}ms, join: ${notificationsWithStudentIds.length > 0 ? Date.now() - startTime - baseQueryTime : 0}ms)`);
    
    return result;
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db.insert(notifications).values(notification).returning();
    return newNotification;
  }

  async markNotificationAsRead(id: number, userId: string): Promise<void> {
    const result = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    
    // Check if any rows were updated (i.e., the notification existed and belonged to the user)
    if (result.rowCount === 0) {
      throw new Error("Notification not found or access denied");
    }
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return result.count;
  }

  async createEventReminders(): Promise<void> {
    const now = new Date();
    
    // Look ahead 30 days to catch all possible reminders
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    // Find all events with reminders for active student users only
    const upcomingEvents = await db
      .select({
        event: plannerEvents,
        user: users,
        student: students
      })
      .from(plannerEvents)
      .innerJoin(users, eq(plannerEvents.userId, users.id))
      .leftJoin(students, eq(users.id, students.userId))
      .where(
        and(
          // Event ends in the future
          gte(plannerEvents.endDate, now),
          // Event ends within our look-ahead window
          sql`${plannerEvents.endDate} <= ${futureDate}`,
          // Has reminder settings
          gt(plannerEvents.reminderCount, 0),
          isNotNull(plannerEvents.reminderInterval),
          isNotNull(plannerEvents.reminderIntervalValue),
          // User is active student
          eq(users.role, 'student'),
          or(isNull(users.isDeleted), eq(users.isDeleted, false))
        )
      );

    if (upcomingEvents.length === 0) return;

    // Calculate all reminder times that should trigger now
    const remindersToCreate = [];
    
    for (const row of upcomingEvents) {
      const event = row.event;
      const student = row.student;
      
      if (!event.endDate || !event.reminderCount || !event.reminderInterval || !event.reminderIntervalValue) continue;

      // Convert interval to minutes using user-specified value
      let intervalInMinutes = event.reminderIntervalValue;
      switch (event.reminderInterval) {
        case 'minutes':
          // Already in minutes, use value as-is
          break;
        case 'hours':
          intervalInMinutes = event.reminderIntervalValue * 60;
          break;
        case 'days':
          intervalInMinutes = event.reminderIntervalValue * 60 * 24;
          break;
        default:
          continue; // Skip invalid intervals
      }

      const endDate = new Date(event.endDate);
      
      // Generate all reminder times for this event
      for (let i = 1; i <= event.reminderCount; i++) {
        const reminderTime = new Date(endDate.getTime() - (i * intervalInMinutes * 60 * 1000));
        
        // Check if this reminder should be sent now (within the last hour)
        const hourAgo = new Date(now.getTime() - (60 * 60 * 1000));
        
        if (reminderTime >= hourAgo && reminderTime <= now) {
          remindersToCreate.push({
            event,
            student,
            reminderTime,
            reminderNumber: i,
            totalReminders: event.reminderCount
          });
        }
      }
    }

    if (remindersToCreate.length === 0) return;

    // Get existing reminders to avoid duplicates
    const eventIds = Array.from(new Set(remindersToCreate.map(r => r.event.id)));
    const existingReminders = await db
      .select({
        userId: notifications.userId,
        relatedId: notifications.relatedId,
        message: notifications.message
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.type, 'event_reminder'),
          sql`${notifications.relatedId} = ANY(ARRAY[${sql.join(eventIds, sql`, `)}]::integer[])`
        )
      );

    // Create a set for duplicate detection
    const existingReminderKeys = new Set(
      existingReminders.map(r => `${r.userId}-${r.relatedId}-${r.message}`)
    );

    // Prepare notifications to insert
    const notificationsToInsert = [];
    
    for (const reminder of remindersToCreate) {
      const { event, student, reminderTime, reminderNumber, totalReminders } = reminder;
      
      const endDate = new Date(event.endDate!);
      const endTimeString = endDate.toLocaleString('en-US', { 
        month: 'short',
        day: 'numeric',
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      });

      // Create a descriptive message
      let intervalText = event.reminderInterval;
      if (intervalText === 'minutes') intervalText = 'minute(s)';
      if (intervalText === 'hours') intervalText = 'hour(s)';
      if (intervalText === 'days') intervalText = 'day(s)';

      const message = `Reminder ${reminderNumber}/${totalReminders}: "${event.title}" ends at ${endTimeString}. ${event.description ? `Description: ${event.description}` : ''}`;

      // Check for duplicates
      const reminderKey = `${event.userId}-${event.id}-${message}`;
      if (existingReminderKeys.has(reminderKey)) continue;

      notificationsToInsert.push({
        userId: event.userId,
        studentId: student?.id || null,
        type: 'event_reminder' as const,
        title: 'Event Reminder',
        message,
        relatedId: event.id,
        isRead: false
      });
    }

    // Batch insert all notifications and send push notifications
    if (notificationsToInsert.length > 0) {
      await db.insert(notifications).values(notificationsToInsert);
      
      // Send push notifications for each reminder
      const { sendPushNotification } = await import('./routes.js');
      for (const notification of notificationsToInsert) {
        await sendPushNotification(notification.userId, notification.title, notification.message);
      }
    }
  }

  async updatePushNotificationPreference(userId: string, enabled: boolean): Promise<void> {
    await db
      .update(users)
      .set({ pushNotificationsEnabled: enabled })
      .where(eq(users.id, userId));
  }

  async updatePushSubscription(userId: string, subscription: any): Promise<void> {
    await db
      .update(users)
      .set({ pushSubscription: subscription })
      .where(eq(users.id, userId));
  }

  async getUsersWithPushEnabled(userIds: string[]): Promise<User[]> {
    if (userIds.length === 0) return [];
    
    const usersResult = await db
      .select()
      .from(users)
      .where(
        and(
          inArray(users.id, userIds),
          eq(users.pushNotificationsEnabled, true),
          isNotNull(users.pushSubscription)
        )
      );
    
    return usersResult.map(user => decryptObjectFields(user, [...ENCRYPTION_CONFIG.users]));
  }

  // Message operations
  async getMessages(userId: string, limit: number = 20): Promise<Message[]> {
    const messageResults = await db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        receiverId: messages.receiverId,
        subject: messages.subject,
        content: messages.content,
        isRead: messages.isRead,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
        senderName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.firstName}, ${users.email})`,
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(or(eq(messages.senderId, userId), eq(messages.receiverId, userId)))
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    // Decrypt sensitive message fields before returning
    return messageResults.map(msg => ({
      ...msg,
      subject: msg.subject ? decryptField(msg.subject) : msg.subject,
      content: msg.content ? decryptField(msg.content) : msg.content
    }));
  }

  async getMessageById(id: number): Promise<Message | undefined> {
    const [message] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, id));
    
    // Decrypt sensitive fields before returning
    if (message) {
      return decryptObjectFields(message, [...ENCRYPTION_CONFIG.messages]);
    }
    return message;
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    // Encrypt sensitive fields before storing
    const encryptedMessage = encryptObjectFields(message, [...ENCRYPTION_CONFIG.messages]);
    
    const [newMessage] = await db.insert(messages).values(encryptedMessage).returning();
    
    // Decrypt before returning to caller
    return decryptObjectFields(newMessage, [...ENCRYPTION_CONFIG.messages]);
  }

  async markMessageAsRead(id: number): Promise<Message> {
    const [updatedMessage] = await db
      .update(messages)
      .set({ 
        isRead: true,
        updatedAt: new Date()
      })
      .where(eq(messages.id, id))
      .returning();
    
    // Decrypt sensitive fields before returning
    return decryptObjectFields(updatedMessage, [...ENCRYPTION_CONFIG.messages]);
  }

  async getUnreadMessageCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(messages)
      .where(and(
        eq(messages.receiverId, userId),
        eq(messages.isRead, false)
      ));
    return result.count;
  }

  // Developer operations
  async getAllAdmins(): Promise<any[]> {
    const admins = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        isDeleted: users.isDeleted,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(
        eq(users.role, 'admin'),
        or(isNull(users.isDeleted), eq(users.isDeleted, false))
      ))
      .orderBy(desc(users.createdAt));

    // Add counts for each admin
    const adminsWithCounts = await Promise.all(
      admins.map(async (admin) => {
        const [counselorCount] = await db
          .select({ count: count() })
          .from(counselors)
          .leftJoin(users, eq(counselors.userId, users.id))
          .where(and(
            eq(counselors.adminId, admin.id),
            or(isNull(users.isDeleted), eq(users.isDeleted, false))
          ));

        const [studentCount] = await db
          .select({ count: count() })
          .from(students)
          .leftJoin(users, eq(students.userId, users.id))
          .where(and(
            eq(users.adminId, admin.id),
            or(isNull(users.isDeleted), eq(users.isDeleted, false))
          ));

        return {
          ...admin,
          counselorCount: counselorCount.count || 0,
          studentCount: studentCount.count || 0,
        };
      })
    );

    // Decrypt sensitive fields before returning - only decrypt fields that exist in the admin object
    return adminsWithCounts.map(admin => 
      decryptObjectFields(admin, ["email", "firstName", "lastName"])
    );
  }

  async getDeletedAdmins(): Promise<any[]> {
    const admins = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        isDeleted: users.isDeleted,
        createdAt: users.createdAt,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(and(
        eq(users.role, 'admin'),
        eq(users.isDeleted, true)
      ))
      .orderBy(desc(users.deletedAt));

    // Add counts for each deleted admin (counting their deleted counselors/students)
    const adminsWithCounts = await Promise.all(
      admins.map(async (admin) => {
        const [counselorCount] = await db
          .select({ count: count() })
          .from(counselors)
          .leftJoin(users, eq(counselors.userId, users.id))
          .where(and(
            eq(counselors.adminId, admin.id),
            eq(users.isDeleted, true)
          ));

        const [studentCount] = await db
          .select({ count: count() })
          .from(students)
          .leftJoin(users, eq(students.userId, users.id))
          .where(and(
            eq(users.adminId, admin.id),
            eq(users.isDeleted, true)
          ));

        return {
          ...admin,
          counselorCount: counselorCount.count || 0,
          studentCount: studentCount.count || 0,
        };
      })
    );

    // Decrypt sensitive fields before returning - only decrypt fields that exist in the admin object
    return adminsWithCounts.map(admin => 
      decryptObjectFields(admin, ["email", "firstName", "lastName"])
    );
  }

  // Archived data operations
  async getArchivedStudents(adminId: string): Promise<Student[]> {
    const archivedStudents = await db
      .select()
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(counselors, eq(students.counselorId, counselors.id))
      .where(and(
        eq(students.adminId, adminId),
        eq(users.isDeleted, true),
        isNotNull(users.deletedAt)
      ))
      .orderBy(desc(users.deletedAt));

    // Collect all unique deletedBy user IDs to fetch in one query
    const deleterIds = [...new Set(
      archivedStudents
        .map(row => row.users?.deletedBy)
        .filter((id): id is string => !!id)
    )];

    const deletersMap: Record<string, any> = {};
    if (deleterIds.length > 0) {
      const deleters = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, role: users.role })
        .from(users)
        .where(inArray(users.id, deleterIds));
      for (const d of deleters) {
        deletersMap[d.id] = decryptObjectFields(d, ['firstName', 'lastName']);
      }
    }

    // Transform the result to include user information and decrypt sensitive fields
    const transformedStudents = archivedStudents.map(row => {
      const decryptedUser = row.users ? decryptObjectFields(row.users, [...ENCRYPTION_CONFIG.users]) : null;
      return {
        ...row.students,
        user: decryptedUser,
        deletedByUser: decryptedUser?.deletedBy ? (deletersMap[decryptedUser.deletedBy] || null) : null,
        counselor: row.counselors ? {
          ...row.counselors,
          user: null
        } : null
      };
    });

    return transformedStudents;
  }

  async getArchivedCounselors(adminId: string): Promise<Counselor[]> {
    const archivedCounselors = await db
      .select()
      .from(counselors)
      .leftJoin(users, eq(counselors.userId, users.id))
      .where(and(
        eq(counselors.adminId, adminId),
        eq(users.isDeleted, true),
        isNotNull(users.deletedAt)
      ))
      .orderBy(desc(users.deletedAt));

    // Collect all unique deletedBy user IDs
    const deleterIds = [...new Set(
      archivedCounselors
        .map(row => row.users?.deletedBy)
        .filter((id): id is string => !!id)
    )];

    const deletersMap: Record<string, any> = {};
    if (deleterIds.length > 0) {
      const deleters = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, role: users.role })
        .from(users)
        .where(inArray(users.id, deleterIds));
      for (const d of deleters) {
        deletersMap[d.id] = decryptObjectFields(d, ['firstName', 'lastName']);
      }
    }

    // Transform the result to include user information and decrypt sensitive fields
    const transformedCounselors = archivedCounselors.map(row => {
      const decryptedUser = row.users ? decryptObjectFields(row.users, [...ENCRYPTION_CONFIG.users]) : null;
      return {
        ...row.counselors,
        user: decryptedUser,
        deletedByUser: decryptedUser?.deletedBy ? (deletersMap[decryptedUser.deletedBy] || null) : null,
      };
    });

    return transformedCounselors;
  }

  async getArchivedAdmins(): Promise<any[]> {
    const archivedAdmins = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        isDeleted: users.isDeleted,
        createdAt: users.createdAt,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(and(
        eq(users.role, 'admin'),
        eq(users.isDeleted, true),
        isNotNull(users.deletedAt)
      ))
      .orderBy(desc(users.deletedAt));

    // Add counts for each archived admin (counting their archived counselors/students)
    const adminsWithCounts = await Promise.all(
      archivedAdmins.map(async (admin) => {
        const [counselorCount] = await db
          .select({ count: count() })
          .from(counselors)
          .leftJoin(users, eq(counselors.userId, users.id))
          .where(and(
            eq(counselors.adminId, admin.id),
            eq(users.isDeleted, true),
            isNotNull(users.deletedAt)
          ));

        const [studentCount] = await db
          .select({ count: count() })
          .from(students)
          .leftJoin(users, eq(students.userId, users.id))
          .where(and(
            eq(students.adminId, admin.id),
            eq(users.isDeleted, true),
            isNotNull(users.deletedAt)
          ));

        return {
          ...admin,
          counselorCount: counselorCount.count || 0,
          studentCount: studentCount.count || 0,
        };
      })
    );

    // Decrypt sensitive fields before returning - only decrypt fields that are selected in query
    const encryptedFieldsInAdmin = ["email", "firstName", "lastName"] as const;
    return adminsWithCounts.map(admin => 
      decryptObjectFields(admin, [...encryptedFieldsInAdmin])
    );
  }

  // Restore operations
  async restoreStudent(adminStudentId: number, adminId: string, email: string): Promise<Student> {
    // Find the student by adminStudentId and adminId
    const [student] = await db
      .select()
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(
        eq(students.adminStudentId, adminStudentId),
        eq(students.adminId, adminId)
      ));

    if (!student || !student.students || !student.users) {
      throw new Error(`Student with admin ID ${adminStudentId} not found`);
    }

    // Check if the student is actually soft-deleted
    if (!student.users.isDeleted) {
      throw new Error(`Student with admin ID ${adminStudentId} is not archived`);
    }

    // Validate and normalize the provided email
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail) {
      throw new Error('Email is required for restoration');
    }

    // Decrypt the original email and verify it matches
    if (!student.users.email) {
      throw new Error('Original email not found for this student');
    }
    const originalEmail = decryptField(student.users.email);
    const normalizedOriginalEmail = originalEmail.toLowerCase().trim();
    
    if (normalizedEmail !== normalizedOriginalEmail) {
      throw new Error('Email does not match the original account email. Please enter the correct email address.');
    }

    // Restore the user record (email remains unchanged)
    await db
      .update(users)
      .set({
        isDeleted: false,
        deletedAt: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, student.users.id));

    // Return the restored student with user information
    const restoredStudent = await this.getStudentByAdminStudentId(adminStudentId, adminId);
    if (!restoredStudent) {
      throw new Error('Failed to retrieve restored student');
    }

    return restoredStudent;
  }

  async restoreCounselor(adminCounselorId: number, adminId: string, email: string): Promise<Counselor> {
    // Find the counselor by adminCounselorId and adminId
    const [counselor] = await db
      .select()
      .from(counselors)
      .leftJoin(users, eq(counselors.userId, users.id))
      .where(and(
        eq(counselors.adminCounselorId, adminCounselorId),
        eq(counselors.adminId, adminId)
      ));

    if (!counselor || !counselor.counselors || !counselor.users) {
      throw new Error(`Counselor with admin ID ${adminCounselorId} not found`);
    }

    // Check if the counselor is actually soft-deleted
    if (!counselor.users.isDeleted) {
      throw new Error(`Counselor with admin ID ${adminCounselorId} is not archived`);
    }

    // Validate and normalize the provided email
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail) {
      throw new Error('Email is required for restoration');
    }

    // Decrypt the original email and verify it matches
    if (!counselor.users.email) {
      throw new Error('Original email not found for this counselor');
    }
    const originalEmail = decryptField(counselor.users.email);
    const normalizedOriginalEmail = originalEmail.toLowerCase().trim();
    
    if (normalizedEmail !== normalizedOriginalEmail) {
      throw new Error('Email does not match the original account email. Please enter the correct email address.');
    }

    // Restore the user record (email remains unchanged)
    await db
      .update(users)
      .set({
        isDeleted: false,
        deletedAt: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, counselor.users.id));

    // Return the restored counselor with user information
    const restoredCounselor = await this.getCounselorByAdminCounselorId(adminCounselorId, adminId);
    if (!restoredCounselor) {
      throw new Error('Failed to retrieve restored counselor');
    }

    return restoredCounselor;
  }

  async restoreAdmin(adminId: string, email: string): Promise<User> {
    // Find the admin user
    const [admin] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.id, adminId),
        eq(users.role, 'admin')
      ));

    if (!admin) {
      throw new Error(`Admin with ID ${adminId} not found`);
    }

    // Check if the admin is actually soft-deleted
    if (!admin.isDeleted) {
      throw new Error(`Admin with ID ${adminId} is not archived`);
    }

    // Validate and normalize the provided email
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail) {
      throw new Error('Email is required for restoration');
    }

    // Decrypt the original email and verify it matches
    if (!admin.email) {
      throw new Error('Original email not found for this admin');
    }
    const originalEmail = decryptField(admin.email);
    const normalizedOriginalEmail = originalEmail.toLowerCase().trim();
    
    if (normalizedEmail !== normalizedOriginalEmail) {
      throw new Error('Email does not match the original account email. Please enter the correct email address.');
    }

    // Restore the user record (email remains unchanged)
    await db
      .update(users)
      .set({
        isDeleted: false,
        deletedAt: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, adminId));

    // Return the restored admin
    const restoredAdmin = await this.getUser(adminId);
    if (!restoredAdmin) {
      throw new Error('Failed to retrieve restored admin');
    }

    return restoredAdmin;
  }

  async updateAdmin(adminId: string, updateData: { email?: string; firstName?: string; lastName?: string; password?: string }): Promise<void> {
    const updateObj: any = {};
    
    // Handle encrypted fields
    if (updateData.email) {
      // CRITICAL: Normalize email and regenerate hash for lookups to work
      const normalizedEmail = updateData.email.toLowerCase().trim();
      updateObj.email = normalizedEmail;
      updateObj.emailHash = hashEmail(normalizedEmail);
    }
    if (updateData.firstName) updateObj.firstName = updateData.firstName;
    if (updateData.lastName) updateObj.lastName = updateData.lastName;
    
    // Handle password hashing
    if (updateData.password) {
      const bcrypt = (await import('bcrypt')).default;
      updateObj.password = await bcrypt.hash(updateData.password, 10);
    }

    // Encrypt sensitive fields before storing (excluding password which is already hashed)
    const encryptedUpdateObj = encryptObjectFields(updateObj, [...ENCRYPTION_CONFIG.users]);
    
    // Add emailHash directly since it shouldn't be encrypted (and isn't in ENCRYPTION_CONFIG.users)
    if (updateObj.emailHash) {
      encryptedUpdateObj.emailHash = updateObj.emailHash;
    }

    await db
      .update(users)
      .set({
        ...encryptedUpdateObj,
        updatedAt: new Date()
      })
      .where(and(
        eq(users.id, adminId),
        eq(users.role, 'admin')
      ));
  }

  async getAdminCount(): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(users)
      .where(and(
        eq(users.role, 'admin'),
        or(isNull(users.isDeleted), eq(users.isDeleted, false))
      ));
    return result.count || 0;
  }

  async getCounselorCount(): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(counselors)
      .leftJoin(users, eq(counselors.userId, users.id))
      .where(or(isNull(users.isDeleted), eq(users.isDeleted, false)));
    return result.count || 0;
  }

  async getStudentCount(): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .where(or(isNull(users.isDeleted), eq(users.isDeleted, false)));
    return result.count || 0;
  }

  async deleteUser(id: string): Promise<void> {
    // Use a transaction to ensure data consistency during cascading deletion
    await db.transaction(async (tx) => {
      // First, get the user to check their role
      const [userToDelete] = await tx
        .select()
        .from(users)
        .where(eq(users.id, id));

      if (!userToDelete) {
        throw new Error(`User with id ${id} not found`);
      }

      // If deleting an admin, cascade soft delete to all their managed users
      if (userToDelete.role === 'admin') {
        // Find all counselors managed by this admin and soft delete their user records
        const counselorsUnderAdmin = await tx
          .select({ userId: counselors.userId })
          .from(counselors)
          .where(eq(counselors.adminId, id));

        if (counselorsUnderAdmin.length > 0) {
          const counselorUserIds = counselorsUnderAdmin.map(c => c.userId);
          await tx
            .update(users)
            .set({
              isDeleted: true,
              deletedAt: new Date(),
              deletedBy: id,
              email: null,
              emailHash: null
            })
            .where(or(...counselorUserIds.map(userId => eq(users.id, userId))));
        }

        // Find all students managed by this admin and soft delete their user records
        const studentsUnderAdmin = await tx
          .select({ userId: students.userId })
          .from(students)
          .leftJoin(users, eq(students.userId, users.id))
          .where(eq(users.adminId, id));

        if (studentsUnderAdmin.length > 0) {
          const studentUserIds = studentsUnderAdmin.map(s => s.userId);
          await tx
            .update(users)
            .set({
              isDeleted: true,
              deletedAt: new Date(),
              deletedBy: id,
              email: null,
              emailHash: null
            })
            .where(or(...studentUserIds.map(userId => eq(users.id, userId))));
        }
      }

      // Finally, soft delete the target user
      await tx
        .update(users)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: id,
          email: null,
          emailHash: null
        })
        .where(eq(users.id, id));
    });
  }

  // System Settings operations
  async getSystemSettings(): Promise<SystemSettings | undefined> {
    const [settings] = await db
      .select()
      .from(systemSettings)
      .limit(1);
    
    // If no settings exist, create default settings
    if (!settings) {
      const [defaultSettings] = await db
        .insert(systemSettings)
        .values({})
        .returning();
      return defaultSettings;
    }
    
    return settings;
  }

  async updateSystemSettings(settings: Partial<InsertSystemSettings>, updatedBy: string): Promise<SystemSettings> {
    // First check if settings exist
    const existing = await this.getSystemSettings();
    
    if (existing) {
      // Update existing settings
      const [updated] = await db
        .update(systemSettings)
        .set({
          ...settings,
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(systemSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new settings
      const [created] = await db
        .insert(systemSettings)
        .values({
          ...settings,
          updatedBy,
        })
        .returning();
      return created;
    }
  }

  async checkDatabaseStatus(): Promise<{ connected: boolean; activeConnections?: number; maxConnections?: number }> {
    try {
      // Try to execute a simple query to check connection
      const result = await db.execute(sql`SELECT 1`);
      
      // Try to get connection pool info (if available)
      const poolInfo = await db.execute(sql`
        SELECT 
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
          (SELECT setting FROM pg_settings WHERE name = 'max_connections') as max_connections
      `);
      
      const poolData = poolInfo.rows[0] as any;
      
      return {
        connected: true,
        activeConnections: parseInt(poolData?.active_connections || '0'),
        maxConnections: parseInt(poolData?.max_connections || '100'),
      };
    } catch (error) {
      return {
        connected: false,
      };
    }
  }
}

export const storage = new DatabaseStorage();
