---
name: resultsConfirmed requires status=closed to have any effect
description: Why confirming an event's results can silently do nothing — the confirm-results endpoint allows confirming regardless of status, but score aggregation ignores it unless the event is also closed
---

# resultsConfirmed requires status=closed to have any effect

`POST /events/:id/confirm-results` sets `resultsConfirmed=true` unconditionally
— by design it does not check `event.status` (comment in events.ts explicitly
says "independente de status"). But `recomputeCycleResults` only includes an
event in scoring (`closedEvents = confirmedCycleEvents.filter(e => e.status
=== "closed")`) when it is BOTH `resultsConfirmed` AND `status === "closed"`.

**Why this matters:** confirming an open event "succeeds" (200, DB updated)
but has zero visible effect on dashboard/results/ranking/bônus, since the
event never enters `closedEvents`. This reads to users as "confirmation is
broken" when it's actually working exactly as coded — the event just needs to
be closed first (via the Calibração page's close/finalize flow).

**How to apply:** when debugging "I confirmed but nothing changed", check
`event.status` before assuming the confirm/recompute logic is broken. Verify
via direct API test (login as seeded admin, curl the endpoint, inspect
`quarterly_results`/`employee_event_results` row counts) rather than reading
code alone — this isolates whether it's a data-state issue (event still open)
vs an actual bug. The frontend now disables "Confirmar Resultados" and shows
a warning while `status !== "closed"` (event-detail.tsx) to prevent this
confusion at the source.
