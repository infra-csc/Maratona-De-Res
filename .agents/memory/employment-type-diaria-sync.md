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

**How to apply:** same pattern used for the new diária fields
(`scheduledDiariaCount`/`scheduledDiariaStart`/`scheduledDiariaEnd` on
`event_participants`) — these are sync-only (never edited manually) and are
mapped the same conditional way, so they stay null/no-op until the external
app's contract is extended (see `integration-external-sync.md`) and auto-populate
once it is, with zero code changes needed on this side.

`actualDiariaCount` is the mirror-image case: it is manual-only (RH reconciles
real attendance in Maratona) and must NEVER be touched by the sync loop, since
the external app has no way to report real attendance, only the planned
schedule.
