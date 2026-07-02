---
name: Per-event criteria weight validation
description: Rules for validating/confirming per-event criteria weights and the HR confirmation gate.
---

# Per-event criteria weight validation

- The active-weight target is DYNAMIC per event, not a fixed constant: it's the
  sum of `originalWeight` (defaultWeight) across all of that event's criteria
  rows, active or not. Frontend computes `targetWeightSum` this way in
  event-detail.tsx (never hardcode 20 — the criteria catalog changed from a
  7-item set summing to 20 to a 5-item "Matriz de Performance" set summing to
  11, and future catalogs may differ again).
- The PUT criteria endpoint validates the **resulting persisted** active sum
  (merge unchanged DB rows with the request payload), NOT just the payload —
  partial payloads must not be able to leave the event in an inconsistent
  state.
- Confirm endpoint (backend) only checks `sum > 0` for active criteria, not an
  exact target — it doesn't need the dynamic target since any positive weight
  distribution is mathematically valid (the formula normalizes by dividing by
  the active sum). The exact-sum-must-match-target UX guardrail lives only on
  the frontend to guide admins back to the intended weight distribution.
- Frontend and backend tolerance MUST be identical (`<= 0.01`). A mismatch
  (`<` vs `<=`) blocks the UI at boundary values the backend would accept.

**Why:** off-by-one tolerance and payload-only validation were both flagged in
code review; they create silent inconsistency between what the UI allows and
what the server persists/accepts.

**How to apply:** any change to criteria weight editing/confirmation must keep
these three invariants together — validate merged persisted state server-side,
re-validate on confirm, and mirror the tolerance constant on both ends.

- Confirmation gate: `POST /evaluations` blocks role `avaliador` when
  `event.criteriaConfirmed=false`. This check sits AFTER score-range and
  area-ownership checks, so a valid score (1–5) and a criterion in the
  evaluator's area are needed to actually reach the gate when testing.
