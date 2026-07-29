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

`scheduledDiariaCount`/`Start`/`End` ("previstas") are sync-only — never
hand-typed in Maratona. They must always come from Logística Interna's
escalação data.

**Superseded:** the whole diária reconciliation feature ("realizadas",
date pickers, quick-confirm) was removed from the app in 2026-07 — see
`diaria-date-tracking.md`. The sync mapping above was deliberately left in
place, so `scheduledDiaria*` still populates if the external contract starts
sending it, but nothing in the UI reads it anymore and
`PATCH /events/:id/participants/:participantId` no longer accepts any diária
field. Presence is now controlled solely by `confirmed`.
