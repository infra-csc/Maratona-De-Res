---
name: Partial vs final feedback publish
description: How explicit "publish partial" vs "release final" feedback actions coexist for event evaluations
---

Event feedback has two independent publish actions, both admin|rh|diretoria only:
- `partialPublishedAt` lives on **`eventCriteriaTable` (per-criterion)**, not on the event. Set by `POST /events/:id/criteria/:criterionId/publish-partial`, callable repeatedly per criterion at any time (no completeness requirement, doesn't close the event). Moved here from an event-level column because the real granularity managers wanted was "publish this one quesito's preview now," not the whole event at once.
- `feedbackReleasedAt`/`feedbackReleased` — still event-level, set by the existing close+release flow. Terminal: once true, `publish-partial` is rejected (400) at any criterion, since final supersedes partial.
- An event-level `partialPublishedAt` is still exposed everywhere an event summary is returned (event list, event feedback, my-performance event summary), but it is a **derived rollup** (MAX across that event's active criteria), never its own writable field — don't resurrect a stored event-level column.

**Why:** the user wanted a trackable "last publication" signal (partial or final, with a timestamp) shown to collaborators, without gating the existing live score preview behind any publish action — the live preview on `/my-performance` stays ungated by design (own judgment call, not explicitly confirmed by user). Later the user asked to move partial publish from event-level to per-criterion so managers can preview individual quesitos as they're calibrated, instead of waiting to publish everything at once.

**How to apply:** any UI/badge showing publish status must derive a 3-state value: `final > partial > "not published yet"` (checking `feedbackReleased` first, then `partialPublishedAt`, else the third state) — never collapse to a 2-state boolean. Compute this at BOTH levels: per-criterion (using that criterion's own `partialPublishedAt`) for the per-quesito badge/button, and event-level (using the MAX rollup) for the overall event banner. Both `calibrations.tsx` (admin action + badges, one button per criterion `<article>`) and `my-performance.tsx` (collaborator-facing badges, event banner + per-criterion badge in `criteriaDetails`) must independently implement this since `my-performance.tsx` uses a raw fetch, not the generated client — its endpoint is intentionally excluded from `openapi.yaml`.
