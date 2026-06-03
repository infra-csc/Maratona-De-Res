---
name: Calculation scale
description: The score scale and weighting rule used across the Maratona evaluation calculations
---

# Rule
Event/quarter scores use `score × weight` summed directly, producing a 0–100 result. The 7 criterion weights sum to 20, and max score per criterion is 5, so max total = 5 × 20 = 100. Do NOT normalize/rescale the weights to fractions.

**Why:** The official regulation defines results on a 0–100 scale with fixed integer weights summing to 20. Earlier bugs came from multiplying an already-0–100 value by 100, or from normalizing weights to sum to 1 (which collapses the scale).

**How to apply:** Validated example — weights `[3,3,2,3,3,3,3]` with team notes `[4,4,4,3,2,3,5]` must yield an event result of 71. UI must display values as `N.N/100` with chart domains `[0,100]`, never multiply by 100 again.
