import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  serial,
  boolean,
  integer,
  date,
  pgEnum
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (mandatory for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Enums
export const roleEnum = pgEnum("role", ["developer", "admin", "counselor", "student"]);
export const profileStatusEnum = pgEnum("profile_status", ["incomplete", "in_progress", "complete"]);
export const taskStatusEnum = pgEnum("task_status", ["pending", "in_progress", "complete"]);
export const activityStatusEnum = pgEnum("activity_status", ["planned", "in_progress", "completed", "on_hold"]);
export const activityTypeEnum = pgEnum("activity_type", ["competitions", "projects", "research", "internships", "online_courses"]);
export const documentTypeEnum = pgEnum("document_type", ["transcript", "certificate", "recommendation_letter", "essay", "portfolio", "other"]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "activity_created", 
  "activity_updated", 
  "activity_completed", 
  "task_assigned", 
  "task_completed", 
  "document_uploaded", 
  "profile_updated", 
  "event_reminder",
  "counselor_task_created",
  "counselor_task_updated",
  "counselor_task_deleted",
  "counselor_university_created",
  "counselor_university_updated",
  "counselor_university_deleted",
  "counselor_planner_event_created",
  "counselor_planner_event_deleted",
  "counselor_feedback_provided",
  "message_received",
  "password_updated"
]);
export const universityCategoryEnum = pgEnum("university_category", ["reach", "target", "safety"]);

// Users table (mandatory for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: text("email"), // Encrypted field - no unique constraint on encrypted data
  emailHash: varchar("email_hash").unique(), // HMAC-SHA256 hash for unique constraint and efficient lookups
  firstName: text("first_name"), // Encrypted field
  lastName: text("last_name"), // Encrypted field
  phoneNumber: text("phone_number"), // Encrypted field
  profileImageUrl: varchar("profile_image_url"),
  role: roleEnum("role").notNull().default("student"),
  adminId: varchar("admin_id").references((): any => users.id), // Points to the admin who manages this user
  password: varchar("password"),
  resetToken: varchar("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  pushNotificationsEnabled: boolean("push_notifications_enabled").default(true),
  pushSubscription: jsonb("push_subscription"),
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
  deletedBy: text("deleted_by").references((): any => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Students table
export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  counselorId: integer("counselor_id").references(() => counselors.id),
  adminId: varchar("admin_id").notNull().references(() => users.id, { onDelete: "cascade" }), // Points to the admin who manages this student
  adminStudentId: integer("admin_student_id").notNull(), // Sequential ID per admin starting from 1
  profileStatus: profileStatusEnum("profile_status").default("incomplete"),
  lastActivity: timestamp("last_activity").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Composite unique constraint to ensure adminStudentId is unique per admin
  adminStudentIdUnique: uniqueIndex("students_admin_student_id_unique").on(table.adminId, table.adminStudentId),
  // Index on adminId for efficient queries
  adminIdIdx: index("students_admin_id_idx").on(table.adminId),
  // Performance indexes for frequent lookups
  userIdIdx: index("students_user_id_idx").on(table.userId),
  counselorIdIdx: index("students_counselor_id_idx").on(table.counselorId),
}));

// Counselors table
export const counselors = pgTable("counselors", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  adminId: varchar("admin_id").notNull().references(() => users.id, { onDelete: "cascade" }), // The admin who manages this counselor
  adminCounselorId: integer("admin_counselor_id").notNull(), // Sequential ID per admin starting from 1
  contactEmail: text("contact_email"), // Changed to text for encryption support
  specialization: text("specialization"),
  bio: text("bio"), // Already text, good for encryption
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Composite unique constraint to ensure adminCounselorId is unique per admin
  adminCounselorIdUnique: uniqueIndex("counselors_admin_counselor_id_unique").on(table.adminId, table.adminCounselorId),
  // Index on adminId for efficient queries
  adminIdIdx: index("counselors_admin_id_idx").on(table.adminId),
  // Performance index for user lookups
  userIdIdx: index("counselors_user_id_idx").on(table.userId),
}));

