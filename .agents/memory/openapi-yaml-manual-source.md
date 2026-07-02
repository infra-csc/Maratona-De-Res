---
name: OpenAPI spec is a hand-maintained YAML file
description: Where the generated API client's types actually come from, and why adding a field to a route handler alone isn't enough
---

# Rule
`lib/api-spec/openapi.yaml` is the manually-maintained source of truth that `orval` (via `pnpm --filter @workspace/api-spec run codegen`) reads to generate `lib/api-client-react/src/generated/*`. It is NOT auto-derived from the Express route code or Drizzle schema.

**Why:** adding a new field to a route's request/response object in `routes/*.ts` (e.g. a new DB column being returned) has zero effect on the generated frontend client/types until the corresponding schema block in `openapi.yaml` is updated to declare that field.

**How to apply:** whenever a route's request/response shape changes (new column exposed, field added/removed), update the matching schema in `lib/api-spec/openapi.yaml` first, then run the codegen script, then typecheck both `api-server` and the frontend app to confirm the new field flows through end-to-end.
