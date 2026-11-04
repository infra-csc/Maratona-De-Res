---
name: Independent filter fields pattern
description: How evaluations.tsx (Evento/Avaliador/Status) filters were made independent instead of cascading/disabled
---

When a user says filters "have to be independent," it means: no filter should be `disabled` waiting on another, and selecting one filter must NOT reset the others.

**Why:** evaluations.tsx originally disabled Avaliador/Status Selects until an Evento was chosen, and reset both back to defaults every time the Evento changed — so users lost their Avaliador/Status choice whenever they switched events.

**How to apply:**
- Remove `disabled={!otherFilter}` from dependent Select fields.
- Do NOT clear a filter's state in another filter's `onSelect`/`onChange` handler just because it changed — only reset on truly invalidating events (e.g. the selected event no longer exists).
- If a filter's option list is normally derived from a scoped resource (e.g. avaliadores assigned to one event via `areaAssignments`), fetch a global fallback list (e.g. all active users with that role) to populate the dropdown before/without the scoping selection, then prefer the scoped list once available.
- Filtering logic downstream should tolerate a selected value that doesn't exist in the currently scoped list (e.g. `.find(...) ?? null`) and gracefully fall back to "no filter applied" rather than erroring.
- Independence isn't just about the dropdown being enabled — check what the *results panel* does when only that filter is set. It had a second bug: the dropdown was independent, but the results area still gated on Evento being selected, so picking only Avaliador rendered the generic "select an event" empty state instead of results. Fix: add a fallback results view (cross-event overview, driven by `useQueries` over all events with the same query keys as the existing per-event fetches so it dedupes from cache) for "only this other filter is set."
