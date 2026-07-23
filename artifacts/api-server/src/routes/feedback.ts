import { Router } from "express";
import {
  db, eventsTable, eventParticipantsTable, evaluationsTable, calibrationsTable,
  eventCriteriaTable, criteriaTable, employeesTable, platoonRulesTable,
  eventAreaAssignmentsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { calculateEventResult, getPlatoonByScore, buildAssignedEvaluatorsByArea, getCriterionEvaluationStatus } from "../lib/calculations.js";
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
      responsibleAreaId: criteriaTable.responsibleAreaId,
      active: eventCriteriaTable.active,
      originalWeight: criteriaTable.defaultWeight,
      weightOverride: eventCriteriaTable.weightOverride,
      displayOrder: criteriaTable.displayOrder,
      partialPublishedAt: eventCriteriaTable.partialPublishedAt,
      finalPublishedAt: eventCriteriaTable.finalPublishedAt,
      eventScoped: criteriaTable.eventScoped,
    })
    .from(eventCriteriaTable)
    .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
    .where(and(eq(eventCriteriaTable.eventId, eventId), eq(eventCriteriaTable.active, true)));

  // Critérios eventScoped (duplicados) são mesclados no pai pelo mergeEventScopedCriteria;
  // não entram no cálculo de isComplete nem na publicação de feedback como linhas independentes.
  const activeCriteria = eventCriteriaRows
    .filter(c => !c.eventScoped)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const allEvals = await db.select().from(evaluationsTable).where(eq(evaluationsTable.eventId, eventId));
  const allCalibrations = await db.select().from(calibrationsTable).where(eq(calibrationsTable.eventId, eventId));
  const areaAssignments = await db.select({ areaId: eventAreaAssignmentsTable.areaId, evaluatorUserId: eventAreaAssignmentsTable.evaluatorUserId })
    .from(eventAreaAssignmentsTable).where(eq(eventAreaAssignmentsTable.eventId, eventId));
  const assignedByArea = buildAssignedEvaluatorsByArea(areaAssignments);

  const criteria = activeCriteria.map(c => {
    const weight = parseFloat(c.weightOverride ?? c.originalWeight ?? "1");
    const submittedEvals = allEvals.filter(e => e.criterionId === c.criterionId && e.status === "submitted");
    const evalScores = submittedEvals.map(e => parseFloat(e.score as unknown as string));
    const averageScore = evalScores.length > 0 ? evalScores.reduce((a, b) => a + b, 0) / evalScores.length : null;
    const calibration = allCalibrations.find(cal => cal.criterionId === c.criterionId);
    const calibratedScore = calibration ? parseFloat(calibration.calibratedScore as unknown as string) : null;
    // "Avaliado" (scoreUsed não nulo) exige que TODOS os avaliadores designados
    // para a área do critério tenham enviado, ou que exista calibração.
    const completion = getCriterionEvaluationStatus(c.responsibleAreaId, submittedEvals.map(e => e.evaluatorUserId as number), assignedByArea);
    const isEvaluated = calibratedScore !== null || completion.isEvaluated;
    const scoreUsed = isEvaluated ? (calibratedScore !== null ? calibratedScore : averageScore) : null;
    return {
      criterionId: c.criterionId,
      name: c.criterionName ?? "",
      weight,
      averageScore,
      calibratedScore,
      scoreUsed,
      partialPublishedAt: c.partialPublishedAt,
      finalPublishedAt: c.finalPublishedAt,
    };
  });

  // Rollup do evento = publicação parcial mais recente entre os critérios
  // ativos (a fonte real agora é por critério — ver /events/:id/criteria/:criterionId/publish-partial).
  const partialTimestamps = criteria.map(c => c.partialPublishedAt).filter((d): d is Date => d != null);
  const partialPublishedAt = partialTimestamps.length > 0
    ? new Date(Math.max(...partialTimestamps.map(d => d.getTime())))
    : null;

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
  if (platoon) lines.push(`🎖️ Faixa de bônus projetada: ${platoon.minScore}–${platoon.maxScore}`);
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
    feedbackReleasedAt: event.feedbackReleasedAt,
    partialPublishedAt,
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
  res.json({ ...feedback, feedbackReleased: updated.feedbackReleased, feedbackReleasedAt: updated.feedbackReleasedAt });
});

/**
 * POST /events/:id/criteria/:criterionId/publish-partial
 * Publica um retrato PARCIAL do feedback de UM critério específico (sem
 * exigir conclusão das avaliações desse ou de outros critérios, e sem
 * fechar o evento). Pode ser chamado várias vezes por critério — cada
 * chamada apenas atualiza a data. O status por critério (parcial/final)
 * é independente do release geral do evento.
 */
router.post("/events/:id/criteria/:criterionId/publish-partial", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const criterionId = parseInt(req.params.criterionId as string);

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!event) { res.status(404).json({ error: "Evento não encontrado" }); return; }

  const [link] = await db.select().from(eventCriteriaTable)
    .where(and(eq(eventCriteriaTable.eventId, eventId), eq(eventCriteriaTable.criterionId, criterionId), eq(eventCriteriaTable.active, true)))
    .limit(1);
  if (!link) { res.status(404).json({ error: "Critério não encontrado ou inativo neste evento" }); return; }

  const [updated] = await db.update(eventCriteriaTable).set({
    partialPublishedAt: new Date(),
    partialPublishedByUserId: req.user!.userId,
    finalPublishedAt: null,
    finalPublishedByUserId: null,
  }).where(eq(eventCriteriaTable.id, link.id)).returning();
  await audit(req.user!.userId, "publish_partial_feedback", "event_criteria", updated.id, null, { eventId, criterionId });

  const feedback = await buildEventFeedback(eventId);
  res.json({ ...feedback, criterionId, criterionPartialPublishedAt: updated.partialPublishedAt });
});

