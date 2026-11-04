---
name: Drizzle alias not available in v0.45.2
description: alias() is not exported from drizzle-orm in the installed version; use a separate enrichment query for same-table joins
---

drizzle-orm v0.45.2 does NOT export `alias` from the main `drizzle-orm` module.
Attempting to import `alias` causes an esbuild build error: "No matching export".

**Why:** The version installed predates or omits this export from the top-level barrel.

**How to apply:** For queries that need to join the same table twice (e.g., join `users` both for `assignedToId` and `redirectedFromId`):
1. Run the main query joining the table once for the primary FK
2. Collect the unique IDs for the secondary FK
3. Run a second `db.select()` on the same table for those IDs
4. Merge the results in-memory with a Map

Example pattern (criterion-assignments redirectedFromName):
```ts
const redirectFromIds = [...new Set(rows.map(r => r.redirectedFromId).filter(Boolean))];
const redirectUsers = redirectFromIds.length > 0
  ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, redirectFromIds))
  : [];
const nameMap = new Map(redirectUsers.map(u => [u.id, u.name]));
const enriched = rows.map(r => ({ ...r, redirectedFromName: nameMap.get(r.redirectedFromId ?? -1) ?? null }));
```
