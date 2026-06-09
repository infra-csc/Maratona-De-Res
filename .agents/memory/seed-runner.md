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

# ⚠️ The seed can NEVER destroy synced (ERP) data — absolute guard
If ANY integration data exists (events with `external_id`, or employees with `source_type='erp'`), the seed aborts immediately. **There is NO env flag that overrides this** — `FORCE_SEED` / `WIPE_INTEGRATION` were removed as bypasses. The seed only ever populates a demo DB that has zero integration data.

**Why:** reflexively running the seed (incl. `FORCE_SEED=1`) to refresh demo fixtures wiped the user's synced production data more than once ("perdemos o que sincronizamos"); the user demanded it be impossible. The only way to clear a DB with integration data is a deliberate manual SQL action.

**Recovery if data is ever lost:** re-run the external sync — `POST /api/integration/sync` authenticated as an admin/rh user — which re-imports employees/events/participations from the external app. Idempotent.

**Other delete paths are single-row admin actions only** (DELETE event-by-id, DELETE participant-by-id in routes/events.ts) — no other mass-delete of employees/events exists. Post-merge reconcile (`scripts/post-merge.sh`) runs only `pnpm install` + `db push` (no seed).
