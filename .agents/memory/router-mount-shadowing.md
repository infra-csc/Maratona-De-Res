---
name: Router mount-order shadowing
description: Express sub-routers with a blanket router.use(requireRole...) 403 every fall-through request mounted after them
---

# Router mount-order shadowing (Express footgun)

In `api-server/src/routes/index.ts`, every feature router is mounted on one parent
router with `router.use(xRouter)` (no path prefix). A sub-router that begins with a
blanket `router.use(requireRole("admin","rh"))` (e.g. `audit.ts`, `integration.ts`)
runs that guard for EVERY request that reaches it — because `router.use` matches all
paths. Any request that wasn't already handled by an earlier-mounted router falls
through into that guard and gets a 403 "Acesso negado" before reaching routers
mounted later.

**Symptom:** a valid, authenticated non-admin/rh user gets 403 on an endpoint whose
own router has NO role guard. The 403 actually comes from `requireRole` inside an
*earlier-mounted* router (audit/integration), not from the target router.

**Why:** `router.use(subRouter)` with no path == mounted at "/", so the sub-router's
own `router.use(mw)` middleware fires for all fall-through traffic, not just the
sub-router's declared routes.

**How to apply:**
- Mount any router that must be reachable by non-admin/rh roles BEFORE the first
  blanket-`requireRole` router (currently audit, then integration). Storage is
  mounted right after auth for exactly this reason; it carries its own guards
  (requireAuth on POST upload-url; public GET for `<audio>` playback).
- Better long-term fix (NOT yet done): mount guarded routers with explicit path
  prefixes (`router.use("/audit", auditRouter)`) or apply `requireRole` per-endpoint
  instead of blanket `router.use`. Until then, `exports`, `my-performance`,
  `feedback`, `eligibility` remain shadowed for non-admin/rh (pre-existing).
