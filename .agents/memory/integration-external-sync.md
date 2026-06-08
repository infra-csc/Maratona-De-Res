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
