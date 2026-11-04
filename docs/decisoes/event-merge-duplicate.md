---
name: Event duplicate-merge guard
description: POST /events/:id/merge blocks discarding real data on the removed duplicate unless force=true is passed
---

Merging two events that represent the same race (`/events/:id/merge`) deletes the "duplicate" event via
`ON DELETE CASCADE`, which also wipes its evaluations/calibrations/conformities/results. Draft (unsubmitted)
evaluations never block the merge — only *submitted* evaluations and real calibration/conformity/result rows do.

**Two legitimate scenarios collide here, so a two-step confirm replaces a hard block:**
- Duplicate has NO real data yet → merge proceeds silently (nothing to lose).
- Duplicate already has real data (both events were separately evaluated/closed/calibrated, e.g. the same race
  imported/entered twice) → this is redundant data of the same event, not something to preserve. Blocking
  forever defeats the point of the merge feature.

**How it works:** without `force`, a 400 is returned with `requiresConfirmation: true` + `details` (counts per
table). The frontend shows those counts and a "Mesclar Mesmo Assim" button that resends with `force: true`,
which bypasses the guard and records what was discarded in the response `warnings`. The kept event's own data
is never touched either way.

**Why:** an unconditional block silently prevented cleaning up genuine duplicates that both went through the
full evaluation workflow; an unconditional bypass would silently destroy real data on genuinely distinct
events selected by mistake. Explicit confirm (not a silent default) resolves both.
