---
name: Post-merge script config
description: Current post-merge script setup, timeout, and why --legacy-peer-deps is needed.
---

## Current config
- Script: `scripts/post-merge.sh`
- Timeout: 60,000 ms (60s)
- Commands: `npm ci --legacy-peer-deps` then `npm run db:push`

**Why --legacy-peer-deps:** React 19 peer dep conflicts with react-day-picker@8 and framer-motion@11 — see react19-peer-deps.md.

**Why 60s timeout:** `npm ci` takes ~22-25s on this project (713 packages). The previous 20s timeout caused failures. 60s gives ample headroom.
