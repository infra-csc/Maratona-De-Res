---
name: resultsConfirmed gating flag
description: Event-level flag that gates whether an event counts toward score/eligibility; defaults false even for pre-existing closed/paid events (intentional production reset).
---

`eventsTable.resultsConfirmed` (+`resultsConfirmedAt`/`resultsConfirmedBy`) is ONE flag per whole event (not per participant). Admin/rh toggle it via `POST /events/:id/confirm-results` / `/unconfirm-results` at any time, no status guard.

**Why:** the business wants a manual gate so a closed/scored event never silently counts toward an employee's score or event-eligibility count until someone explicitly reviews and confirms it — including retroactively for every event that existed before this feature shipped (paid or not).

**How to apply:**
- Filter at the source: `recomputeCycleResults` in `results.ts` filters `cycleEvents` to `resultsConfirmed=true` FIRST, before deriving anything (participation count, closed events, scoring). Everything downstream (dashboard, results, ranking) reads the `quarterlyResultsTable` snapshot this produces.
- Any code path that computes score/eligibility LIVE instead of from the snapshot must mirror the same filter — currently `my-performance.ts` (`scoredEvents` filter) and `ranking.ts` (`ranking-detail`'s `scored` filter) both do.
- When rebuilding `employee_event_results` inside `recomputeCycleResults`'s transaction, the DELETE must scope over ALL cycle event IDs (confirmed + unconfirmed), not just the confirmed subset — otherwise unconfirming an event leaves stale rows behind (caught in code review; the confirmed-only ID list is correct for scoring math but wrong for the delete-then-insert rebuild scope).
- Because the column defaults to `false`, no backfill/migration was needed to satisfy "reset everything in production" — every existing row already reads as unconfirmed the moment the column exists. Re-confirming after that is one click per event; there is no bulk-confirm endpoint.
- Feedback release (`getEventFeedback`) and per-event exports are intentionally NOT gated by this flag — only score/eligibility aggregation is.
- As of 2026-07, Central de Avaliações also respects this flag on the avaliador side: an event only moves to the "Concluídas" tab / shows a "Concluída" badge once `resultsConfirmed` is true, even if the avaliador already submitted 100% of their assigned criteria. Submitted-but-unconfirmed shows a distinct "Aguardando confirmação" badge instead of silently reusing "Em andamento" (which would misleadingly suggest work is still outstanding).
