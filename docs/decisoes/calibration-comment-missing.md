---
name: Calibration comment missing from event-detail
description: computeEventTeamResult's criteriaDetails omitted calibrationReason, so calibration comments never reached the event-detail page even after being saved on the calibrations page.
---

The event-detail page's "Notas e Calibrações por Critério" table renders from
`GET /events/:id/result` (`computeEventTeamResult`), not from `GET /calibrations`.
That function built each `criteriaDetails` entry from the `calibrations` row
(for `calibratedScore`) but never copied over `calibration_reason`, so the
per-criterion comment text (entered on the Calibração page) had no field to
travel through to event-detail — it would show the calibrated score but never
the comment, regardless of when calibration was saved or how many times the
page was refreshed.

**Why:** two different pages read calibration data through two different
paths (`calibrations.tsx` fetches `GET /calibrations` directly and had the
reason all along; `event-detail.tsx` only ever had `computeEventTeamResult`'s
shape). Adding a field to one path's response doesn't propagate to the other.

**How to apply:** whenever `computeEventTeamResult`'s criteriaDetails shape
changes, check both consumers (`event-detail.tsx` via `/events/:id/result`,
and CSV exports in `exports.ts`) for whether they need the new field too.
Remember to mirror any such field in `lib/api-spec/openapi.yaml`
(`EventTeamCriterion` schema) and rerun `pnpm --filter @workspace/api-spec run codegen`
before the frontend type will pick it up.
