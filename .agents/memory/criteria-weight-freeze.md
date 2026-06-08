---
name: Criteria weight freeze on evaluation
description: Why/when event criteria weights must be frozen, and the lock rule once an event has evaluations
---

# Event criteria lock & weight freeze

Effective event weight = `eventCriteria.weightOverride ?? criteria.defaultWeight`.
Because `defaultWeight` is global, editing a global criterion would retroactively
change the scoring of events that already have evaluations.

## Rule
Once an event has ANY evaluation:
- RH can no longer edit its criteria/weights (block weight PUT and block reopening
  of confirmed criteria — both return 409).
- The event's weights must be frozen: fill every active row's null `weightOverride`
  from the current `defaultWeight` so later global edits cannot drift it.

**Why:** evaluations are scored against weights; allowing weight changes after the
fact corrupts already-recorded results. Freezing makes each evaluated event
self-contained.

**How to apply:** freeze runs at TWO points — on criteria confirm, and on the
first evaluation insert (covers admin/rh evaluating before confirmation, since the
avaliador-only confirm gate doesn't stop them). The invariant to preserve:
"event has evaluations ⇒ no active row has a null weightOverride."
If you add another evaluation-creation path, freeze there too (or centralize the
freeze helper). hasEvaluations is surfaced on EventDetail for the frontend lock.
