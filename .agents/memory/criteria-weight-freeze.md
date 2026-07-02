---
name: Criteria weights always editable, structure locked
description: Weight edits vs structural edits on event criteria — what stays locked after evaluations, what stays open forever, and how weight changes recompute results
---

# Event criteria lock: structure vs weight

Effective event weight = `eventCriteria.weightOverride ?? criteria.defaultWeight`
(per-event override, not global — so editing one event's weight never touches others).

## Current rule (supersedes the old "freeze weights" decision)
Once an event has ANY evaluation, only the STRUCTURE is locked:
- Cannot toggle a criterion's `active` flag (409 on PUT /events/:id/criteria).
- Cannot duplicate/delete/rename criteria, cannot reopen confirmed criteria.

Weights (`weightOverride`) stay editable FOREVER — before confirmation, during
active evaluation/calibration, and even after the event is `closed`. There is no
freeze-on-confirm/freeze-on-first-evaluation step anymore.

**Why:** business need — RH must be able to correct a miscalibrated weight at any
point, including after close, and have it retroactively reflected in results/bonuses.

**How to apply:**
- If `event.status === "closed"`, saving new weights also runs
  `recomputeCycleResults(event.cycleId, userId)` synchronously in the same request
  (audit-logged as `update_weights_after_evaluations`) so quarterly_results/bonus
  rows reflect the new weight immediately. Open events don't need this — they have
  no cached quarterly_results yet, weights are read live.
- `recomputeCycleResults` already preserves manually-set bonus_status rows
  (approved/scheduled/paid/blocked) and returns `warnings` on divergence — surface
  those warnings to the user (e.g. destructive toast) whenever weights are re-saved
  post-close.
- Frontend (event-detail.tsx): weight `<Input>` is only disabled by `!item.active`,
  never by the confirmed/hasEvaluations lock. A "Salvar Pesos" action stays visible
  whenever weights are dirty, independent of the structural lock state.
