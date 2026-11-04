---
name: Public eval tokens — schema and submission flow
description: public_eval_tokens table structure, field roles, and how freelancer submissions create evaluations
---

Table: `public_eval_tokens`
- `id` — UUID, primary key, the token in the URL
- `event_id`, `criterion_id` — what event/criterion the token is for
- `created_by_user_id` — the internal evaluator who generated the link
- `recipient_name` — name entered BY THE AVALIADOR when generating ("who will receive it")
- `submitter_name` — name entered BY THE FREELANCER when submitting (can differ)
- `used_at` — null until submitted; single-use gate
- `created_at`

**Submission flow:**
When the freelancer submits via `POST /public-eval/:token/submit`:
1. Validates token exists and `used_at IS NULL`
2. Creates a regular `evaluations` row with `evaluator_user_id = created_by_user_id`
   - This makes the score count in the existing scoring system without schema changes to evaluations table
   - Audio is NOT required for public token submissions
3. Marks token `used_at = now()`, sets `submitter_name`
4. Updates `event_criterion_assignments.status = 'submitted'` for that event+criterion

**Area restriction:** Enforced via `criterion_routing.allow_public_link = true`. Frontend button shows for all criteria; backend rejects with 403 if not allowed.

**Frontend URL construction:**
```ts
const base = window.location.origin + (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const url = `${base}/eval/${tokenId}`;
```

**Production note:** `recipient_name` column added to dev DB. Must run `ALTER TABLE public_eval_tokens ADD COLUMN IF NOT EXISTS recipient_name text` on production before/at next deploy.
