import { Router } from "express";
import { db, penaltyTypesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

export async function loadPenaltyLabels(): Promise<Map<string, string>> {
  const rows = await db.select({ slug: penaltyTypesTable.slug, label: penaltyTypesTable.label }).from(penaltyTypesTable).orderBy(asc(penaltyTypesTable.id));
  return new Map(rows.map(r => [r.slug, r.label]));
}

const router = Router();
router.use(requireAuth);

router.get("/penalty-types", async (_req, res) => {
  const rows = await db
    .select()
    .from(penaltyTypesTable)
    .orderBy(asc(penaltyTypesTable.displayOrder), asc(penaltyTypesTable.id));
  res.json(rows);
});

router.post("/penalty-types", requireRole("admin", "rh"), async (req, res) => {
  const { slug, label, points, kind, requiresEvent, active, displayOrder } = req.body;
  if (!slug || !label || points == null || !kind) {
    res.status(400).json({ error: "Campos obrigatórios: slug, label, points, kind" });
    return;
  }
  if (!["penalty", "merit"].includes(kind)) {
    res.status(400).json({ error: "kind deve ser 'penalty' ou 'merit'" });
    return;
  }
  if (!Number.isInteger(Number(points)) || Number(points) < 0) {
    res.status(400).json({ error: "points deve ser um inteiro não-negativo" });
    return;
  }
  const [row] = await db.insert(penaltyTypesTable).values({
    slug, label, points: Number(points), kind,
    requiresEvent: requiresEvent ?? false,
    active: active ?? true,
    displayOrder: displayOrder ?? 0,
  }).returning();
  await audit(req.user!.userId, "create", "penalty_types", row.id, null, row);
  res.status(201).json(row);
});

router.put("/penalty-types/:id", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { label, points, requiresEvent, active, displayOrder } = req.body;
  const existing = await db.select().from(penaltyTypesTable).where(eq(penaltyTypesTable.id, id)).limit(1);
  if (!existing[0]) { res.status(404).json({ error: "Tipo não encontrado" }); return; }
  const update: Record<string, unknown> = {};
  if (label !== undefined) update.label = label;
  if (points !== undefined) {
    if (!Number.isInteger(Number(points)) || Number(points) < 0) {
      res.status(400).json({ error: "points deve ser um inteiro não-negativo" }); return;
    }
    update.points = Number(points);
  }
  if (requiresEvent !== undefined) update.requiresEvent = requiresEvent;
  if (active !== undefined) update.active = active;
  if (displayOrder !== undefined) update.displayOrder = displayOrder;
  const [updated] = await db.update(penaltyTypesTable).set(update).where(eq(penaltyTypesTable.id, id)).returning();
  await audit(req.user!.userId, "update", "penalty_types", id, existing[0], updated);
  res.json(updated);
});

router.delete("/penalty-types/:id", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const existing = await db.select().from(penaltyTypesTable).where(eq(penaltyTypesTable.id, id)).limit(1);
  if (!existing[0]) { res.status(404).json({ error: "Tipo não encontrado" }); return; }
  await db.delete(penaltyTypesTable).where(eq(penaltyTypesTable.id, id));
  await audit(req.user!.userId, "delete", "penalty_types", id);
  res.status(204).end();
});

export default router;
