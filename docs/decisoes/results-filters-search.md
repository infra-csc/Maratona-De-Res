---
name: Results page filters + search
description: Search/platoon/eligibility filter pattern shared across the 3 Resultados tabs
---

All 3 tabs on the unified Resultados page (Ranking, Consolidação, Bônus & Pagamentos) get a consistent search bar plus a platoon filter dropdown; the eligibility filter is only shown on Ranking and Bônus & Pagamentos (not Consolidação).

**Why:** these three views share the same underlying employee/result rows, so keeping the filter set consistent (aside from eligibility, which only makes sense where bonus/ranking eligibility is shown) avoids confusing per-tab UX differences.

**How to apply:** filtering happens client-side after the full API payload for the current cycle is fetched — do not add server-side filter params for these. Use the `"__all"` sentinel value as the default/placeholder option in Radix `Select` components, since Radix disallows an empty-string `value`.
