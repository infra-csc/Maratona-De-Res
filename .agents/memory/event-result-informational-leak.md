---
name: Event-result endpoint leaked informational participants as scored/eligible
description: GET /events/:id/result must filter participants by participantCountsForScore before mapping — otherwise Sup Ceno/freela show the team score and "Elegível" in the event-detail UI despite never getting an employee_event_results row.
---

`recomputeCycleResults` (routes/results.ts) already correctly excludes freela + informational functions ("Sup Ceno *") from `employee_event_results` and `quarterly_results` via `participantCountsForScore`. But the per-event drill-down endpoint `GET /events/:id/result` — which feeds the "Performance Individual (Equipe)" table on the event-detail page — queried `event_participants` directly and mapped **every** row to `{ eventScore: team.conformityScore, eligible: true }` with no such filter, in both the `isHistorical` and normal branches.

**Why:** two different code paths compute "who counts" for the same underlying rule; only one of them had the filter. The actual scoring/eligibility data was always correct (verified via direct prod DB query: zero `employee_event_results`/`quarterly_results` rows for affected people) — this was purely a display bug that made informational participants *look* scored and eligible in one specific table.

**How to apply:** any new endpoint/view that lists "participants of event X" and attaches a score/eligibility value must filter through `participantCountsForScore({ employmentType, functionName })` first (or explicitly carry a `countsForScore` flag through, as ranking.ts's per-employee drawer does). Don't assume `employee_event_results`/`quarterly_results` being correct means every display surface is.
