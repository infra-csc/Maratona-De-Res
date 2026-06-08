---
name: Event finalize flow
description: How an event is finalized (closed + feedback released) and the gating/RBAC that governs it
---

# Event finalize flow

Finalizing an event = two sequential backend calls: `POST /events/:id/close`
(sets status=closed) then `POST /events/:id/feedback/release` (sets
feedbackReleased=true). Only after release do restricted roles (avaliador) see
the feedback; managers can preview it before release via `GET /events/:id/feedback`.

**Release precondition:** `/feedback/release` returns 400 unless
`buildEventFeedback(...).isComplete` is true, i.e. ALL evaluations submitted
(criteria.length > 0 && no pending). Any UI offering "finalize" must gate on
`feedback.isComplete`, not just "all calibrations saved" — otherwise the user
is offered a close that then 400s on release.

**Partial-failure:** close can succeed while release fails. Handle this: the
event is left `closed` but unreleased. Recovery = call release again (close is
idempotent). The calibrations page relabels its CTA to "Liberar Notas" when the
event is already closed.

**RBAC parity (important):** `createCalibration`, `/feedback/release`, and
(now) `/events/:id/close` all allow `admin|rh|diretoria`. **Why:** diretoria
runs calibration + finalization end-to-end; if any one of those three routes
omits diretoria, the finalize flow breaks mid-way for them. Keep the three in
lockstep when changing roles.
