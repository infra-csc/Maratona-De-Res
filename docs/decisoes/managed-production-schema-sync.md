---
name: Managed production schema sync
description: Resolve conflicting migration guidance for this app's Replit-managed production database.
---

For this project's managed production database, apply schema changes to the development database and let Replit's Publish flow review and apply the development-to-production schema diff. Do not run the repository's manual `migrate:deploy` instructions against production or add deploy-time/startup schema mutation.

**Why:** The repository migration README describes manual production migrations, but the live production database is Replit-managed and exposes only read-only access to the agent. A published API failed when its schema expected columns absent from both development and production; the Publish diff showed two additive columns after development was brought up to date.

**How to apply:** When a deployed route reports a missing column, confirm the actual schemas with read-only queries, make the development schema match the code's source of truth, inspect the Publish diff for destructive operations, then ask the user to publish. Treat manual migration instructions as inapplicable to managed production.