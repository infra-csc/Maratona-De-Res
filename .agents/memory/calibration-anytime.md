---
name: Calibration anytime, any event
description: Product decision — calibration is never gated by evaluation progress; weights editable inline.
---

# Calibration anytime, any event

- The Calibrações page lists ALL cycle events (open or closed), regardless of
  evaluation progress. Calibration may target criteria with zero evaluator
  scores (`originalAverageScore` stays null).
- Inline weight editing on the calibration page mirrors the backend gate:
  weights are admin/rh only; calibration itself is admin/rh/diretoria. Keep the
  UI role gate in lockstep with `requireRole` on PUT /events/:id/criteria.
- Finalize (close + release) still requires all evaluations submitted
  (feedback.isComplete) server-side — calibrating early does not unlock
  closing. Known UX gap: the finalize card only renders when at least one
  criterion has evaluator scores, so an event calibrated entirely without
  scores can't be finalized from this page.

**Why:** the user explicitly asked (Jul 2026) for calibration to be available
before evaluations finish and even for scoreless criteria; earlier the dropdown
filtered to fully-evaluated/closed events and looked "empty".

**How to apply:** don't reintroduce evaluation-progress gating on the
calibration event picker; any new calibration-adjacent action must decide its
own role gate against the backend route, not copy `canFinalize`.
