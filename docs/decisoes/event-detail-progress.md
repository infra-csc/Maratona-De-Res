---
name: Event detail progress source
description: Where event-detail "% avaliado" progress must come from
---
`loadEventDetail` (api-server events.ts) returns `evaluationMatrix: []` unconditionally — it is a placeholder, never populated.

**Rule:** Any evaluation-progress display on the event detail page must read the `evaluationProgress` number field (0–1) returned by `GET /events/:id`, computed as submitted/total evaluations. Do NOT derive progress from `evaluationMatrix` — it will always be 0%.

**Why:** A "Visão Geral" overview originally computed progress from `evaluationMatrix` cells and was silently always 0% because the matrix is empty.

**How to apply:** `evaluationProgress` mirrors the same metric on the `/events` list endpoint, so both views agree. It is non-confidential (visible to all roles); only the team score is manager-gated.
