---
name: Per-event criteria weight validation
description: Rules for validating/confirming per-event criteria weights and the HR confirmation gate.
---

# Per-event criteria weight validation

- Active-weight sum must equal TARGET_WEIGHT (20) with tolerance 0.01. The PUT
  criteria endpoint validates the **resulting persisted** active sum (merge
  unchanged DB rows with the request payload), NOT just the payload — partial
  payloads must not be able to leave the event in an off-20 state.
- Confirm endpoint re-validates the **stored** sum == 20 before flipping
  `criteriaConfirmed`; reopen (`confirmed:false`) skips the check.
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
