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
