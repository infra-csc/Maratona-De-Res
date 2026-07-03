---
name: Historical results import (pre-calibrated events)
description: How events with a pre-final, already-calibrated score (no per-criterion evaluation) bypass the normal scoring pipeline
---

Some events (e.g. imported historical race results) arrive with a single final score per team/employee — there are no per-criterion evaluations, calibrations, or conformity penalties to compute.

**Why:** the existing pipeline (`computeEventTeamResult`) assumes raw evaluations + weighted criteria + conformity penalties exist. Historical data only has a final number, so forcing it through that pipeline would require fabricating fake evaluation rows.

**How to apply:** model this as an event-level flag (`isHistorical` + `importedScore` on the events table), not a separate data path. Every place that computes/reads event results (`recomputeCycleResults`, `GET /events/:id/result`, `GET /events` list, `loadEventDetail`) must special-case `isHistorical` events to use `importedScore` directly as `eventScore = calibratedEventScore = finalEventScore`, with `evaluationProgress = 1` and `hasEvaluations = true`, bypassing `computeEventTeamResult` entirely. Missing any one of these call sites causes historical events to silently show as 0%/unevaluated in only that view.

Import endpoint pattern (bulk CSV/TSV import with dry-run):
- Always require an explicit `dryRun: true` preview pass before allowing commit; the same validation/matching code path must run for both dry-run and commit so the preview is trustworthy.
- Group input rows by (event name + date) since one event has many employee rows.
- Employee matching: normalize (NFD strip + lowercase + trim) and require an exact match; treat ambiguous matches as a hard error rather than guessing.
- Detect three actions per event group: create (new), update (existing event already `isHistorical`), conflict (existing event with same name+date is NOT historical — likely a duplicate of a real evaluated event; abort that group rather than silently overwriting real evaluation data).
- After commit, call the same `recomputeCycleResults` used elsewhere so cycle-level aggregates/snapshots stay in sync — don't hand-roll a separate aggregation.