/**
 * POST /events/:id/criteria/:criterionId/publish-final
 * Publica a nota de UM critério como "FINAL" — o colaborador vê sem o aviso
 * de "projeção parcial". Não trava edição: se a calibração mudar depois, o
 * colaborador vê automaticamente o valor atualizado (o critério continua
 * marcado como Final). Pode ser chamado várias vezes (cada chamada atualiza
 * a data). Disponível mesmo se o evento não estiver fechado.
 */
router.post("/events/:id/criteria/:criterionId/publish-final", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const criterionId = parseInt(req.params.criterionId as string);

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!event) { res.status(404).json({ error: "Evento não encontrado" }); return; }

  const [link] = await db.select().from(eventCriteriaTable)
    .where(and(eq(eventCriteriaTable.eventId, eventId), eq(eventCriteriaTable.criterionId, criterionId), eq(eventCriteriaTable.active, true)))
    .limit(1);
  if (!link) { res.status(404).json({ error: "Critério não encontrado ou inativo neste evento" }); return; }

  const now = new Date();
  const [updated] = await db.update(eventCriteriaTable).set({
    finalPublishedAt: now,
    finalPublishedByUserId: req.user!.userId,
    partialPublishedAt: link.partialPublishedAt ?? now,
    partialPublishedByUserId: link.partialPublishedByUserId ?? req.user!.userId,
  }).where(eq(eventCriteriaTable.id, link.id)).returning();
  await audit(req.user!.userId, "publish_final_feedback", "event_criteria", updated.id, null, { eventId, criterionId });

  res.json({ criterionId, finalPublishedAt: updated.finalPublishedAt, partialPublishedAt: updated.partialPublishedAt });
});

/**
 * POST /events/:id/criteria/publish-partial-all
 * Publica um retrato PARCIAL de TODOS os critérios ativos do evento de uma
 * vez (sem exigir conclusão das avaliações nem fechar o evento). Bloqueado
 * depois que a avaliação final do evento já foi publicada.
 */
router.post("/events/:id/criteria/publish-partial-all", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const eventId = parseInt(req.params.id as string);

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!event) { res.status(404).json({ error: "Evento não encontrado" }); return; }
  if (event.feedbackReleased) {
    res.status(400).json({ error: "A avaliação final já foi publicada para este evento e não pode voltar a ser parcial" });
    return;
  }

  const allLinks = await db
    .select({ id: eventCriteriaTable.id, eventScoped: criteriaTable.eventScoped })
    .from(eventCriteriaTable)
    .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
    .where(and(eq(eventCriteriaTable.eventId, eventId), eq(eventCriteriaTable.active, true)));
  const criteriaLinks = allLinks.filter(c => !c.eventScoped);

  const now = new Date();
  for (const link of criteriaLinks) {
    await db.update(eventCriteriaTable).set({
      partialPublishedAt: now,
      partialPublishedByUserId: req.user!.userId,
    }).where(eq(eventCriteriaTable.id, link.id));
  }
  await audit(req.user!.userId, "publish_partial_all_feedback", "events", eventId, null, { count: criteriaLinks.length });

  res.json({ published: criteriaLinks.length, partialPublishedAt: now });
});

/**
 * POST /events/:id/criteria/publish-final-all
 * Publica TODOS os critérios ativos do evento como "FINAL" de uma vez.
 */
router.post("/events/:id/criteria/publish-final-all", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const eventId = parseInt(req.params.id as string);

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!event) { res.status(404).json({ error: "Evento não encontrado" }); return; }

  const allFinalLinks = await db
    .select({ id: eventCriteriaTable.id, partialPublishedAt: eventCriteriaTable.partialPublishedAt, eventScoped: criteriaTable.eventScoped })
    .from(eventCriteriaTable)
    .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
    .where(and(eq(eventCriteriaTable.eventId, eventId), eq(eventCriteriaTable.active, true)));
  const criteriaLinks = allFinalLinks.filter(c => !c.eventScoped);

  const now = new Date();
  for (const link of criteriaLinks) {
    await db.update(eventCriteriaTable).set({
      finalPublishedAt: now,
      finalPublishedByUserId: req.user!.userId,
      partialPublishedAt: link.partialPublishedAt ?? now,
      partialPublishedByUserId: link.partialPublishedByUserId ?? req.user!.userId,
    }).where(eq(eventCriteriaTable.id, link.id));
  }
  await audit(req.user!.userId, "publish_final_all_feedback", "events", eventId, null, { count: criteriaLinks.length });

  res.json({ published: criteriaLinks.length, finalPublishedAt: now });
});

/**
 * POST /events/:id/unrelease
 * Desfaz a liberação final do feedback do evento, voltando ao estado pré-lançamento.
 * Admin/RH only. Permite republicar as notas como parcial ou ajustar calibrações.
 */
router.post("/events/:id/unrelease", requireRole("admin", "rh"), async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!event) { res.status(404).json({ error: "Evento não encontrado." }); return; }
  if (!event.feedbackReleased) { res.status(400).json({ error: "Evento ainda não foi liberado." }); return; }
  await db.update(eventsTable)
    .set({ feedbackReleased: false, feedbackReleasedAt: null })
    .where(eq(eventsTable.id, eventId));
  await audit(req.user!.userId, "unrelease_feedback", "events", eventId, null, {});
  res.json({ success: true });
});

export default router;
