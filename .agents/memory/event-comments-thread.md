---
name: Event general comments thread
description: Open (no-role-gate) comment thread per event; requires prod DB schema push before deploying, since it's a brand-new table.
---

Added a general-purpose comment thread scoped to an event (`event_comments` table), separate from the
existing per-participant diária-justification comment box. Any authenticated user can read/post; only the
comment author or admin/rh can delete.

**Why:** user wanted a shared discussion channel visible to all roles on the event-detail page, distinct
from the manager-only participant comment box (which stays role-gated per `confidential-endpoint-gating.md`).

**How to apply:**
- When adding a brand-new table via `lib/db` schema + `pnpm run push`, that push only touches the **dev**
  database. Before/at the next deploy that ships routes depending on the new table, the same schema change
  must be applied to the **production** database (see `database` skill for pushing dev schema to prod) —
  otherwise the new routes will 500 with "relation does not exist" as soon as they're hit in prod.
- Routes with intentionally no role gate (like this one) are the exception to the rule in
  `confidential-endpoint-gating.md`; document explicitly in code/comments why no `requireRole` is applied,
  so a future pass doesn't "fix" it by accident.
