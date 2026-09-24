import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();

// Probe do deploy: sem tocar o banco, uma instância com pool esgotado ou
// DATABASE_URL errada era considerada saudável.
router.get("/healthz", async (_req, res) => {
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("db timeout")), 2000));
  try {
    await Promise.race([pool.query("select 1"), timeout]);
    res.json(HealthCheckResponse.parse({ status: "ok" }));
  } catch (err) {
    res.status(503).json({ status: "degraded", error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
