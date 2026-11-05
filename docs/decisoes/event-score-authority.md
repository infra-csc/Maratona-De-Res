---
name: Authoritative source for an event score
description: Which score a screen must display for an event, and why recomputing live diverges from the official one
---

There are two different numbers for "the score of an event", and they are not interchangeable:

- **Raw score** — what `calculateEventResult()` returns from the calibrations. No conformity penalty.
- **Official score** — `employee_event_results.finalEventScore`, produced by `computeEventTeamResult`, which applies the Matriz de Conformidade penalty. This is what Resultados, Ranking and the Colaboradores grid show.

**Rule:** any screen showing a score to a user must prefer the official row. The precedence is: official row → `importedScore` (historical events with no official row) → live calculation (only as a *projection* for events not yet confirmed).

**Why:** the collaborator-facing page recomputed live, so it silently dropped events whose raw score came out 0 and showed unpenalized numbers elsewhere. The user saw a different event count and a different average than HR saw for the same person, with no way to tell which was right.

**How to apply:** when adding or debugging any per-event score display, check whether the code path recomputes from calibrations. If it does, and the event is confirmed, it is wrong. Also beware the related trap: a page can mix a live-computed *list* with a snapshot-derived *average*, producing a "sum ÷ count = average" footer that does not add up.
