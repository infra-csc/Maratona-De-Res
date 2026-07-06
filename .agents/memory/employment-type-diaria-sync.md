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

As of 2026-07, `scheduledDiariaCount`/`Start`/`End` are ALSO manually editable by
admin/rh directly in the event-detail participant list (PATCH
`/events/:id/participants/:participantId`), because the external app's UI
("Escalação") already shows this per-participant, but its sync API doesn't expose
it yet — RH types in the same number they see there as a stand-in, to compare
against "realizadas". Manual edits and a future sync are NOT mutually exclusive:
whichever wrote last wins (same last-write-wins pattern as everywhere else), so once
sync starts sending real data it will simply overwrite any manual entries on the
next run — no reconciliation needed.

`actualDiariaCount` is the mirror-image case: it is manual-only (RH reconciles
real attendance in Maratona) and must NEVER be touched by the sync loop, since
the external app has no way to report real attendance, only the planned
schedule. Same informational-participant gate (400 if `countsForScore===false`)
applies to both scheduled and actual diária fields.
