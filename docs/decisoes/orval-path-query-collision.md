---
name: Orval codegen path+query param name collision
description: Why an endpoint with BOTH a path param and query params breaks api-zod/api-client-react codegen
---

An OpenAPI operation that has BOTH a path parameter AND query parameters causes an ambiguous re-export and a typecheck failure during `pnpm --filter @workspace/api-spec run codegen`.

**Why:** for such an op (e.g. `getRankingDetail` with path `employeeId` + query `year,quarter`), orval generates `const GetRankingDetailParams` (the zod schema for the PATH param) in api-zod's `generated/api.ts` AND `type GetRankingDetailParams` (the merged params type) in the types output. The barrel `index.ts` does `export *` from both → two `GetRankingDetailParams` exports collide. Query-only ops are safe because orval names the query schema `GetXQueryParams` (no clash with the `GetXParams` merged type); path-only ops are safe because no merged params type is generated.

**How to apply:** do NOT mix a path param and query params on the same operation. Make the identifier a query param too (e.g. `GET /ranking-detail?employeeId=&year=&quarter=` instead of `GET /ranking/{employeeId}?year&quarter`). The whole app already uses query params everywhere, so this is consistent. After editing openapi, rerun codegen until clean.
