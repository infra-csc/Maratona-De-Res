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

const DEFAULT_PENALTY_TYPES = [
  { slug: "falta", label: "Ausência Não Comunicada", points: 50, kind: "penalty" as const, requiresEvent: false, active: true, displayOrder: 1 },
  { slug: "atraso", label: "Atraso > 30 Minutos", points: 10, kind: "penalty" as const, requiresEvent: false, active: true, displayOrder: 2 },
  { slug: "inconformidade_ponto", label: "Inconformidade de Ponto", points: 10, kind: "penalty" as const, requiresEvent: false, active: true, displayOrder: 3 },
  { slug: "merito_galpao", label: "Rei do Galpão", points: 50, kind: "merit" as const, requiresEvent: false, active: true, displayOrder: 4 },
  { slug: "merito_evento", label: "Estrela do Evento", points: 25, kind: "merit" as const, requiresEvent: false, active: true, displayOrder: 5 },
  { slug: "colega_top", label: "Colega Top", points: 10, kind: "merit" as const, requiresEvent: false, active: true, displayOrder: 6 },
];

router.post("/penalty-types/seed-defaults", requireRole("admin"), async (req, res) => {
  const existing = await db.select({ slug: penaltyTypesTable.slug }).from(penaltyTypesTable);
  const existingSlugs = new Set(existing.map(r => r.slug));
  const toInsert = DEFAULT_PENALTY_TYPES.filter(d => !existingSlugs.has(d.slug));
  if (toInsert.length === 0) {
    res.json({ inserted: 0, message: "Todos os tipos padrão já existem" });
    return;
  }
  const inserted = await db.insert(penaltyTypesTable).values(toInsert).returning();
  await audit(req.user!.userId, "seed_defaults", "penalty_types", undefined, undefined, { inserted: inserted.map(r => r.slug) });
  res.json({ inserted: inserted.length, types: inserted });
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
