# Synergasia - Student Profile Tracking System

## Overview
Synergasia is a comprehensive web application designed for student counseling and profile management. It provides role-based access for administrators, counselors, and students, facilitating student profile tracking, task management, activity monitoring, and university application planning. The system aims to streamline student guidance processes, enhance communication, and support university application processes.

## User Preferences
Preferred communication style: Simple, everyday language.
Design preference: Clean, minimal Notion-like aesthetic with off-white backgrounds, subtle colors, and refined typography.

## System Architecture

### UI/UX Decisions
The application features a clean, minimal Notion-like aesthetic with an off-white background (hsl 0,0%,99%), subtle grays for borders, and a vibrant blue primary color (hsl 221,83%,53%). It uses Inter for body text and Playfair Display for branding. UI components have an increased border-radius of 0.75rem. The login page and sidebar have been visually overhauled for a modern feel. Custom shadow utilities (shadow-minimal, shadow-soft, shadow-elevated) are used for depth, and semantic color tokens ensure consistency across light and dark modes. Push notifications are implemented for real-time updates.

### Technical Implementations
-   **Frontend**: React 18 with TypeScript, Vite, Radix UI components styled with shadcn/ui and Tailwind CSS. State management uses TanStack Query, routing uses Wouter, and form handling is managed by React Hook Form with Zod validation.
-   **Backend**: Node.js with Express.js and TypeScript (ES modules). Drizzle ORM is used with a PostgreSQL database (Neon serverless).
-   **Authentication**: Initially Replit Auth with OpenID Connect, now uses email/password. Express sessions with PostgreSQL storage manage sessions.
-   **Security**: bcrypt for password hashing and comprehensive role-based access control (developer, admin, counselor, student). Role-based authorization is enforced for data access and modifications (e.g., counselors can only update students assigned to them and only specific fields). Counselors cannot be deleted if students are assigned to them.
-   **Notifications**: Implemented device push notifications and in-app notifications for tasks, messages, activity feedback, and event reminders. Event reminders are sent one day before scheduled planner events. Admins receive notifications for various counselor activities.
-   **Dynamic Profile Fields**: Admins can configure custom profile fields for students, with proper scoping to ensure students only see fields relevant to their assigned admin.
-   **Task & Activity Management**: Features include assigning, tracking, and completing student tasks and activities with robust cache invalidation for immediate UI updates. Automatic planner events are created when tasks with due dates are assigned. Pagination supported for task lists.
-   **University Management**: Comprehensive university information fields with admin-scoped lists, ensuring students only see universities relevant to their assigned admin.
-   **AI Information Extraction System**: Fully automated university data extraction system that:
    - Extracts ALL available information fields from multiple sources (official website, Common Data Set, web search)
    - Stores complete data in database regardless of admin selection
    - Displays only admin-selected fields in UI while preserving all extracted data
    - Focuses on extracting specific factual information (actual program names, exact figures, specific rankings)
    - Uses enhanced AI prompts for comprehensive and accurate data extraction
-   **Email System**: Uses database-stored SMTP settings for notifications, password resets, and reminders.
-   **Planner Management**: Calendar view with scrollable event creation forms for both Admin and Counselor portals. Event highlighting standardized across portals (text color only, no background fill).

### Feature Specifications
-   **Role-Based Access**: Distinct functionalities for Developer, Admin, Counselor, and Student roles.
-   **Database Schema**: Comprehensive schema covering Users, Students, Counselors, Profile Fields, Universities, Tasks, Activities, and Planner Events.
-   **Document Management**: Secure document upload, editing, and deletion with role-based visibility (though not detailed in the provided changes, it is a core feature).
-   **Multi-Tenancy**: Supports multiple independent counseling firms with data isolation per admin.
-   **Data Integrity Constraints**: Counselors with assigned students cannot be deleted - validation enforced at both backend and frontend.

## External Dependencies

### Core
-   **@neondatabase/serverless**: Neon PostgreSQL client
-   **@tanstack/react-query**: Server state management
-   **@radix-ui/react-\*\*\***: UI component library
-   **drizzle-orm**: ORM for database operations
-   **bcrypt**: Password hashing
-   **nodemailer**: Email sending
-   **express-session**: Session management middleware
-   **web-push**: For push notification functionality

### Development
-   **vite**: Build tool and development server
-   **typescript**: Static type checking
-   **tailwindcss**: CSS framework

### Authentication
-   **connect-pg-simple**: PostgreSQL session store

## Security Status

### Dependency Audit
- Last audited: June 2026
- Status: **0 vulnerabilities** (all severities)
- CI gate: `npm audit --audit-level=high` (registered as `security-audit` validation)

### Notes
`npm audit` reports 0 vulnerabilities as of June 2026. Previous advisories for `esbuild`, `@tootallnate/once`, `vite`, `ws`, `form-data`, `multer`, and `nodemailer` have all been resolved via upstream package updates and `npm audit fix`.

**Automated monitoring**: Dependabot is configured (`.github/dependabot.yml`) to open pull requests for dependency updates weekly (every Monday). Minor and patch updates are grouped into a single PR; major version bumps are excluded and must be reviewed manually. The GitHub Actions workflow (`.github/workflows/dependency-audit.yml`) automatically runs `npm audit --audit-level=high` on every pull request that touches `package.json` or `package-lock.json`, so no vulnerable dependency can be merged without the audit gate passing first.

**Major version tracking**: Because Dependabot skips major bumps, a manual review process is required for critical packages. See `docs/major-version-tracker.md` for the current version gap table and instructions. Review quarterly by running `npm outdated`, updating the table, and planning any needed migrations before packages fall too far behind.
