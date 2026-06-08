import { Router } from "express";
import {
  db, eventsTable, eventParticipantsTable, evaluationsTable, calibrationsTable,
  eventCriteriaTable, criteriaTable, employeesTable, platoonRulesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { calculateEventResult, getPlatoonByScore } from "../lib/calculations.js";
import { audit } from "../lib/audit.js";
import { recomputeCycleResults } from "./results.js";

const router = Router();
router.use(requireAuth);

async function buildEventFeedback(eventId: number) {
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!event) return null;

  const eventCriteriaRows = await db
    .select({
      criterionId: eventCriteriaTable.criterionId,
      criterionName: criteriaTable.name,
      active: eventCriteriaTable.active,
      originalWeight: criteriaTable.defaultWeight,
      weightOverride: eventCriteriaTable.weightOverride,
      displayOrder: criteriaTable.displayOrder,
    })
    .from(eventCriteriaTable)
    .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
    .where(and(eq(eventCriteriaTable.eventId, eventId), eq(eventCriteriaTable.active, true)));

  const activeCriteria = eventCriteriaRows.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const allEvals = await db.select().from(evaluationsTable).where(eq(evaluationsTable.eventId, eventId));
  const allCalibrations = await db.select().from(calibrationsTable).where(eq(calibrationsTable.eventId, eventId));

  const criteria = activeCriteria.map(c => {
    const weight = parseFloat(c.weightOverride ?? c.originalWeight ?? "1");
    const evalScores = allEvals
      .filter(e => e.criterionId === c.criterionId && e.status === "submitted")
      .map(e => parseFloat(e.score as unknown as string));
    const averageScore = evalScores.length > 0 ? evalScores.reduce((a, b) => a + b, 0) / evalScores.length : null;
    const calibration = allCalibrations.find(cal => cal.criterionId === c.criterionId);
    const calibratedScore = calibration ? parseFloat(calibration.calibratedScore as unknown as string) : null;
    const scoreUsed = calibratedScore !== null ? calibratedScore : averageScore;
    return { name: c.criterionName ?? "", weight, averageScore, calibratedScore, scoreUsed };
  });

  const criteriaForCalc = criteria.map(c => ({ criterionId: 0, weight: c.weight, averageScore: c.averageScore, calibratedScore: c.calibratedScore }));
  const eventScore = calculateEventResult(criteriaForCalc);

  const pending = criteria.filter(c => c.scoreUsed === null);
  const isComplete = criteria.length > 0 && pending.length === 0;

  const platoonRules = await db.select().from(platoonRulesTable).where(eq(platoonRulesTable.active, true)).orderBy(platoonRulesTable.displayOrder);
  const platoonMapped = platoonRules.map(r => ({
    name: r.name, color: r.color,
    minScore: parseFloat(r.minScore as unknown as string),
    maxScore: parseFloat(r.maxScore as unknown as string),
    minInclusive: r.minInclusive, maxInclusive: r.maxInclusive,
    bonusValue: parseFloat(r.bonusValue as unknown as string),
  }));
  const platoon = getPlatoonByScore(eventScore, platoonMapped);

  const participants = await db
    .select({ name: employeesTable.name })
    .from(eventParticipantsTable)
    .leftJoin(employeesTable, eq(eventParticipantsTable.employeeId, employeesTable.id))
    .where(eq(eventParticipantsTable.eventId, eventId));

  // Destaques (>= 4) e pontos de atenção (<= 2) — NUNCA expõe avaliadores
  const highlights = criteria.filter(c => c.scoreUsed !== null && c.scoreUsed >= 4).map(c => c.name);
  const attentionPoints = criteria.filter(c => c.scoreUsed !== null && c.scoreUsed <= 2).map(c => c.name);

  const lines: string[] = [];
  lines.push(`📣 Feedback do Evento — ${event.name}`);
  if (event.city || event.state) lines.push(`📍 ${[event.city, event.state].filter(Boolean).join("/")}`);
  lines.push("");
  lines.push(`🏆 Nota do time no evento: ${eventScore.toFixed(0)}/100`);
  if (platoon) lines.push(`🎖️ Pelotão projetado: ${platoon.name}`);
  lines.push(`✅ Critérios avaliados: ${criteria.length - pending.length} de ${criteria.length}`);
  lines.push("");
  if (highlights.length > 0) {
    lines.push("✨ Destaques positivos:");
    highlights.forEach(h => lines.push(`  • ${h}`));
    lines.push("");
  }
  if (attentionPoints.length > 0) {
    lines.push("⚠️ Pontos de atenção:");
    attentionPoints.forEach(a => lines.push(`  • ${a}`));
    lines.push("");
  }
  lines.push(`👥 Time participante: ${participants.map(p => p.name).filter(Boolean).join(", ")}`);
  lines.push("");
  lines.push("Lembrete: a nota é do time do evento e é a mesma para todos os participantes.");

  return {
    eventId,
    eventName: event.name,
    eventScore,
    projectedPlatoon: platoon?.name ?? null,
    totalCriteria: criteria.length,
    evaluatedCriteria: criteria.length - pending.length,
    isComplete,
    feedbackReleased: event.feedbackReleased,
    highlights,
    attentionPoints,
    text: lines.join("\n"),
  };
}

/**
 * GET /events/:id/feedback
 * Gera o texto de feedback do evento. Só pode ser liberado quando todas as
 * avaliações estiverem concluídas. Nunca expõe nomes de avaliadores.
 */
router.get("/events/:id/feedback", async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const feedback = await buildEventFeedback(eventId);
  if (!feedback) { res.status(404).json({ error: "Evento não encontrado" }); return; }

  // Colaborador/visualizador só vê feedback liberado
  const restrictedRoles = ["colaborador", "visualizador"];
  if (restrictedRoles.includes(req.user!.role) && !feedback.feedbackReleased) {
    res.status(403).json({ error: "Feedback ainda não liberado para este evento" });
    return;
  }
  res.json(feedback);
});

/**
 * POST /events/:id/feedback/release
 * Libera o feedback do evento (somente após avaliações concluídas).
 */
router.post("/events/:id/feedback/release", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const feedback = await buildEventFeedback(eventId);
  if (!feedback) { res.status(404).json({ error: "Evento não encontrado" }); return; }
  if (!feedback.isComplete) {
    res.status(400).json({ error: "O feedback só pode ser liberado após a conclusão de todas as avaliações do evento" });
    return;
  }
  const [updated] = await db.update(eventsTable).set({
    feedbackReleased: true,
    feedbackReleasedAt: new Date(),
  }).where(eq(eventsTable.id, eventId)).returning();
  await audit(req.user!.userId, "release_feedback", "events", eventId);
  await recomputeCycleResults(updated.cycleId, req.user!.userId);
  res.json({ ...feedback, feedbackReleased: updated.feedbackReleased });
});

export default router;
