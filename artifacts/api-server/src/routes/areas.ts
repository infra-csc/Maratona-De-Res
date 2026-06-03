import { Router } from "express";
import { db, areasTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);

router.get("/areas", async (_req, res) => {
  const areas = await db.select().from(areasTable).orderBy(areasTable.name);
  res.json(areas);
});

router.post("/areas", requireRole("admin", "rh"), async (req, res) => {
  const { name, description } = req.body;
  if (!name) { res.status(400).json({ error: "Nome obrigatório" }); return; }
  const [area] = await db.insert(areasTable).values({ name, description: description ?? null }).returning();
  await audit(req.user!.userId, "create", "areas", area.id, null, area);
  res.status(201).json(area);
});

router.patch("/areas/:id", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description, active } = req.body;
  const [before] = await db.select().from(areasTable).where(eq(areasTable.id, id)).limit(1);
  if (!before) { res.status(404).json({ error: "Não encontrado" }); return; }
  const [area] = await db.update(areasTable).set({
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description }),
    ...(active !== undefined && { active }),
  }).where(eq(areasTable.id, id)).returning();
  await audit(req.user!.userId, "update", "areas", id, before, area);
  res.json(area);
});

export default router;
