import { Router } from "express";
import { db, absencesTable, employeesTable, eventsTable, penaltyTypesTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import { getCurrentCycle } from "../lib/cycle.js";

const router = Router();
router.use(requireAuth);

async function loadCatalog(): Promise<Map<string, { label: string; points: number; kind: "penalty" | "merit"; requiresEvent: boolean }>> {
  const rows = await db.select().from(penaltyTypesTable).where(eq(penaltyTypesTable.active, true)).orderBy(asc(penaltyTypesTable.displayOrder));
  const map = new Map<string, { label: string; points: number; kind: "penalty" | "merit"; requiresEvent: boolean }>();
  for (const r of rows) {
    map.set(r.slug, { label: r.label, points: r.points, kind: r.kind as "penalty" | "merit", requiresEvent: r.requiresEvent });
  }
  return map;
}

router.get("/absences", async (req, res) => {
  const { employeeId } = req.query;
  const cycle = await getCurrentCycle();
  if (!cycle) { res.json([]); return; }
  let query = db.select({
    id: absencesTable.id,
    employeeId: absencesTable.employeeId,
    employeeName: employeesTable.name,
    eventId: absencesTable.eventId,
    eventName: eventsTable.name,
    penaltyType: absencesTable.penaltyType,
    kind: absencesTable.kind,
    points: absencesTable.points,
    date: absencesTable.date,
    cycleId: absencesTable.cycleId,
    quantity: absencesTable.quantity,
    reason: absencesTable.reason,
    registeredByUserId: absencesTable.registeredByUserId,
    createdAt: absencesTable.createdAt,
  })
  .from(absencesTable)
  .leftJoin(employeesTable, eq(absencesTable.employeeId, employeesTable.id))
  .leftJoin(eventsTable, eq(absencesTable.eventId, eventsTable.id))
  .$dynamic();

  const conditions = [eq(absencesTable.cycleId, cycle.id)];
  if (employeeId) conditions.push(eq(absencesTable.employeeId, parseInt(employeeId as string)));
  query = query.where(and(...conditions));

  res.json(await query);
});

router.post("/absences", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const { employeeId, eventId, date, quantity, reason, penaltyType } = req.body;
  const type = (penaltyType as string) ?? "falta";
  if (!employeeId || !date) {
    res.status(400).json({ error: "Campos obrigatórios: employeeId, date" });
    return;
  }
  const cycle = await getCurrentCycle();
  if (!cycle) { res.status(400).json({ error: "Nenhum ciclo ativo" }); return; }

  const catalog = await loadCatalog();
  const entry = catalog.get(type);
  if (!entry) { res.status(400).json({ error: "Tipo de lançamento inválido" }); return; }

  if (entry.requiresEvent && !eventId) {
    res.status(400).json({ error: "Este tipo de lançamento exige um evento vinculado" });
    return;
  }
  const qty = quantity ?? 1;
  if (!Number.isInteger(qty) || qty < 1) {
    res.status(400).json({ error: "Quantidade deve ser um inteiro maior ou igual a 1" });
    return;
  }
  const [absence] = await db.insert(absencesTable).values({
    employeeId, eventId: eventId ?? null, penaltyType: type, kind: entry.kind, points: entry.points, date,
    cycleId: cycle.id, quantity: qty, reason: reason ?? null,
    registeredByUserId: req.user!.userId,
  }).returning();
  await audit(req.user!.userId, "create", "absences", absence.id, null, absence);
  res.status(201).json(absence);
});

router.patch("/absences/:id", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const existing = await db.select().from(absencesTable).where(eq(absencesTable.id, id)).limit(1);
  if (!existing[0]) { res.status(404).json({ error: "Lançamento não encontrado" }); return; }

  const { penaltyType, eventId, date, quantity, reason } = req.body;
  const update: Record<string, unknown> = {};

  if (penaltyType !== undefined && penaltyType !== existing[0].penaltyType) {
    const catalog = await loadCatalog();
    const entry = catalog.get(penaltyType as string);
    if (!entry) { res.status(400).json({ error: "Tipo de lançamento inválido" }); return; }
    if (entry.requiresEvent && !eventId && !existing[0].eventId) {
      res.status(400).json({ error: "Este tipo de lançamento exige um evento vinculado" }); return;
    }
    update.penaltyType = penaltyType;
    update.kind = entry.kind;
    update.points = entry.points;
  }
  if (eventId !== undefined) update.eventId = eventId === null ? null : Number(eventId);
  if (date !== undefined) update.date = date;
  if (quantity !== undefined) {
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      res.status(400).json({ error: "Quantidade deve ser um inteiro maior ou igual a 1" }); return;
    }
    update.quantity = qty;
  }
  if (reason !== undefined) update.reason = reason;

  if (Object.keys(update).length === 0) { res.json(existing[0]); return; }
  const [updated] = await db.update(absencesTable).set(update).where(eq(absencesTable.id, id)).returning();
  await audit(req.user!.userId, "update", "absences", id, existing[0], updated);
  res.json(updated);
});

router.delete("/absences/:id", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [existing] = await db.select().from(absencesTable).where(eq(absencesTable.id, id)).limit(1);
  await db.delete(absencesTable).where(eq(absencesTable.id, id));
  await audit(req.user!.userId, "delete", "absences", id, existing);
  res.status(204).end();
});

export default router;
