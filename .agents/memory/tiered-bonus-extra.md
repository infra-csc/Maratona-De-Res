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

**Zero-bonus tier must zero out the extra portion too.** Both functions look
up the base platoon by the employee's *overall* score first, and both must
`return 0` immediately if that base platoon's `bonusValue <= 0` — a "no
bonus" tier (e.g. the bottom bracket, historically "Pelotão Branco" 0–70)
means zero bonus, full stop, even if some individual extra events that
quarter scored high enough to carry their own positive `bonusPerExtraEvent`.
Before this guard existed, someone stuck in the zero tier overall could still
accumulate a nonzero "extra" bonus from a couple of good events, which reads
as a real payroll bug once the money is on screen. Verify any future change
to this math against that exact case (low overall tier + high-scoring extra
events → total must stay 0), not just the common "everything in one tier" case.

**Recompute overwrites the stored bonus value even when payment is locked.**
`POST /results/quarterly/recompute` (and quarter-close) always writes the
freshly-calculated `bonusValue`/`extraBonusValue` into `quarterly_results`,
even for rows whose `bonusStatus` is preserved (`paidAt` set or status in
`PRESERVE_STATUSES`) — only the *status* is protected, not the number. A
divergence only produces a `warnings[]` entry ("revise o pagamento"), it does
not block the overwrite. Tell whoever triggers a recompute that already
paid/approved figures can silently change and must be checked against the
warnings list.