// Profile field categories
export const profileFieldCategories = pgTable("profile_field_categories", {
  id: serial("id").primaryKey(),
  adminId: varchar("admin_id").references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(), // "Main Profile", "Academics", etc.
  value: varchar("value").notNull(), // "main_profile", "academics", etc.
  isDefault: boolean("is_default").default(false), // true for the 4 default categories
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
  deletedBy: text("deleted_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Profile fields configuration
export const profileFields = pgTable("profile_fields", {
  id: serial("id").primaryKey(),
  adminId: varchar("admin_id").references(() => users.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").notNull().references(() => profileFieldCategories.id, { onDelete: "cascade" }),
  fieldName: varchar("field_name").notNull(),
  fieldLabel: varchar("field_label").notNull(),
  fieldType: varchar("field_type").notNull(), // text, email, number, select, textarea, date
  isRequired: boolean("is_required").default(false),
  isEditable: boolean("is_editable").default(true),
  options: jsonb("options"), // for select fields
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
  deletedBy: text("deleted_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Student profile data
export const studentProfiles = pgTable("student_profiles", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  fieldId: integer("field_id").notNull().references(() => profileFields.id),
  value: text("value"),
  isConfirmed: boolean("is_confirmed").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  studentFieldUnique: uniqueIndex("student_field_unique").on(table.studentId, table.fieldId),
}));

// Universities
export const universities = pgTable("universities", {
  id: serial("id").primaryKey(),
  adminId: varchar("admin_id").references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  website: varchar("website"),
  overallRanking: integer("overall_ranking"),
  subjectRankings: text("subject_rankings").array(),
  courseLink: varchar("course_link"),
  location: varchar("location"),
  cityDescription: text("city_description"),
  campusSetting: varchar("campus_setting"),
  academicGrade: varchar("academic_grade"),
  safetyGrade: varchar("safety_grade"),
  tuitionFee: varchar("tuition_fee"),
  totalCostOfAttendance: varchar("total_cost_of_attendance"),
  admissionRate: varchar("admission_rate"),
  intlUndergrad: varchar("intl_undergrad"),
  intlTotal: varchar("intl_total"),
  additionalAcademicRequirements: text("additional_academic_requirements"),
  financialAidInfo: text("financial_aid_info"),
  coopInternshipPrograms: text("coop_internship_programs"),
  additionalRemarks: text("additional_remarks"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Student universities
export const studentUniversities = pgTable("student_universities", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  universityId: integer("university_id").notNull().references(() => universities.id, { onDelete: "cascade" }),
  category: universityCategoryEnum("category").notNull().default("target"),
  addedAt: timestamp("added_at").defaultNow(),
});

// Tasks
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  adminId: varchar("admin_id").references(() => users.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  counselorId: integer("counselor_id").references(() => counselors.id),
  title: varchar("title").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").default("pending"),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Performance indexes for frequent lookups
  studentIdIdx: index("tasks_student_id_idx").on(table.studentId),
  counselorIdIdx: index("tasks_counselor_id_idx").on(table.counselorId),
  adminIdIdx: index("tasks_admin_id_idx").on(table.adminId),
  dueDateIdx: index("tasks_due_date_idx").on(table.dueDate),
  // Composite indexes for optimal query performance (architect recommended)
  studentStatusDueDateIdx: index("tasks_student_status_due_date_idx").on(table.studentId, table.status, table.dueDate),
  counselorStatusDueDateIdx: index("tasks_counselor_status_due_date_idx").on(table.counselorId, table.status, table.dueDate),
  adminCreatedAtIdx: index("tasks_admin_created_at_idx").on(table.adminId, table.createdAt),
}));

// Activities
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  type: activityTypeEnum("type").notNull(),
  title: varchar("title").notNull(),
  organization: varchar("organization"),
  position: varchar("position"),
  hours: integer("hours"),
  weeks: integer("weeks"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: activityStatusEnum("status").default("planned"),
  description: text("description"),
  responsibilities: text("responsibilities"),
  learning: text("learning"),
  achievements: text("achievements"),
  skills: text("skills"),
  awards: text("awards"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Performance index for student lookups
  studentIdIdx: index("activities_student_id_idx").on(table.studentId),
}));

// Activity feedback
export const activityFeedback = pgTable("activity_feedback", {
  id: serial("id").primaryKey(),
  activityId: integer("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  counselorId: integer("counselor_id").notNull().references(() => counselors.id),
  feedback: text("feedback").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Planner events
export const plannerEvents = pgTable("planner_events", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdById: varchar("created_by_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title").notNull(),
  description: text("description"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  reminderCount: integer("reminder_count").default(0),
  reminderInterval: varchar("reminder_interval"), // minutes, hours, days
  reminderIntervalValue: integer("reminder_interval_value"), // specific number like 30, 3, 2
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Performance indexes for frequent lookups
  userIdIdx: index("planner_events_user_id_idx").on(table.userId),
  createdByIdIdx: index("planner_events_created_by_id_idx").on(table.createdById),
  startDateIdx: index("planner_events_start_date_idx").on(table.startDate),
}));

// Documents
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  counselorId: integer("counselor_id").references(() => counselors.id),
  title: varchar("title").notNull(),
  description: text("description"),
  fileName: varchar("file_name").notNull(),
  filePath: varchar("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type").notNull(),
  documentType: documentTypeEnum("document_type").notNull(),
  uploadedBy: varchar("uploaded_by").notNull(), // 'student' or 'counselor'
  isPublic: boolean("is_public").default(false), // visible to counselors/admins
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Performance indexes for frequent lookups
  studentIdIdx: index("documents_student_id_idx").on(table.studentId),
  counselorIdIdx: index("documents_counselor_id_idx").on(table.counselorId),
}));

// Notifications
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), // The user receiving the notification
  studentId: integer("student_id").references(() => students.id, { onDelete: "cascade" }), // The student this notification is about
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  relatedId: integer("related_id"), // ID of the related activity, task, etc.
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_notifications_user_id").on(table.userId),
  index("IDX_notifications_user_id_is_read").on(table.userId, table.isRead),
  index("IDX_notifications_created_at").on(table.createdAt),
  index("IDX_notifications_student_id").on(table.studentId),
  // Composite index for optimal query performance (architect recommended)
  index("IDX_notifications_user_read_created").on(table.userId, table.isRead, table.createdAt),
]);

