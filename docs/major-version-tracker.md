# Major Dependency Version Tracker

Dependabot is configured to auto-update **minor and patch** versions only. Major version bumps are excluded and must be reviewed and migrated manually. This document tracks the current major version of each critical dependency so the gap to the latest release is always visible.

**How to use:**
1. Run `npm outdated` periodically (e.g. quarterly) to see what major versions are available.
2. Update the "Latest Major" column and the "Last checked" date in the Review Log below.
3. When a major gap opens, add a migration note and plan the upgrade.
4. After upgrading, bump the "In Use" column and clear the migration note.

**Last verified:** 2026-06-22 via `https://registry.npmjs.org/<pkg>/latest`

---

## Core Runtime Dependencies

| Package | In Use (Major) | Latest Major | Gap? | Migration Notes |
|---|---|---|---|---|
| `react` | **19** | 19 | ✅ Current | Upgraded 2026-06-22. `createRoot` already in use; `forwardRef` deprecated but functional; no breaking changes required. |
| `react-dom` | **19** | 19 | ✅ Current | Upgraded 2026-06-22 together with `react`. |
| `vite` | 6 | **8** | 🚨 2 majors behind | Two major versions behind — prioritise; review `vite.config.ts` and plugin compatibility; do NOT modify `server/vite.ts` without care |
| `express` | **5** | 5 | ✅ Current | Upgraded 2026-06-22. Fixed `app.use("*", ...)` wildcard routes in `server/vite.ts` to use `/{*splat}` (path-to-regexp v8). |
| `tailwindcss` | 3 | 4 | ⚠️ Yes | Tailwind v4 uses CSS-first config; significant migration effort — audit `tailwind.config.ts` and all custom utilities |
| `zod` | 3 | 4 | ⚠️ Yes | Zod v4 has API changes; review all schema definitions in `shared/schema.ts` and `drizzle-zod` compatibility |
| `typescript` | 5 | 6 | ⚠️ Yes | Review breaking type changes; test with `npm run check` after upgrade |
| `drizzle-orm` | 0.x (pre-1.0) | 0.x (pre-1.0) | ✅ Current | Still pre-1.0; monitor for 1.0 stable release |
| `drizzle-kit` | 0.x (pre-1.0) | 0.x (pre-1.0) | ✅ Current | Upgrade together with `drizzle-orm` |
| `@tanstack/react-query` | 5 | 5 | ✅ Current | Monitor for v6 |

## Authentication & Sessions

| Package | In Use (Major) | Latest Major | Gap? | Migration Notes |
|---|---|---|---|---|
| `openid-client` | 6 | 6 | ✅ Current | — |
| `passport` | 0.x | 0.x | ✅ Current | — |
| `express-session` | 1 | 1 | ✅ Current | — |
| `connect-pg-simple` | 10 | 10 | ✅ Current | — |
| `bcrypt` | 6 | 6 | ✅ Current | — |

## Data & API

| Package | In Use (Major) | Latest Major | Gap? | Migration Notes |
|---|---|---|---|---|
| `pg` | 8 | 8 | ✅ Current | — |
| `@neondatabase/serverless` | 0.x (pre-1.0) | **1** | ⚠️ Yes | Now has a stable 1.x release; review changelog before upgrading |
| `openai` | 5 | 6 | ⚠️ Yes | Review SDK API changes; audit all AI extraction calls in server code |
| `nodemailer` | 9 | 9 | ✅ Current | — |
| `web-push` | 3 | 3 | ✅ Current | — |

## Frontend Utilities

| Package | In Use (Major) | Latest Major | Gap? | Migration Notes |
|---|---|---|---|---|
| `react-hook-form` | 7 | 7 | ✅ Current | — |
| `@hookform/resolvers` | 3 | **5** | 🚨 2 majors behind | Two major versions behind — upgrade together with `react-hook-form`; review resolver API changes |
| `wouter` | 3 | 3 | ✅ Current | — |
| `date-fns` | 3 | 4 | ⚠️ Yes | Review function signature changes before upgrading |
| `framer-motion` | 11 | 12 | ⚠️ Yes | Review breaking animation API changes |
| `recharts` | 2 | 3 | ⚠️ Yes | Review chart component API changes in v3 |

---

## Review Log

| Date | Notes |
|---|---|
| 2026-06-22 | Initial setup. Versions fetched from npm registry. Gaps identified: `vite` (6→8), `@hookform/resolvers` (3→5), `react` (18→19), `express` (4→5), `tailwindcss` (3→4), `zod` (3→4), `typescript` (5→6), `openai` (5→6), `@neondatabase/serverless` (0.x→1.x), `date-fns` (3→4), `framer-motion` (11→12), `recharts` (2→3). |
| 2026-06-22 | Upgraded `react`/`react-dom` 18→19 and `express` 4→5. Fixed `app.use("*")` wildcard routes in `server/vite.ts` for Express 5 / path-to-regexp v8 compatibility (`/{*splat}`). Build passes, 38/38 tests pass, 0 security vulnerabilities. |

---

## How to refresh this table

```bash
# Show all packages with available upgrades (including major)
npm outdated

# Check a specific package's latest version
npm show <package-name> version

# Check all dist-tags for a package
npm show <package-name> dist-tags
```

After reviewing, update the table above and add an entry to the Review Log.
