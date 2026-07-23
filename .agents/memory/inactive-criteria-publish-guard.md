---
name: Inactive criteria publish guard
description: Criteria deactivated from an event still show in calibrations if they have a saved calibration score, but publishing them fails with 404.
---

## Rule
`displayActiveCriteria` in calibrations.tsx intentionally includes inactive criteria that have a saved calibration (so admins can see historical cal data). BUT the `/publish-final` and `/publish-partial` endpoints require `event_criteria.active = true` → return 404 for inactive criteria.

**Why:** The comment at line 518 says "Inclui critérios com calibração salva mesmo se ec_active=F". This is by design. The server-side publish endpoints gate on active=true also by design. The mismatch causes the HTTP error.

**How to apply:**
1. In the render (STATUS column): use `!c.active` (not `!c.active && !cal`) to show "Inativo" badge for ALL inactive criteria regardless of calibration
2. In `handlePublishAll`: add `c.active !== false` filter before iterating, so bulk-publish skips inactive criteria
3. Note: `handlePublishAllFinal` / `handlePublishAllPartial` use server-side all-at-once endpoints which already filter by `active=true` — those are safe
