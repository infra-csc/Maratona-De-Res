---
name: Diária date-based tracking
description: How "days actually worked" (diária) is tracked per event participant — date array vs count, validation, and gating for informational participants.
---

`event_participants.actualDiariaDates` (date[], nullable) is the source of truth for which specific calendar days a participant actually worked. `actualDiariaCount` is kept only as a derived/legacy int column — the backend always sets it to `actualDiariaDates.length` whenever dates are written, and never accepts a raw count from the client anymore (`EventParticipantUpdate` only exposes `actualDiariaDates`).

**Why:** a single count number wasn't enough for RH — they needed to see the event's calendar and pick which day(s) a participant was actually present, since multi-day events are common. A child table (one row per worked day) was considered and rejected as overkill for an internal tool with no downstream calculation depending on it.

**How to apply:**
- Candidate/selectable dates for the picker come from the **event's** `startDate`/`endDate` range, not the participant's `scheduledDiariaStart/End` (those are synced read-only from external logistics and are frequently null — using them as the bound would make the picker unusable for most participants). The scheduled range is only shown as an informational hint.
- Validation lives server-side (PATCH `/events/:id/participants/:participantId`): each submitted date must be a valid `YYYY-MM-DD` string within the event's own date range, deduped and sorted before persisting.
- Non-scored/informational participants (`countsForScore === false`, e.g. "Sup Ceno*" functions or freelas per `participation.ts`) are hard-gated from having any diária data — the backend rejects the request with 400 if `actualDiariaDates` is present in the body and the participant doesn't count for score. UI must mirror this by hiding the diária control entirely for those rows (only inactive-toggle + delete remain), but the server check is the real boundary.
- The "Realizadas" picker is a `Dialog` (not a `Popover`) opened per participant, with **local state** for the selected date set — only one `PATCH` fires on explicit "Salvar", not per-checkbox-click (a Popover + mutate-per-click was reported by the user as feeling "travado"/frozen). Includes a "Confirmar Diárias Previstas" quick-action that bulk-selects (locally, still requires Salvar) the event dates falling inside `scheduledDiariaStart`–`scheduledDiariaEnd`.
