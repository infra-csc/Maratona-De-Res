---
name: Consolidação "Penalidades/Méritos" net display
description: how to compute the net penalty/merit column without clamp distortion
---

The Consolidação tab's "Penalidades/Méritos" column must use the STORED `meritPoints` and `absencePenalty`
(=penaltyPoints) fields from quarterly_results: `net = meritPoints - absencePenalty` (positive → net merit
green +, negative → net penalty red −).

**Why:** an earlier version derived net as `grossAverage - finalResult`. That is WRONG near clamp boundaries —
`finalResult` is clamped to [0,100], so a top performer whose merits push gross over 100 would show a phantom
penalty instead of a merit. The recompute computes meritPoints in-memory; it is now persisted on quarterly_results
(merit_points column) and exposed on GET /results/quarterly specifically so the UI never needs the clamp-distorted derivation.

**How to apply:** any new column or export that wants the true penalty/merit impact reads the stored point fields,
not the difference of two clamped score fields.
