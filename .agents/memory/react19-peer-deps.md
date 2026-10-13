---
name: React 19 peer dep conflicts
description: Which packages have stale react@^18 peer deps after upgrading to React 19, and how to handle them.
---

## The rule
After upgrading to React 19, `npm ci` will fail unless `--legacy-peer-deps` is passed, because two packages declare strict `react@^18` peers:
- `react-day-picker@8` — peer: `react@^16.8 || ^17 || ^18`
- `framer-motion@11` — peer: `react@^18`

Both work fine at runtime with React 19; the peer dep metadata is just outdated.

**Why:** The packages haven't released new semver ranges to include ^19, so npm's strict peer dep resolver rejects the tree.

**How to apply:** The post-merge script already uses `npm ci --legacy-peer-deps`. Any manual `npm install` or `npm ci` commands during development should also include `--legacy-peer-deps` until these are properly upgraded.

## Proper long-term fix
- `react-day-picker`: upgrade to v9+ (peer dep becomes `>=16.8.0`). Requires rewriting `client/src/components/ui/calendar.tsx` — all class names changed between v8 and v9 (caption_label → month_caption, head_row → weekdays, etc.) and `components.IconLeft/IconRight` → `Chevron`. Tracked as follow-up task #32 area.
- `framer-motion`: upgrade to v12 (peer dep becomes `^18 || ^19`). No direct imports in the codebase — only a transitive dep via vaul/cmdk.