// Messages
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  receiverId: varchar("receiver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(), // Changed to text for encryption support
  content: text("content").notNull(), // Already text, good for encryption
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Performance indexes for message queries (architect recommended)
  receiverCreatedAtIdx: index("messages_receiver_created_at_idx").on(table.receiverId, table.createdAt),
  senderCreatedAtIdx: index("messages_sender_created_at_idx").on(table.senderId, table.createdAt),
}));

// System Settings
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  // General Settings
  platformName: varchar("platform_name").default("Synergasia"),
  supportEmail: varchar("support_email").default("support@synergasia.com"),
  platformDescription: text("platform_description").default("Advanced student support platform for academic counseling"),
  maintenanceMode: boolean("maintenance_mode").default(false),
  // Database Settings
  autoBackup: boolean("auto_backup").default(true),
  queryLogging: boolean("query_logging").default(false),
  // Email Settings
  smtpHost: varchar("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpUser: text("smtp_user"), // Changed to text for encryption support
  smtpPassword: text("smtp_password"), // Changed to text for encryption support
  emailNotifications: boolean("email_notifications").default(true),
  // Security Settings
  sessionTimeout: integer("session_timeout").default(60), // in minutes
  maxLoginAttempts: integer("max_login_attempts").default(5),
  twoFactorAuth: boolean("two_factor_auth").default(false),
  passwordComplexity: boolean("password_complexity").default(true),
  // Notification Settings
  systemAlerts: boolean("system_alerts").default(true),
  userActivityAlerts: boolean("user_activity_alerts").default(false),
  performanceAlerts: boolean("performance_alerts").default(true),
  // Metadata
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  student: one(students, { fields: [users.id], references: [students.userId] }),
  counselor: one(counselors, { fields: [users.id], references: [counselors.userId] }),
  plannerEvents: many(plannerEvents),
  notifications: many(notifications),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  user: one(users, { fields: [students.userId], references: [users.id] }),
  counselor: one(counselors, { fields: [students.counselorId], references: [counselors.id] }),
  profiles: many(studentProfiles),
  universities: many(studentUniversities),
  tasks: many(tasks),
  activities: many(activities),
  documents: many(documents),
  notifications: many(notifications),
}));

export const counselorsRelations = relations(counselors, ({ one, many }) => ({
  user: one(users, { fields: [counselors.userId], references: [users.id] }),
  students: many(students),
  tasks: many(tasks),
  activityFeedback: many(activityFeedback),
  documents: many(documents),
}));

export const profileFieldCategoriesRelations = relations(profileFieldCategories, ({ many }) => ({
  profileFields: many(profileFields),
}));

export const profileFieldsRelations = relations(profileFields, ({ one, many }) => ({
  category: one(profileFieldCategories, { fields: [profileFields.categoryId], references: [profileFieldCategories.id] }),
  studentProfiles: many(studentProfiles),
}));

export const studentProfilesRelations = relations(studentProfiles, ({ one }) => ({
  student: one(students, { fields: [studentProfiles.studentId], references: [students.id] }),
  field: one(profileFields, { fields: [studentProfiles.fieldId], references: [profileFields.id] }),
}));

export const universitiesRelations = relations(universities, ({ many }) => ({
  studentUniversities: many(studentUniversities),
}));

