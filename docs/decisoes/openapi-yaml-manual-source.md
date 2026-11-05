---
name: OpenAPI spec is a hand-maintained YAML file
description: Where the generated API client's types actually come from, and why adding a field to a route handler alone isn't enough
---

# Rule
`lib/api-spec/openapi.yaml` is the manually-maintained source of truth that `orval` (via `pnpm --filter @workspace/api-spec run codegen`) reads to generate `lib/api-client-react/src/generated/*`. It is NOT auto-derived from the Express route code or Drizzle schema.

**Why:** adding a new field to a route's request/response object in `routes/*.ts` (e.g. a new DB column being returned) has zero effect on the generated frontend client/types until the corresponding schema block in `openapi.yaml` is updated to declare that field.

**How to apply:** whenever a route's request/response shape changes (new column exposed, field added/removed), update the matching schema in `lib/api-spec/openapi.yaml` first, then run the codegen script, then typecheck both `api-server` and the frontend app to confirm the new field flows through end-to-end.

# Inline body schemas break the zod codegen
Never give a `requestBody` (or any repeated shape) an inline `type: object` schema — always define it under `components/schemas` (following the `XInput`/`XUpdate` naming convention) and reference it via `$ref`.

**Why:** the zod codegen target splits schema values (`lib/api-zod/src/generated/api.ts`) and inferred TS types (`generated/types.ts`) into separate files. An inline body has no schema name to key off besides the operationId, so orval names both the zod const and the inferred type identically (e.g. `UpdateXBody`), and `lib/api-zod/src/index.ts`'s `export *` re-export then fails with TS2308 "already exported a member".

**How to apply:** if `pnpm --filter @workspace/api-spec run codegen`'s `typecheck:libs` step fails with a `TS2308` "already exported a member named 'XBody'" error, the fix is to replace the inline body schema with a named `$ref`'d schema, not to rename anything by hand.
