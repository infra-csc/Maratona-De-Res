---
name: Evaluations include closed events
description: Central de Avaliações event dropdown must show open AND closed events, not just open
---

The Central de Avaliações event-selector dropdown lists both open and closed events, not just open ones — the status filter was removed from the underlying events query for this page.

**Why:** evaluators/managers still need to reference or review evaluations tied to events that have since closed (e.g. for calibration, late submissions, or historical lookup); restricting the dropdown to only open events hid legitimate past-event data.

**How to apply:** any downstream filter or derived list on this page should read from the full open+closed event set (commonly named something like `activeEvents`) rather than re-deriving its own open-only subset.
