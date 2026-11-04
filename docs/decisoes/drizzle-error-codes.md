---
name: Drizzle wraps pg error codes
description: How to detect Postgres error codes (FK violation etc.) from drizzle-orm queries
---
Rule: drizzle-orm wraps the underlying `pg` error, so `err.code` is undefined on the caught error; the Postgres code (e.g. `23503` FK violation, `23505` unique violation) lives in `err.cause.code`. Always check `e.code ?? e.cause?.code`.

**Why:** first attempt at a friendly "cannot delete user with history" handler still 500'd because only `err.code` was checked.

**How to apply:** any route that catches DB errors to translate them into user-facing 400s (deletes blocked by FKs, duplicate inserts) must read the code via `e.code ?? e.cause?.code`.

Related: users can't be hard-deleted once they have audit/eval history (audit_logs.user_id, evaluations.evaluator_user_id, etc. reference users). DELETE /users returns a friendly 400 telling admin to deactivate instead.
