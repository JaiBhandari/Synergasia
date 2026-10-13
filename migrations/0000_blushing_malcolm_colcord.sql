CREATE TYPE "public"."activity_status" AS ENUM('planned', 'in_progress', 'completed', 'on_hold');--> statement-breakpoint
CREATE TYPE "public"."activity_type" AS ENUM('competitions', 'projects', 'research', 'internships', 'online_courses');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('transcript', 'certificate', 'recommendation_letter', 'essay', 'portfolio', 'other');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('activity_created', 'activity_updated', 'activity_completed', 'task_assigned', 'task_completed', 'document_uploaded', 'profile_updated', 'event_reminder', 'counselor_task_created', 'counselor_task_updated', 'counselor_task_deleted', 'counselor_university_created', 'counselor_university_updated', 'counselor_university_deleted', 'counselor_planner_event_created', 'counselor_planner_event_deleted', 'counselor_feedback_provided', 'message_received', 'password_updated');--> statement-breakpoint
CREATE TYPE "public"."profile_status" AS ENUM('incomplete', 'in_progress', 'complete');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('developer', 'admin', 'counselor', 'student');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pending', 'in_progress', 'complete');--> statement-breakpoint
CREATE TYPE "public"."university_category" AS ENUM('reach', 'target', 'safety');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"type" "activity_type" NOT NULL,
	"title" varchar NOT NULL,
	"organization" varchar,
	"position" varchar,
	"hours" integer,
	"weeks" integer,
	"start_date" timestamp,
	"end_date" timestamp,
	"status" "activity_status" DEFAULT 'planned',
	"description" text,
	"responsibilities" text,
	"learning" text,
	"achievements" text,
	"skills" text,
	"awards" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "activity_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"activity_id" integer NOT NULL,
	"counselor_id" integer NOT NULL,
	"feedback" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "counselors" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"admin_id" varchar NOT NULL,
	"admin_counselor_id" integer NOT NULL,
	"contact_email" text,
	"specialization" text,
	"bio" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"counselor_id" integer,
	"title" varchar NOT NULL,
	"description" text,
	"file_name" varchar NOT NULL,
	"file_path" varchar NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar NOT NULL,
	"document_type" "document_type" NOT NULL,
	"uploaded_by" varchar NOT NULL,
	"is_public" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" varchar NOT NULL,
	"receiver_id" varchar NOT NULL,
	"subject" text NOT NULL,
	"content" text NOT NULL,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"student_id" integer,
	"type" "notification_type" NOT NULL,
	"title" varchar NOT NULL,
	"message" text NOT NULL,
	"related_id" integer,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "planner_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"created_by_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"reminder_count" integer DEFAULT 0,
	"reminder_interval" varchar,
	"reminder_interval_value" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "profile_field_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" varchar,
	"name" varchar NOT NULL,
	"value" varchar NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "profile_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" varchar,
	"category_id" integer NOT NULL,
	"field_name" varchar NOT NULL,
	"field_label" varchar NOT NULL,
	"field_type" varchar NOT NULL,
	"is_required" boolean DEFAULT false,
	"is_editable" boolean DEFAULT true,
	"options" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"field_id" integer NOT NULL,
	"value" text,
	"is_confirmed" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "student_universities" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"university_id" integer NOT NULL,
	"category" "university_category" DEFAULT 'target' NOT NULL,
	"added_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"counselor_id" integer,
	"admin_id" varchar NOT NULL,
	"admin_student_id" integer NOT NULL,
	"profile_status" "profile_status" DEFAULT 'incomplete',
	"last_activity" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform_name" varchar DEFAULT 'Synergasia',
	"support_email" varchar DEFAULT 'support@synergasia.com',
	"platform_description" text DEFAULT 'Advanced student support platform for academic counseling',
	"maintenance_mode" boolean DEFAULT false,
	"auto_backup" boolean DEFAULT true,
	"query_logging" boolean DEFAULT false,
	"smtp_host" varchar,
	"smtp_port" integer,
	"smtp_user" text,
	"smtp_password" text,
	"email_notifications" boolean DEFAULT true,
	"session_timeout" integer DEFAULT 60,
	"max_login_attempts" integer DEFAULT 5,
	"two_factor_auth" boolean DEFAULT false,
	"password_complexity" boolean DEFAULT true,
	"system_alerts" boolean DEFAULT true,
	"user_activity_alerts" boolean DEFAULT false,
	"performance_alerts" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" varchar
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" varchar,
	"student_id" integer NOT NULL,
	"counselor_id" integer,
	"title" varchar NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'pending',
	"due_date" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "universities" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" varchar,
	"name" varchar NOT NULL,
	"website" varchar,
	"overall_ranking" integer,
	"subject_rankings" text[],
	"course_link" varchar,
	"location" varchar,
	"city_description" text,
	"campus_setting" varchar,
	"academic_grade" varchar,
	"safety_grade" varchar,
	"tuition_fee" varchar,
	"total_cost_of_attendance" varchar,
	"admission_rate" varchar,
	"intl_undergrad" varchar,
	"intl_total" varchar,
	"additional_academic_requirements" text,
	"financial_aid_info" text,
	"coop_internship_programs" text,
	"additional_remarks" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"email" text,
	"email_hash" varchar,
	"first_name" text,
	"last_name" text,
	"phone_number" text,
	"profile_image_url" varchar,
	"role" "role" DEFAULT 'student' NOT NULL,
	"admin_id" varchar,
	"password" varchar,
	"reset_token" varchar,
	"reset_token_expiry" timestamp,
	"push_notifications_enabled" boolean DEFAULT true,
	"push_subscription" jsonb,
	"is_deleted" boolean DEFAULT false,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_hash_unique" UNIQUE("email_hash")
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_feedback" ADD CONSTRAINT "activity_feedback_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_feedback" ADD CONSTRAINT "activity_feedback_counselor_id_counselors_id_fk" FOREIGN KEY ("counselor_id") REFERENCES "public"."counselors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counselors" ADD CONSTRAINT "counselors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counselors" ADD CONSTRAINT "counselors_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_counselor_id_counselors_id_fk" FOREIGN KEY ("counselor_id") REFERENCES "public"."counselors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_events" ADD CONSTRAINT "planner_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_events" ADD CONSTRAINT "planner_events_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_field_categories" ADD CONSTRAINT "profile_field_categories_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_fields" ADD CONSTRAINT "profile_fields_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_fields" ADD CONSTRAINT "profile_fields_category_id_profile_field_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."profile_field_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_field_id_profile_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."profile_fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_universities" ADD CONSTRAINT "student_universities_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_universities" ADD CONSTRAINT "student_universities_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_counselor_id_counselors_id_fk" FOREIGN KEY ("counselor_id") REFERENCES "public"."counselors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_counselor_id_counselors_id_fk" FOREIGN KEY ("counselor_id") REFERENCES "public"."counselors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "universities" ADD CONSTRAINT "universities_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_student_id_idx" ON "activities" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "counselors_admin_counselor_id_unique" ON "counselors" USING btree ("admin_id","admin_counselor_id");--> statement-breakpoint
CREATE INDEX "counselors_admin_id_idx" ON "counselors" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "counselors_user_id_idx" ON "counselors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "documents_student_id_idx" ON "documents" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "documents_counselor_id_idx" ON "documents" USING btree ("counselor_id");--> statement-breakpoint
CREATE INDEX "messages_receiver_created_at_idx" ON "messages" USING btree ("receiver_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_sender_created_at_idx" ON "messages" USING btree ("sender_id","created_at");--> statement-breakpoint
CREATE INDEX "IDX_notifications_user_id" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_notifications_user_id_is_read" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "IDX_notifications_created_at" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "IDX_notifications_student_id" ON "notifications" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "IDX_notifications_user_read_created" ON "notifications" USING btree ("user_id","is_read","created_at");--> statement-breakpoint
CREATE INDEX "planner_events_user_id_idx" ON "planner_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "planner_events_created_by_id_idx" ON "planner_events" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "planner_events_start_date_idx" ON "planner_events" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE UNIQUE INDEX "student_field_unique" ON "student_profiles" USING btree ("student_id","field_id");--> statement-breakpoint
CREATE UNIQUE INDEX "students_admin_student_id_unique" ON "students" USING btree ("admin_id","admin_student_id");--> statement-breakpoint
CREATE INDEX "students_admin_id_idx" ON "students" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "students_user_id_idx" ON "students" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "students_counselor_id_idx" ON "students" USING btree ("counselor_id");--> statement-breakpoint
CREATE INDEX "tasks_student_id_idx" ON "tasks" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "tasks_counselor_id_idx" ON "tasks" USING btree ("counselor_id");--> statement-breakpoint
CREATE INDEX "tasks_admin_id_idx" ON "tasks" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "tasks_due_date_idx" ON "tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "tasks_student_status_due_date_idx" ON "tasks" USING btree ("student_id","status","due_date");--> statement-breakpoint
CREATE INDEX "tasks_counselor_status_due_date_idx" ON "tasks" USING btree ("counselor_id","status","due_date");--> statement-breakpoint
CREATE INDEX "tasks_admin_created_at_idx" ON "tasks" USING btree ("admin_id","created_at");