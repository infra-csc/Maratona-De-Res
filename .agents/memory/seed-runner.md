---
name: Seed runner pattern
description: How to run the Maratona api-server seed script, and the ordering constraint it must respect
---

# Rule
The api-server has no `tsx` in its devDependencies, so run the seed with the workspace-level tsx binary (resolve it relative to the repo root rather than hardcoding an absolute path):
`./scripts/node_modules/.bin/tsx artifacts/api-server/src/seed.ts` (run from the workspace root).

The seed must wipe existing data in reverse foreign-key order BEFORE inserting, or FK constraints fail.

**Why:** Re-running the seed on a populated DB otherwise errors on FK references; and using a missing local `tsx` fails outright.

**How to apply:** Re-seeding resets serial IDs — downstream tests that hardcode IDs must be updated (e.g. the two closed demo events come back as the first two event IDs after a fresh seed).

# ⚠️ NEVER destroy synced (ERP) data with the seed
The seed guards integration data (events with `external_id`, employees with `source_type='erp'`). The plain seed REFUSES to run when such data exists.

**`FORCE_SEED=1` alone does NOT bypass this anymore** — it still preserves integration data. Destroying synced data now requires BOTH `FORCE_SEED=1` AND `WIPE_INTEGRATION=1`. **Why:** reflexively running `FORCE_SEED=1` to refresh demo fixtures wiped the user's synced production data more than once ("perdemos o que sincronizamos"). Never reach for the wipe flags on a DB holding real synced data — to recover, re-run the external sync (`POST /api/integration/sync` as admin/rh), which re-imports employees/events/participations from the external app.

**How to apply:** to test fixtures, use a DB without integration data, or test against existing data. Treat `WIPE_INTEGRATION=1` as effectively never-for-this-project.
