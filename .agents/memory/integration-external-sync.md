---
name: integration external sync contract
description: How maratona pulls data from the external logistica-interna app, and what that app must expose.
---

# External API sync (Integração & Dados)

Maratona's `POST /api/integration/sync` pulls data from an external Replit app and upserts it locally.

- Config: `EXTERNAL_API_URL` (env, e.g. https://logistica-interna.replit.app) + `EXTERNAL_API_TOKEN` (secret). Both must be set or sync returns "não configurada".
- The external app must expose three JSON GET endpoints, all requiring `Authorization: Bearer <EXTERNAL_API_TOKEN>` (same token value on both apps):
  - `/api/integration/employees` → `[{ externalId, name, document?, email?, phone?, department?, functionName?, active? }]`
  - `/api/integration/events` → `[{ externalId, name, clientName?, location?, city?, state?, startDate(YYYY-MM-DD), endDate?, year?, quarter? }]`
  - `/api/integration/participations` → `[{ eventExternalId, employeeExternalId, functionName?, teamName?, confirmed? }]`

**Why:** `externalId` is the upsert key (employees/events); participations upsert by resolved `(eventId, employeeId)`. A participation whose event/employee externalId isn't found is skipped and logged.

**How to apply:** year/quarter derived from startDate when absent; synced employees get `sourceType: "erp"`. Sync runs in a DB transaction with a single-flight `syncing` guard. Status endpoint surfaces the last run's log lines.

**Scope filter (event-year driven):** the sync only imports (1) events of `TARGET_YEAR` (2026) **that have already finished** (`endDate < today`), (2) participations in those events whose function is "Cenotécnica" or "Cenotécnica Local" (`ALLOWED_FUNCTIONS`, accent/case-insensitive), and (3) the collaborators referenced by those kept participations. Everything else is ignored. **Why:** only finished events have a stable function/person assignment — importing future events would re-import changing data. To change scope, edit `TARGET_YEAR` / `ALLOWED_FUNCTIONS` / the finished-event check in integration.ts.

**Idempotency / no-duplicate guarantee:** upserts use `onConflictDoUpdate` backed by DB unique indexes — `employees.external_id`, `events.external_id`, and composite `event_participants(event_id, employee_id)`. Re-running sync with the same payload yields identical counts and zero new rows. **Why a past attempt failed:** PARTIAL unique indexes (`.where(sql\`external_id IS NOT NULL\`)`) break `ON CONFLICT` target inference (Postgres needs the predicate in the conflict clause). Use PLAIN `uniqueIndex` instead — multiple NULL `external_id` rows are still allowed because Postgres treats NULLs as distinct. Also: `drizzle-kit push` does NOT detect a partial→plain predicate change, so that one had to be fixed with manual `DROP INDEX` + `CREATE UNIQUE INDEX`.
