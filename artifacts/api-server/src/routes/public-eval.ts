import { Router } from "express";
import {
  db,
  publicEvalTokensTable,
  publicEvalTokenCriteriaTable,
  evaluationsTable,
  eventsTable,
  criteriaTable,
  eventCriterionAssignmentsTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

const router = Router();

// ---------------------------------------------------------------------------
// GET /public-eval/:token
// Rota pública (sem autenticação). Retorna informações do token e a lista de
// TODOS os critérios do questionário coberto por ele para o freelancer
// preencher o formulário de avaliação completo.
// ---------------------------------------------------------------------------
router.get("/public-eval/:token", async (req, res) => {
  const tokenId = req.params.token as string;

  const [token] = await db.select({
    id: publicEvalTokensTable.id,
    eventId: publicEvalTokensTable.eventId,
    createdByUserId: publicEvalTokensTable.createdByUserId,
    recipientName: publicEvalTokensTable.recipientName,
    submitterName: publicEvalTokensTable.submitterName,
    usedAt: publicEvalTokensTable.usedAt,
    createdAt: publicEvalTokensTable.createdAt,
  })
    .from(publicEvalTokensTable)
    .where(eq(publicEvalTokensTable.id, tokenId))
    .limit(1);

  if (!token) {
    res.status(404).json({ error: "Link não encontrado ou inválido" });
    return;
  }

  const [event] = await db.select({ id: eventsTable.id, name: eventsTable.name, status: eventsTable.status })
    .from(eventsTable).where(eq(eventsTable.id, token.eventId)).limit(1);

  const tokenCriteria = await db.select({
    criterionId: publicEvalTokenCriteriaTable.criterionId,
    criterionName: criteriaTable.name,
    criterionDescription: criteriaTable.description,
  })
    .from(publicEvalTokenCriteriaTable)
    .innerJoin(criteriaTable, eq(publicEvalTokenCriteriaTable.criterionId, criteriaTable.id))
    .where(eq(publicEvalTokenCriteriaTable.tokenId, tokenId));

  res.json({
    tokenId: token.id,
    isUsed: token.usedAt !== null,
    recipientName: token.recipientName,
    submitterName: token.submitterName,
    eventName: event?.name ?? null,
    eventStatus: event?.status ?? null,
    criteria: tokenCriteria,
  });
});

// ---------------------------------------------------------------------------
// POST /public-eval/:token/submit
// Rota pública (sem autenticação). O freelancer submete o QUESTIONÁRIO
// INTEIRO de uma vez (uma nota por critério coberto pelo token).
// Body: { submitterName: string; evaluations: { criterionId: number; score: number; comments?: string }[] }
// Cria uma avaliação por critério no nome do criador do token
// (evaluatorUserId = createdByUserId).
// ---------------------------------------------------------------------------
router.post("/public-eval/:token/submit", async (req, res) => {
  const tokenId = req.params.token as string;
  const { submitterName, evaluations } = req.body ?? {};

  if (!submitterName || typeof submitterName !== "string" || !submitterName.trim()) {
    res.status(400).json({ error: "Nome é obrigatório" });
    return;
  }
  if (!Array.isArray(evaluations) || evaluations.length === 0) {
    res.status(400).json({ error: "Nenhuma avaliação enviada" });
    return;
  }

  const parsedEvaluations: { criterionId: number; score: number; comments: string | null }[] = [];
  for (const item of evaluations) {
    const criterionId = parseInt(item?.criterionId);
    const score = typeof item?.score === "number" ? item.score : parseFloat(item?.score);
    if (isNaN(criterionId) || isNaN(score) || score < 1 || score > 10) {
      res.status(400).json({ error: "Cada critério precisa de uma nota entre 1 e 10" });
      return;
    }
    parsedEvaluations.push({
      criterionId,
      score,
      comments: typeof item?.comments === "string" && item.comments.trim() ? item.comments.trim() : null,
    });
  }

  const [token] = await db.select()
    .from(publicEvalTokensTable)
    .where(eq(publicEvalTokensTable.id, tokenId))
    .limit(1);

  if (!token) {
    res.status(404).json({ error: "Link não encontrado" });
    return;
  }
  if (token.usedAt !== null) {
    res.status(409).json({ error: "Este link já foi utilizado" });
    return;
  }
  if (token.createdByUserId === null) {
    res.status(400).json({ error: "Token inválido: sem avaliador vinculado" });
    return;
  }

  const tokenCriteria = await db.select({ criterionId: publicEvalTokenCriteriaTable.criterionId })
    .from(publicEvalTokenCriteriaTable)
    .where(eq(publicEvalTokenCriteriaTable.tokenId, tokenId));
  const tokenCriterionIds = new Set(tokenCriteria.map(c => c.criterionId));

  if (parsedEvaluations.some(e => !tokenCriterionIds.has(e.criterionId))) {
    res.status(400).json({ error: "Avaliação inclui um critério fora do questionário deste link" });
    return;
  }
  if (parsedEvaluations.length !== tokenCriterionIds.size) {
    res.status(400).json({ error: "É necessário avaliar todos os critérios do questionário" });
    return;
  }

  const [event] = await db.select({ status: eventsTable.status })
    .from(eventsTable).where(eq(eventsTable.id, token.eventId)).limit(1);

  if (!event || (event.status !== "open" && event.status !== "closed")) {
    res.status(400).json({ error: "Evento não está aberto para avaliações" });
    return;
  }

  const criterionIds = [...tokenCriterionIds];

  await db.transaction(async (tx) => {
    for (const item of parsedEvaluations) {
      await tx.insert(evaluationsTable).values({
        eventId: token.eventId,
        criterionId: item.criterionId,
        evaluatorUserId: token.createdByUserId!,
        score: item.score.toFixed(2),
        comments: item.comments,
        audioUrl: null,
        commentVisibility: "internal",
        status: "submitted",
        submittedAt: new Date(),
      });
    }

    await tx.update(publicEvalTokensTable).set({
      usedAt: new Date(),
      submitterName: submitterName.trim(),
    }).where(eq(publicEvalTokensTable.id, tokenId));

    await tx.update(eventCriterionAssignmentsTable).set({
      status: "submitted",
      updatedAt: new Date(),
    }).where(and(
      eq(eventCriterionAssignmentsTable.eventId, token.eventId),
      inArray(eventCriterionAssignmentsTable.criterionId, criterionIds),
    ));
  });

  res.json({ ok: true });
});

export default router;
