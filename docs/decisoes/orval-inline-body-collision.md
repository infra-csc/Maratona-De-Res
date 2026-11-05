---
name: Orval inline body collision
description: Inline request body schemas in OpenAPI cause orval to generate duplicate type names, breaking typecheck.
---

When a POST/PUT operation defines its `requestBody` schema inline (not via `$ref`), orval generates:
1. A Zod schema named `{OperationId}Body` inside `lib/api-zod/src/generated/api.ts`
2. A TypeScript type also named `{OperationId}Body` inside `lib/api-zod/src/generated/types/{operationId}Body.ts`

Both are re-exported from `lib/api-zod/src/index.ts` → **TS2308: Module has already exported '{Name}'**.

**Why:** orval uses the operationId to derive the body type name in two independent places when the schema is anonymous (inline).

**How to apply:** For every POST/PUT request body in `lib/api-spec/openapi.yaml`, always define a named schema in `components/schemas/` and reference it with `$ref: "#/components/schemas/MyInput"`. Never use inline `schema: { type: object, properties: { ... } }` directly in requestBody. This matches the existing pattern used by `EventConformityInput`, `AbsenceInput`, etc.
