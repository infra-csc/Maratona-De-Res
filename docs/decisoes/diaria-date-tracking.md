---
name: Diária validation removed — presence is just `confirmed`
description: The per-diem (diária) confirmation/validation feature was removed from Maratona; how participant presence is controlled now, and what remains of the old columns.
---

# Diária tracking was removed (2026-07)

Maratona no longer validates or confirms "diárias" (per-diem days worked) at all.
Participant presence in an event is controlled **exclusively** by the
`event_participants.confirmed` boolean.

The current product workflow is:

1. Participants are synced from the external Logística Interna app.
2. If a person did not attend → mark them **inactive** (`confirmed = false`),
   with a free-text `comment` as justification.
3. If a person attended but did not come through the sync → add them manually.
4. Confirm the event results. No diária step anywhere.

**Why:** the diária reconciliation UI (date-by-date picker, "modo rápido"
quick-confirm, Previstas/Realizadas badges) was pure operational overhead — the
data it collected fed **no** score or eligibility calculation. Scoring uses
`participantCountsForScore()` (employmentType + functionName) and cycle
eligibility uses `participatedEventsCount` over confirmed events. The old UI
copy claiming diárias mattered "para fins de nota e elegibilidade" was simply
wrong.

**How to apply:**
- `PATCH /events/:id/participants/:participantId` accepts only `confirmed`,
  `functionName`, and `comment`. Sending `actualDiariaDates` or
  `diariaQuickConfirmed` is no longer supported — those keys are ignored/rejected.
- The justification comment box renders **only** when a participant is inactive.
  There is no longer a "zero diárias requires justification" rule.
- The columns `actualDiariaDates`, `actualDiariaCount`, `diariaQuickConfirmed`,
  `diariaQuickConfirmedAt` were intentionally **kept** in the DB (historical data
  preserved, and prod DB writes must ship as in-app actions — see
  `prod-write-via-app-only.md`). They are marked `deprecated` in the OpenAPI
  response schema and are read-only legacy. Do not resurrect them as inputs.
- `scheduledDiaria*` ("previstas") still exists and is still written by the
  integration sync — see `employment-type-diaria-sync.md`. It is no longer
  surfaced in the event-detail UI, but the sync mapping was deliberately left
  intact so the data keeps landing if the external contract starts sending it.
