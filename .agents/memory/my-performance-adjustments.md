---
name: My-performance live penalty/merit math
description: Meu Desempenho endpoint computes penalties/merits live and must mirror the cycle-close rules in results.ts
---

**Rule:** The `/my-performance` endpoint computes `penaltyPoints`, `meritPoints`, and `totalAbsences` live from absences rows. This math must stay identical to the cycle-close recomputation in results.ts: penalty rows are `kind !== "merit"`, merit rows are `kind === "merit"`, points = Σ(points × quantity), `totalAbsences` counts penalty quantities only (merits are NOT faltas), and final = clamp(gross − penalties + merits, 0, 100).

**Why:** The dashboard shows live numbers before cycle close; if the two formulas drift, the user sees a different result on Meu Desempenho than in the closed-cycle snapshot, which reads as a data bug.

**How to apply:** Any change to penalty/merit aggregation in results.ts must be mirrored in my-performance.ts (and vice versa). Note: `/my-performance` is NOT in openapi.yaml — the frontend uses a raw useQuery fetch with local TS interfaces, so response shape changes require updating the interfaces in my-performance.tsx by hand (no codegen).

**Pitfall found (2026-07-03):** the endpoint has two branches — `quarterResult` present (closed) vs. the live-projection `else` branch (open cycle, no snapshot yet). It's easy to apply the penalty/merit-adjusted formula only in the closed branch and leave the live branch using the raw `grossAverage` for platoon/bonus/displayed score, silently ignoring pending penalties/merits until close. Always check BOTH branches compute platoon/bonus from the same adjusted score (`calculateQuarterFinalResult(grossAverage, penaltyPoints - meritPoints)`), not just one.
