---
name: Global criterion deactivation orphans pending events
description: Deactivating a global criterion does not touch already-created event_criteria rows; pending events can end up with zero real active criteria after a catalog swap.
---

## The problem

`event_criteria` is a snapshot taken at event-creation time (only currently-active,
non-eventScoped global criteria are copied in). Deactivating a criterion later
(`PATCH /criteria/:id` with `active:false`) only flips the global `criteria.active`
flag — it never touches `event_criteria` rows that already reference it. The event's
own `event_criteria.active` stays `true` forever, regardless of the event's lock
state (`criteriaConfirmed`).

**Why this matters:** if the whole criteria catalog is swapped (e.g. a full
"Matriz de Performance" migration replacing a 7-item set with a new 5-item set),
any event created before the swap but not yet confirmed/evaluated keeps
referencing only the now-dead criteria. It shows "N Critérios Ativos" in the UI
(since that count only checks `event_criteria.active`, not the global flag), but
none of those criteria can ever be scored meaningfully, and RH is stuck assigning
weights/avaliadores to things the org no longer evaluates. In one real incident
this silently affected 44 live pending events after a catalog migration.

## How to apply

- Never assume `event_criteria.active = true` implies the underlying criterion is
  still active — always check both flags when auditing "is this event's criteria
  setup healthy" (`event_criteria.active AND criteria.active`, for non-eventScoped
  rows).
- `PATCH /criteria/:id` (deactivating a criterion) cascades: it deactivates
  matching `event_criteria` rows, but ONLY for events where `criteriaConfirmed = false`
  (never touches confirmed/locked or already-evaluated events — those keep their
  historical snapshot).
- There's also a manual fix: `POST /events/:id/criteria/resync` (admin/rh, blocked
  once `criteriaConfirmed` or evaluations exist) syncs one event's criteria set to
  the current global active catalog — deactivates orphaned links, adds newly-active
  criteria not yet linked. Exposed as a "Sincronizar Critérios Ativos" button on the
  event-detail RH criteria panel, shown only while the event is unconfirmed.
- Any future bulk catalog swap should proactively resync all not-yet-confirmed
  events (loop the resync endpoint), not just rely on the deactivate-time cascade,
  since that cascade only fires going forward from the moment it was added.
