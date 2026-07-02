---
name: Tiered bonus — base vs extra portions
description: How the platoon bonus splits into a base amount and a per-extra-event amount, and where each portion is computed/stored
---

# Tiered bonus — base vs extra portions

The cycle bonus paid to an employee has two independently-computed portions:

- **Base bonus** — the platoon's flat `bonusValue`, determined by the
  employee's overall final score (0–100) falling into a platoon's score
  range.
- **Extra bonus** — for every event the employee participated in *beyond*
  the minimum eligibility count (`getMinEventsForEligibility()`, default 8),
  add that platoon's `bonusPerExtraEvent`. Crucially, each extra event's
  bonus tier is picked using **that specific event's own score**, not the
  employee's overall score. Extra events are selected chronologically — the
  earliest N (minEvents) count as "base" events, everything after that is
  "extra" (`selectExtraEventScores`).

**Why:** this rewards participating in more events than required, tier by
tier per event, without a cap — a flat total-bonus number can't be reverse-
engineered into base/extra after the fact because each extra event's tier
depends on its own score, not the aggregate.

**How to apply:** `calculateTieredBonus` returns the combined total (base +
extra) for backward compatibility; `calculateExtraBonusValue` isolates just
the extra portion. Both live in `calculations.ts` and share the same
per-event tier lookup. The extra portion is only meaningful once persisted —
`quarterly_results` is a snapshot written at cycle-close time
(`POST /results/quarterly/close`), so any new derived bonus field (e.g.
`extraBonusValue`) must be added to that insert AND to the `GET
/results/quarterly` select — existing snapshot rows will show 0 until the
next close recomputes them.
