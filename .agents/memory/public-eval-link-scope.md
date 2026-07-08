---
name: Public eval link scope
description: Freelancer public evaluation link must cover the whole questionnaire, not one criterion; auth pattern for raw-fetch hook files.
---

The "Link Freelancer" public evaluation link is scoped to an event+evaluator, covering ALL of that evaluator's eligible criteria for the event in one single-use token, not one link per criterion.

**Why:** the user's requirement was that a freelancer filling in for an evaluator should answer the entire questionnaire in one go, not receive N separate links (one per criterion). This required migrating `publicEvalTokensTable` from a `criterionId` column to a token+criterion N:N join table (`publicEvalTokenCriteriaTable`), and rewriting `GET /public-eval/:token` and `POST /public-eval/:token/submit` to return/accept an array of criteria/evaluations instead of a single one.

**How to apply:** if asked to touch this feature again, keep the "one link = one full questionnaire" invariant. Eligible criteria = assigned to the evaluator, `allowPublicLink=true`, not yet submitted (see `criterion_routing.allow_public_link` and `event_criterion_assignments.status`).

Separately: raw-fetch hook files that don't go through the openapi-generated client (e.g. `routing-api.ts`, `my-performance.tsx` style) must manually attach `Authorization: Bearer <token>` via `getAuthToken()` from `custom-fetch.ts`. Using `credentials: "include"` (cookie auth) silently 401s because this app authenticates via a Bearer token in `localStorage`, not cookies.
