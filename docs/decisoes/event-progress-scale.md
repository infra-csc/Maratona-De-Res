---
name: evaluationProgress scale
description: Event.evaluationProgress is a 0–1 fraction, not a percent — watch the unit when filtering/displaying
---

`GET /events` returns `evaluationProgress` as a **0–1 fraction** (submitted ÷ total
evaluation rows), not a 0–100 percent.

**Why:** Backend computes `progress = submittedEvals.length / totalEvals.length`.
A fully-evaluated event is `1`, not `100`. Some UI (e.g. evaluations page progress
bar) renders it directly as `{progress}%`, which is a latent display bug for that
surface but unrelated to filtering.

**How to apply:** To test "all evaluations done", compare `>= 1`, never `>= 100`.
"Done OR closed by RH" = `evaluationProgress >= 1 || status === "closed" || forcedClosed`
(used by the Calibrações event picker).
