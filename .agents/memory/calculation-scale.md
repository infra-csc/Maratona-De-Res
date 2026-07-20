---
name: Calculation scale
description: The score scale and weighting rule used across the Maratona evaluation calculations
---

# Rule
Event Performance subtotal = normalized weighted average of notas (each nota is 0–10) × 10, producing a 0–100 result: `sum(nota_i × weight_i) / sum(weight_i) × 10`. The weight SUM is normalized away (divide by total active weight), so it is NOT required to equal any fixed constant — different criteria sets can have different total weights (e.g. the original 7-criteria set summed to 20, a later 5-criteria "Matriz de Performance" set sums to 11). Do not skip the division by total active weight.

**Why:** Notas are entered on a 0–10 scale (confirmed via evaluations UI and the official "Mudanças" spec doc), not 0–5. Because the formula normalizes by dividing by the active weight sum, the calculation is correct regardless of what that sum is — there is no hardcoded "weights must sum to 20" requirement in the math itself (that constraint only ever existed as a UI/validation convenience, see criteria-weight-validation.md).

**Cycle final result formula:** `Nota Final = (Σ event scores − penaltyPoints + meritPoints) / N`, clamped [0,100]. Penalties/merits are deducted from the **sum** (not from the average), then divided by N. Equivalent to `grossAverage − netPenalty / N`. See `calculateQuarterFinalResult(grossAverage, netPenalty, eventCount)` in calculations.ts. All 3 callers (results.ts, my-performance.ts, ranking.ts) must pass `eventCount`.

**How to apply:** Conformidade subtotal is separate: 4 boolean items × 25 pts (SIM=25/NÃO=0) → 0–100 subtotal; Penalidade = (100 − subtotal) × 0.40; Pontuação Final = Performance − Penalidade, clamped to [0,100]. See `calculateConformitySubtotal`/`calculateConformityPenalty`/`calculateFinalEventScore` in `calculations.ts` for the literal, spec-matching implementation (validated at server startup against the spec's worked example).
