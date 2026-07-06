---
name: Participation scoring exclusion (freela / informational functions)
description: How freela employees and "Sup Ceno *" functions participate in events without counting toward scoring/eligibility
---

Some event participants are informational-only: they appear in the team roster (and get synced from the external app) but must NEVER count toward an event's score, an employee's cycle average, or eligibility (min-events rule, bonus, quarterly_results).

Two independent triggers for exclusion:
- `employmentType === "freela"` on the employee record.
- The participation's `functionName` matches an informational prefix (currently `"sup ceno"`, case/accent-insensitive) — covers "Sup Ceno", "Sup Ceno Local", "Sup Ceno Sp1", etc.

**Why a negative/prefix rule instead of a positive whitelist:** the live DB has many real scored `functionName` values ("Montador", "Motorista/Auxiliar", "Assistente de Produção", etc.) that don't match a small canonical scored-function set. An exact-match whitelist (as first proposed) would have silently stopped scoring for any function name not in that set. The rule instead defaults to "counts" for unknown/blank functions and only excludes the specific known non-scored cases (freela OR informational-function prefix).

**How to apply:** the single source of truth is `participantCountsForScore()` in `artifacts/api-server/src/lib/participation.ts`. Every place that reads participants for scoring, eligibility, or sync must import and apply it — do not re-derive the exclusion logic locally. As of this writing that includes: `results.ts` (recomputeCycleResults — both per-event score rows and cycle-wide participatedEventsCount), `events.ts`/`ranking.ts`/`my-performance.ts` (expose a computed `countsForScore` field per participant/event so the UI can show a live indicator), and `integration.ts` sync (uses the sibling `isSyncableFunction` allowlist so these participants still get synced in, just never scored).

The UI indicator is purely a live join against `employees.employmentType` + the participation's `functionName` — it needs no resync and updates instantly when RH edits an employee's employmentType in Colaboradores. However the *persisted* `quarterly_results` snapshot only updates on the next natural recompute trigger (event close/reopen/release, calibration, feedback release, cycle close) — there is no recompute-on-employee-PATCH hook (matches the existing `eligibleForBonus` pattern). `recomputeCycleResults` also emits a `warnings[]` entry if an employee with a preserved payment status (approved/scheduled/paid) would lose their quarterly_results row entirely because all their participations became excluded, instead of silently dropping it.
