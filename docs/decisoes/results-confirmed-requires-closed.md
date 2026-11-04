---
name: resultsConfirmed is independent of event status
description: Confirming a event's team/results is deliberately decoupled from open/closed status — only the final score calc needs closed
---

# resultsConfirmed is independent of event status

`POST /events/:id/confirm-results` sets `resultsConfirmed=true` unconditionally
regardless of `event.status`. `recomputeCycleResults` already uses two
separate filters: `confirmedCycleEvents` (resultsConfirmed only, drives
`participatedEventsCount`/eligibility) vs `closedEvents` (resultsConfirmed AND
status==="closed", drives the actual score/`eventsCount`). So confirming an
open event DOES have immediate effect on eligibility — only the final score
waits for close.

**Why this matters:** the confirm action's real purpose is validating the
*allocated team that participated*, not gating the score. The frontend used
to disable the confirm button and warn "confirming now changes nothing" while
the event was open — that was misleading and got explicitly corrected by the
user (2026-07-10): confirmation must be doable at any time.

**How to apply:** event-detail.tsx's "Confirmar Resultados" button has no
status-based `disabled`; the info banner explains eligibility locks in
immediately while final score still needs close+release. Don't reintroduce a
status-gated disable/warning on this button.
