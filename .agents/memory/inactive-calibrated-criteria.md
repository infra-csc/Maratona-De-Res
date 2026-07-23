---
name: Inactive-but-calibrated criteria display
description: How to handle event_criteria rows that are active=false but already have a calibration saved/published
---

## The rule
`event_criteria.active = false` means the global criterion was deactivated AFTER the event was created (via resync). If a calibration already exists for that criterion, the status column must show the calibration/publication state — NOT "Inativo".

"Inativo" badge should only render when `!c.active && !cal` (inactive AND no calibration).

## handlePublishAll filter
The "Publicar Tudo" batch must include inactive-but-calibrated criteria. Do NOT filter by `c.active` — filter only by `getCalibration(c.criterionId) != null`.

**Why:** Global criteria get deactivated and recreated with same names through catalog restructuring cycles. Old events keep their old criterion IDs (now globally inactive), but calibrations made before the deactivation are still valid and need to be published.

## criterionFilter reset on event change
`criterionFilter` state must reset to "all" in the `useEffect(() => {...}, [selectedEventId])` effect. Without this reset, navigating from an event with "Pendentes" filter to another event hides already-calibrated criteria, causing apparent count mismatch (e.g. events list shows "0/5" but calibrations page appears to show only 4 criteria).
