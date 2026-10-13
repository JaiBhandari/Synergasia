# Threat Model

## Project Overview

Synergasia is a public-facing multi-tenant student counseling platform built with a React frontend and a Node/Express backend backed by PostgreSQL. It handles student profiles, counseling workflows, documents, messages, planner events, notifications, password resets, and developer/admin management features. Production scope for this scan is the deployed Express app and its backing data stores and secrets; mockups, screenshots, tests, and other dev-only artifacts are out of scope unless production reachability is demonstrated.

## Assets

- **User accounts and sessions** — user IDs, roles, password hashes, session cookies, reset tokens, and push subscriptions. Compromise enables account takeover and privilege abuse.
- **Student and counselor records** — profile data, contact details, application planning data, activities, feedback, and documents. This is sensitive educational and personal data.
- **Tenant boundaries** — each admin’s students, counselors, universities, tasks, and settings must remain isolated from every other admin’s tenant.
- **Uploaded documents** — transcripts, certificates, essays, recommendation letters, portfolios, and other files that may contain sensitive student information.
- **Operational secrets** — database credentials, encryption key material, session secret, SendGrid/VAPID credentials, and SMTP credentials. Exposure can collapse all higher-level controls.
- **Developer controls** — developer-only admin management and system settings endpoints can impact every tenant.

## Trust Boundaries

- **Browser to Express API** — all request data is attacker-controlled until validated and authorized server-side.
- **Session/OIDC boundary** — requests may arrive via local session auth or Replit OIDC; both paths must converge on the same authorization guarantees.
- **Role boundary** — developer, admin, counselor, and student roles have materially different privileges that must be enforced server-side on every route.
- **Tenant boundary** — admins must only access their own tenant’s data; counselors must only access assigned students; students must only access their own records.
- **Server to PostgreSQL** — the application can read and mutate all tenant data plus sessions and reset tokens.
- **Server to filesystem/object storage/email/push providers** — uploads, email, and push payloads cross external trust boundaries and can expose sensitive content if mis-scoped.

## Scan Anchors

- **Production entry points**: `server/index.ts`, `server/routes.ts`, `server/replitAuth.ts`, `server/storage.ts`
- **Highest-risk areas**: hybrid auth/session handling, password reset flows, tenant-scoped student routes, document upload/download routes, developer/system-settings routes, secret handling in config
- **Public vs authenticated vs admin surfaces**: `/`, `/api/auth/*`, `/api/push/vapid-public-key` are public; most `/api/*` routes are authenticated; developer controls live under `/api/developer/*` and `/api/system-settings`
- **Legacy generic route bypasses to re-check on future scans**: older generic endpoints such as `/api/students/:id/activities` and `/api/planner/:id` coexist with newer admin-scoped/student-scoped variants and can bypass the stricter authorization model if they remain enabled
- **Usually dev-only / ignore unless proven reachable**: `tests/`, `attached_assets/`, local screenshots, migration helpers, mockup HTML not served by production routes

## Threat Categories

### Spoofing

The application supports two authentication modes: local session-based login and Replit OIDC. Both paths must produce trustworthy server-side identity, and protected routes must not rely on client state. Session secrets and reset tokens must be unpredictable, kept out of source control, and scoped so attackers cannot forge or reuse them.

### Tampering

Authenticated users can update profiles, tasks, activities, planner events, messages, documents, and system settings. Every write endpoint must validate input and must recompute authorization from trusted server-side records rather than accepting cross-tenant IDs or role claims from the client.

### Information Disclosure

The system stores sensitive student data and documents for multiple independent counseling firms. Server routes must enforce both role checks and tenant scoping before returning records or files. Secrets and operational credentials must never be committed to tracked config, and API responses or logs must not leak reset credentials, decrypted PII, or infrastructure internals.

### Denial of Service

Public auth and recovery flows are attractive abuse targets for brute force and spam. Login and password-reset endpoints must be rate-limited on the actual production paths, and uploads must remain bounded by size and type so unauthenticated or low-privilege users cannot exhaust backend resources.

### Elevation of Privilege

This project’s main risk is broken access control across role and tenant boundaries. Student-scoped and document-scoped endpoints must verify that the authenticated caller is the owning student, the assigned counselor, or the correct tenant admin/developer for the requested object. Any bypass here exposes cross-tenant data and may let one tenant alter another tenant’s records.
