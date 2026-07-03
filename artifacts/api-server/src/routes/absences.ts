import { Router } from "express";
import { db, absencesTable, employeesTable, eventsTable, rulesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import { getCurrentCycle } from "../lib/cycle.js";

const router = Router();
router.use(requireAuth);

/**
 * Catálogo de penalidades (matriz de pontuação oficial). Pontos fixos por
 * tipo, subtraídos da nota final (com clamp 0-100): Ausência Não Comunicada
 * = 50, Atraso > 30 Minutos = 10. (`points` segue `number | null` por
 * compatibilidade.)
 */
export const PENALTY_CATALOG: Record<string, { label: string; points: number | null }> = {
  falta: { label: "Ausência Não Comunicada", points: 50 },
  atraso: { label: "Atraso > 30 Minutos", points: 10 },
  inconformidade_ponto: { label: "Inconformidade de Ponto", points: 10 },
};

/**
 * Tipos de lançamento que exigem um evento vinculado (não podem ser
 * lançados apenas no ciclo, sem uma prova/evento específico).
 */
export const EVENT_REQUIRED_TYPES = new Set(["inconformidade_ponto"]);

/**
 * Catálogo de méritos (Pontos por Desempenho, matriz oficial). Pontos
 * positivos somados à nota final (com clamp 0-100). Lançados manualmente
 * pelo RH/admin. `merito_galpao` = Rei do Galpão, ao fim do período (por
 * ciclo, sem evento); `merito_evento` = Estrela do Evento, ação
 * extraordinária na prova; `colega_top` = Colega Top, postura exemplar na
 * prova.
 */
export const MERIT_CATALOG: Record<string, { label: string; points: number }> = {
  merito_galpao: { label: "Rei do Galpão", points: 50 },
  merito_evento: { label: "Estrela do Evento", points: 25 },
  colega_top: { label: "Colega Top", points: 10 },
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
  if (EVENT_REQUIRED_TYPES.has(type) && !eventId) {
    res.status(400).json({ error: "Este tipo de lançamento exige um evento vinculado" });
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
