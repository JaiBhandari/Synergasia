---
name: Express 5 wildcard routes
description: Express 5 uses path-to-regexp v8 which requires named wildcards; bare * no longer works.
---

## The rule
In Express 5, `app.use("*", handler)` / `app.get("*", handler)` must be changed to use named wildcards:
- `app.use("/{*splat}", handler)` — catch-all middleware
- `app.get("/{*splat}", handler)` — catch-all GET route

**Why:** Express 5 upgraded to path-to-regexp v8 which dropped support for bare `*` wildcards and requires all wildcards to be named.

**How to apply:** Search for `app.use("*"` or `router.use("*"` in server code when doing an Express upgrade.

## In this project
Fixed in `server/vite.ts` — two catch-all handlers (one for dev Vite SSR, one for production static file serving).
