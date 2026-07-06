---
name: Employment type badge + diária scheduling
description: Freela/Casa badge and diária (day-shift) fields on event participants — sync-tolerant design so it auto-activates once the external app adds data.
---

# Employment type (Freela/Casa) + diária scheduling

`employees.employmentType` defaults to "casa" in the DB. If the external Logística
Interna app never sends this field, every synced employee silently defaults to
"casa" — this looks like a bug but is actually a missing-upstream-field issue,
not a mapping bug in Maratona.

**Why:** the employees sync `set` clause must only include `employmentType` when
the external payload actually provides it (conditional spread, not
`?? "casa"`). Unconditionally forcing a default on every sync would clobber
manual RH corrections made in the Maratona UI on every subsequent sync run.

**How to apply:** the sync mapping for `scheduledDiariaCount`/`scheduledDiariaStart`/
`scheduledDiariaEnd` on `event_participants` still uses the same conditional-spread
pattern (only sets the field when the external payload provides it), so it stays
a no-op until the external app's contract is extended (see
`integration-external-sync.md`) — auto-populates once it is, zero code changes
needed here.

As of 2026-07, `scheduledDiariaCount`/`Start`/`End` ("previstas") are sync-only
again — the manual RH edit UI/endpoint support that briefly existed was removed
per explicit product direction: previstas must always come from Logística
Interna's escalação data, never be hand-typed in Maratona. `PATCH
/events/:id/participants/:participantId` only accepts `confirmed` and
`actualDiariaDates` now; sending `scheduledDiaria*` there is rejected with 400.
Until the external sync contract actually exposes this data, "Previstas" will
keep showing "—" in the UI — that is expected, not a bug.

`actualDiariaCount` ("realizadas") remains the RH-manual side of this pair:
reconciled by hand in Maratona event-detail, and must NEVER be touched by the
sync loop, since the external app has no way to report real attendance, only
the planned schedule. Same informational-participant gate (400 if
`countsForScore===false`) applies to both scheduled and actual diária fields.
