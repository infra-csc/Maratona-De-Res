---
name: Prod data changes need in-app admin action
description: Agent's production DB access is read-only; real data mutations must ship as an app feature the user triggers.
---

The agent's `executeSql` access to the production database is read-only (SELECT only). There is no path for the agent to directly UPDATE/INSERT/DELETE production rows.

**Why:** Enforced by the platform's database safety rules — production is a read replica for the agent, full read/write only exists for the development database.

**How to apply:** Whenever a task requires changing real production data (fixing bad rows, bulk backfills, one-off corrections, config values like criteria weights), the agent must build the change as an in-app action (an admin-gated button/form using the app's own mutation endpoints) and have the actual user execute it against production after deploying — never attempt a workaround SQL script or ask for elevated DB credentials. Document in the commit message exactly which button/page the user needs to click and in what order.
