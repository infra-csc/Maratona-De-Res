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

**"Concluded" signal = `event.status === "closed"`**, NOT the presence of any
calibration. A single calibrated criterion does not make an event final, and an
event can be force-closed without calibration. UI that distinguishes
provisional vs final score (e.g. events list card) must key the final/concluded
state off `status === "closed"`; use `hasCalibration` only to refine wording.

**Team-score parity:** the events list (`GET /events`) computes `teamScore` +
`hasCalibration` in-memory (bulk `inArray` fetch, no per-event N+1) and MUST
mirror `computeEventTeamResult` semantics: active criteria only, weight =
`weightOverride ?? defaultWeight`, submitted evals only, calibration overrides
the average, `teamScore` is null when no criterion has a usable score. **Why:**
two code paths produce the same number; if they drift, the card and the detail
page disagree. Prefer extracting a shared helper if a third consumer appears.
