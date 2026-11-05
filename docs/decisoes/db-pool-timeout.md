---
name: DB pool connection timeout
description: pg.Pool defaults cause infinite hangs under concurrent load; required settings to prevent this.
---

# DB Pool Timeout Settings

**Rule:** Always configure explicit timeouts on the shared pg.Pool in `lib/db/src/index.ts`.

The default `new Pool({ connectionString })` has:
- `connectionTimeoutMillis: 0` → waits **forever** when all connections are in use
- No `statement_timeout` → individual queries can hang indefinitely

**Why:** In production, bursts of concurrent requests (e.g. 10+ criterion-assignment loads simultaneously) can exhaust the 10-connection default pool. New queries queue with no timeout, causing the browser to show an infinite loading state that never errors out — the request just hangs silently with no log entry (pino only logs on response completion).

**Fix applied (lib/db/src/index.ts):**
```typescript
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  connectionTimeoutMillis: 10000,   // fail fast if pool exhausted
  idleTimeoutMillis: 30000,
  statement_timeout: 60000,          // kill slow queries after 60s
});
```

**How to apply:** Any time a new pg.Pool is created (or if the lib is reset), ensure these settings are present. Also wrap complex endpoint handlers in try/catch so DB errors surface as 500 responses rather than silent hangs.
