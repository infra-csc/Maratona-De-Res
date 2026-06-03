import { Router } from "express";
import { db, criteriaTable, areasTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);

router.get("/criteria", async (_req, res) => {
  const criteria = await db
    .select({
      id: criteriaTable.id,
      name: criteriaTable.name,
      description: criteriaTable.description,
      responsibleAreaId: criteriaTable.responsibleAreaId,
      responsibleAreaName: areasTable.name,
      defaultWeight: criteriaTable.defaultWeight,
      active: criteriaTable.active,
      displayOrder: criteriaTable.displayOrder,
    })
    .from(criteriaTable)
    .leftJoin(areasTable, eq(criteriaTable.responsibleAreaId, areasTable.id))
    .orderBy(criteriaTable.displayOrder, criteriaTable.name);
  res.json(criteria.map(c => ({ ...c, defaultWeight: parseFloat(c.defaultWeight as unknown as string) })));
});

router.post("/criteria", requireRole("admin", "rh"), async (req, res) => {
  const { name, description, responsibleAreaId, defaultWeight, displayOrder } = req.body;
  if (!name) { res.status(400).json({ error: "Nome obrigatório" }); return; }
  const [criterion] = await db.insert(criteriaTable).values({
    name,
    description: description ?? null,
    responsibleAreaId: responsibleAreaId ?? null,
    defaultWeight: String(defaultWeight ?? 1),
    displayOrder: displayOrder ?? 0,
  }).returning();
  await audit(req.user!.userId, "create", "criteria", criterion.id, null, criterion);
  res.status(201).json(criterion);
});

router.patch("/criteria/:id", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description, responsibleAreaId, defaultWeight, active, displayOrder } = req.body;
  const [before] = await db.select().from(criteriaTable).where(eq(criteriaTable.id, id)).limit(1);
  if (!before) { res.status(404).json({ error: "Não encontrado" }); return; }
  const [criterion] = await db.update(criteriaTable).set({
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description }),
    ...(responsibleAreaId !== undefined && { responsibleAreaId }),
    ...(defaultWeight !== undefined && { defaultWeight: String(defaultWeight) }),
    ...(active !== undefined && { active }),
    ...(displayOrder !== undefined && { displayOrder }),
  }).where(eq(criteriaTable.id, id)).returning();
  await audit(req.user!.userId, "update", "criteria", id, before, criterion);
  res.json(criterion);
});

export default router;