export const studentUniversitiesRelations = relations(studentUniversities, ({ one }) => ({
  student: one(students, { fields: [studentUniversities.studentId], references: [students.id] }),
  university: one(universities, { fields: [studentUniversities.universityId], references: [universities.id] }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  student: one(students, { fields: [tasks.studentId], references: [students.id] }),
  counselor: one(counselors, { fields: [tasks.counselorId], references: [counselors.id] }),
}));

export const activitiesRelations = relations(activities, ({ one, many }) => ({
  student: one(students, { fields: [activities.studentId], references: [students.id] }),
  feedback: many(activityFeedback),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  student: one(students, { fields: [documents.studentId], references: [students.id] }),
  counselor: one(counselors, { fields: [documents.counselorId], references: [counselors.id] }),
}));

export const activityFeedbackRelations = relations(activityFeedback, ({ one }) => ({
  activity: one(activities, { fields: [activityFeedback.activityId], references: [activities.id] }),
  counselor: one(counselors, { fields: [activityFeedback.counselorId], references: [counselors.id] }),
}));

export const plannerEventsRelations = relations(plannerEvents, ({ one }) => ({
  user: one(users, { fields: [plannerEvents.userId], references: [users.id] }),
  createdBy: one(users, { fields: [plannerEvents.createdById], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  student: one(students, { fields: [notifications.studentId], references: [students.id] }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
  receiver: one(users, { fields: [messages.receiverId], references: [users.id] }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isDeleted: true,
  deletedAt: true,
  deletedBy: true,
  emailHash: true,
  resetToken: true,
  resetTokenExpiry: true,
  pushSubscription: true
}).extend({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

export const insertStudentSchema = createInsertSchema(students).omit({
  id: true,
  adminStudentId: true, // Auto-generated sequentially per admin
  createdAt: true,
});

export const insertCounselorSchema = createInsertSchema(counselors).omit({
  id: true,
  adminCounselorId: true, // Auto-generated sequentially per admin
  createdAt: true,
});

export const insertProfileFieldCategorySchema = createInsertSchema(profileFieldCategories).omit({
  id: true,
  adminId: true,
  isDeleted: true,
  deletedAt: true,
  deletedBy: true,
  createdAt: true,
});

export const insertProfileFieldSchema = createInsertSchema(profileFields).omit({
  id: true,
  isDeleted: true,
  deletedAt: true,
  deletedBy: true,
  createdAt: true,
});

export const insertUniversitySchema = createInsertSchema(universities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
}).extend({
  dueDate: z.string().nullable().optional().refine((val) => {
    if (!val) return true; // Optional field
    const utcToday = new Date().toISOString().slice(0, 10); // YYYY-MM-DD in UTC
    // Create a more permissive minimum date (UTC today minus 1 day) to accommodate all timezones
    const utcTodayDate = new Date(utcToday + 'T00:00:00.000Z');
    const minDate = new Date(utcTodayDate.getTime() - 24 * 60 * 60 * 1000);
    const minDateStr = minDate.toISOString().slice(0, 10);
    return val >= minDateStr;
  }, {
    message: "Due date cannot be in the past"
  }).transform((val) => val ? new Date(val) : undefined),
  counselorId: z.number().optional(),
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
}).extend({
  startDate: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform((val) => val ? new Date(val) : undefined),
});

export const insertPlannerEventSchema = createInsertSchema(plannerEvents).omit({
  id: true,
  createdAt: true,
  createdById: true,
}).extend({
  startDate: z.string().transform((val) => new Date(val)),
  endDate: z.string().nullable().optional().transform((val) => val ? new Date(val) : null),
  description: z.string().nullable().optional(),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertSystemSettingsSchema = createInsertSchema(systemSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Restore request schema
export const restoreRequestSchema = z.object({
  email: z.string().email("Please provide a valid email address").min(1, "Email is required"),
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof students.$inferSelect;
export type InsertCounselor = z.infer<typeof insertCounselorSchema>;
export type Counselor = typeof counselors.$inferSelect;
export type InsertProfileFieldCategory = z.infer<typeof insertProfileFieldCategorySchema>;
export type ProfileFieldCategory = typeof profileFieldCategories.$inferSelect;
export type InsertProfileField = z.infer<typeof insertProfileFieldSchema>;
export type ProfileField = typeof profileFields.$inferSelect;
export type StudentProfile = typeof studentProfiles.$inferSelect;
export type InsertUniversity = z.infer<typeof insertUniversitySchema>;
export type University = typeof universities.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;
export type ActivityFeedback = typeof activityFeedback.$inferSelect;
export type InsertPlannerEvent = z.infer<typeof insertPlannerEventSchema>;
export type PlannerEvent = typeof plannerEvents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
export type StudentUniversity = typeof studentUniversities.$inferSelect;
export type UniversityCategory = "reach" | "target" | "safety";
export type InsertSystemSettings = z.infer<typeof insertSystemSettingsSchema>;
export type SystemSettings = typeof systemSettings.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
