---
name: Partial vs final feedback publish
description: How explicit "publish partial" vs "release final" feedback actions coexist for event evaluations
---

Event feedback has two independent publish actions, both admin|rh|diretoria only:
- `partialPublishedAt` (nullable timestamp) — set by `POST /events/:id/feedback/publish-partial`. Can be called repeatedly at any time (no completeness requirement, doesn't close the event); each call just overwrites the timestamp.
- `feedbackReleasedAt`/`feedbackReleased` — set by the existing close+release flow. Terminal: once true, `publish-partial` is rejected (400), since final supersedes partial.

**Why:** the user wanted a trackable "last publication" signal (partial or final, with a timestamp) shown to collaborators, without gating the existing live score preview behind any publish action — the live preview on `/my-performance` stays ungated by design (own judgment call, not explicitly confirmed by user).

**How to apply:** any UI/badge showing publish status must derive a 3-state value: `final > partial > "not published yet"` (checking `feedbackReleased` first, then `partialPublishedAt`, else the third state) — never collapse to a 2-state boolean, or every unpublished event will be mislabeled as "partial". Both `calibrations.tsx` (admin action + badge) and `my-performance.tsx` (collaborator-facing badge) must independently implement this same 3-state derivation since `my-performance.tsx` uses a raw fetch, not the generated client.
