---
name: Event-scoped duplicate criteria
description: How "duplicate a quesito within an event" is modeled so scoring stays correct
---

When RH duplicates a quesito (criterion) inside an event, the copy is its OWN
criterion row (`criteria.eventScoped = true`, own id + custom name), linked through
`event_criteria`. It is NOT a second `event_criteria` row pointing at the same global
criterion.

**Why:** evaluations, calibrations, and results are all keyed by the GLOBAL
`criterionId`, not by `event_criteria.id`. If a duplicate reused the same
`criterionId`, two rows in the same event would collide on every score lookup. A
distinct event-scoped criterion gives the copy an independent score column for free.

**How to apply:**
- Any query that builds the GLOBAL criteria catalog or attaches "all standard
  criteria" must filter `eventScoped = false`. This currently includes: `GET /criteria`,
  the integration sync attach, AND `POST /events` (manual event creation seeding).
  Forgetting any one of these leaks one event's copy into other events.
- A duplicate starts with `weightOverride = 0` so the per-event sum-must-equal-20
  invariant is preserved until RH redistributes weight.
- Delete is only allowed for `eventScoped` copies and is blocked once the event has
  evaluations (DELETE /events/:id/criteria/:eventCriterionId). Standard criteria are
  deactivated, never deleted.
- Rename reuses `PATCH /criteria/:id` (RH/admin only).

The per-area evaluator dropdown (assigning who scores an area in an event) filters
candidate avaliadores by their PROFILE `user.areaId === area.areaId`. That is only the
candidate picker; the actual assignment is still persisted in `event_area_assignments`
(see event-area-assignment.md).
