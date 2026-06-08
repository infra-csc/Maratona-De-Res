import { Router } from "express";
import { db, absencesTable, employeesTable, eventsTable, rulesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import { getCurrentCycle } from "../lib/cycle.js";

const router = Router();
router.use(requireAuth);

/**
 * Catálogo de penalidades. `points` fixo por tipo; quando null, usa a regra
 * configurável `absence_penalty_per_absence` (a "Falta" segue a regra do sistema).
 */
export const PENALTY_CATALOG: Record<string, { label: string; points: number | null }> = {
  falta: { label: "Falta", points: null },
  atraso_30: { label: "Atraso (30 min)", points: 50 },
  atraso_60: { label: "Atraso (1 hora)", points: 100 },
};

/**
 * Catálogo de méritos. Pontos positivos somados à nota final (com clamp 0-100).
 * Lançados manualmente pelo RH/admin. `merito_galpao` é por ciclo (sem evento);
 * `merito_evento` é eventual (por evento).
 */
export const MERIT_CATALOG: Record<string, { label: string; points: number }> = {
  merito_galpao: { label: "Mérito Galpão", points: 50 },
  merito_evento: { label: "Mérito Evento", points: 25 },
};

function catalogKind(type: string): "penalty" | "merit" | null {
  if (MERIT_CATALOG[type]) return "merit";
  if (PENALTY_CATALOG[type]) return "penalty";
  return null;
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
  if (!cycle) {
    res.status(400).json({ error: "Nenhum ciclo ativo" });
    return;
  }
  const kind = catalogKind(type);
  if (!kind) {
    res.status(400).json({ error: "Tipo de lançamento inválido" });
    return;
  }
  const qty = quantity ?? 1;
  if (!Number.isInteger(qty) || qty < 1) {
    res.status(400).json({ error: "Quantidade deve ser um inteiro maior ou igual a 1" });
    return;
  }
  let points: number | null = kind === "merit" ? MERIT_CATALOG[type].points : PENALTY_CATALOG[type].points;
  if (points === null) {
    const ruleRow = await db.select().from(rulesTable).where(eq(rulesTable.key, "absence_penalty_per_absence")).limit(1);
    points = ruleRow[0] ? parseFloat(ruleRow[0].value) : 50;
  }
  const [absence] = await db.insert(absencesTable).values({
    employeeId, eventId: eventId ?? null, penaltyType: type, kind, points, date, cycleId: cycle.id,
    quantity: qty, reason: reason ?? null,
    registeredByUserId: req.user!.userId,
  }).returning();
  await audit(req.user!.userId, "create", "absences", absence.id, null, absence);
  res.status(201).json(absence);
});

router.delete("/absences/:id", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(absencesTable).where(eq(absencesTable.id, id));
  await audit(req.user!.userId, "delete", "absences", id);
  res.status(204).end();
});

export default router;
