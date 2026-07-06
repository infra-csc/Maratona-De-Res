---
name: Scored/syncable function must be prefix-matched, not exact-match
description: isScoredFunction whitelist in participation.ts must use startsWith, not an exact-match Set, or new external function-name variants get silently dropped from sync entirely.
---

`isSyncableFunction` (lib/participation.ts) gates which external participations are even pulled into the app during sync — anything that fails it never becomes an `event_participants` row, so its diária (previstas) data never arrives either. It is `isScoredFunction || isInformationalFunction`.

`isInformationalFunction` was already prefix-matched (`"sup ceno"` catches `"sup ceno sp1"`, etc.). `isScoredFunction` was an exact-match `Set(["cenotecnica", "cenotecnica local"])` — the external Logística Interna system also emits squad/team variants like `"cenotecnica sp"`, `"cenotecnica sp1/sp2"`, and the masculine spelling `"cenotecnico - casa/freela"`, none of which matched exactly, so those participations (and their diária dates/counts) were silently dropped from every sync, with no error surfaced anywhere.

**Why:** the external system's function-name vocabulary evolves (new squad suffixes) independent of app deploys; an exact-match whitelist breaks silently instead of failing loud.

**How to apply:** `isScoredFunction` now checks `startsWith("cenotecnica")` or `startsWith("cenotecnico")` instead of exact Set membership. If a report of "missing participant/diária data for event X" comes in again, first check whether the raw external `functionName` (via `/employees`/`/participations` on `EXTERNAL_API_URL`) has a new prefix/spelling variant that isn't covered — don't assume the sync itself is broken.
