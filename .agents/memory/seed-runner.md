---
name: Seed runner pattern
description: How to run the Maratona api-server seed script, and the ordering constraint it must respect
---

# Rule
The api-server has no `tsx` in its devDependencies, so run the seed with the workspace-level tsx binary:
`/home/runner/workspace/scripts/node_modules/.bin/tsx artifacts/api-server/src/seed.ts`

The seed must wipe existing data in reverse foreign-key order BEFORE inserting, or FK constraints fail.

**Why:** Re-running the seed on a populated DB otherwise errors on FK references; and using a missing local `tsx` fails outright.

**How to apply:** Re-seeding resets serial IDs — downstream tests that hardcode IDs must be updated (e.g. the two closed demo events come back as the first two event IDs after a fresh seed).
