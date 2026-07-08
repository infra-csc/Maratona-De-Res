import { Router } from "express";
import {
  db,
  publicEvalTokensTable,
  evaluationsTable,
  eventsTable,
  criteriaTable,
  eventCriterionAssignmentsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

// ---------------------------------------------------------------------------
// GET /public-eval/:token
// Rota pública (sem autenticação). Retorna informações do token para o
// freelancer preencher o formulário de avaliação.
// ---------------------------------------------------------------------------
router.get("/public-eval/:token", async (req, res) => {
  const tokenId = req.params.token as string;

  const [token] = await db.select({
    id: publicEvalTokensTable.id,
    eventId: publicEvalTokensTable.eventId,
    criterionId: publicEvalTokensTable.criterionId,
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

  const [criterion] = await db.select({ id: criteriaTable.id, name: criteriaTable.name, description: criteriaTable.description })
    .from(criteriaTable).where(eq(criteriaTable.id, token.criterionId)).limit(1);

  res.json({
    tokenId: token.id,
    isUsed: token.usedAt !== null,
    recipientName: token.recipientName,
    submitterName: token.submitterName,
    eventName: event?.name ?? null,
    eventStatus: event?.status ?? null,
    criterionName: criterion?.name ?? null,
    criterionDescription: criterion?.description ?? null,
  });
});

// ---------------------------------------------------------------------------
// POST /public-eval/:token/submit
// Rota pública (sem autenticação). O freelancer submete sua avaliação.
// Body: { submitterName: string; score: number; comments?: string }
// Cria uma avaliação no nome do criador do token (evaluatorUserId = createdByUserId).
// ---------------------------------------------------------------------------
router.post("/public-eval/:token/submit", async (req, res) => {
  const tokenId = req.params.token as string;
  const { submitterName, score, comments } = req.body ?? {};

  if (!submitterName || typeof submitterName !== "string" || !submitterName.trim()) {
    res.status(400).json({ error: "Nome é obrigatório" });
    return;
  }
  const parsedScore = typeof score === "number" ? score : parseFloat(score);
  if (isNaN(parsedScore) || parsedScore < 1 || parsedScore > 10) {
    res.status(400).json({ error: "Nota deve ser entre 1 e 10" });
    return;
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

  const [event] = await db.select({ status: eventsTable.status })
    .from(eventsTable).where(eq(eventsTable.id, token.eventId)).limit(1);

  if (!event || (event.status !== "open" && event.status !== "closed")) {
    res.status(400).json({ error: "Evento não está aberto para avaliações" });
    return;
  }

  await db.transaction(async (tx) => {
    await tx.insert(evaluationsTable).values({
      eventId: token.eventId,
      criterionId: token.criterionId,
      evaluatorUserId: token.createdByUserId!,
      score: parsedScore.toFixed(2),
      comments: comments?.trim() ?? null,
      audioUrl: null,
      commentVisibility: "internal",
      status: "submitted",
      submittedAt: new Date(),
    });

    await tx.update(publicEvalTokensTable).set({
      usedAt: new Date(),
      submitterName: submitterName.trim(),
    }).where(eq(publicEvalTokensTable.id, tokenId));

    await tx.update(eventCriterionAssignmentsTable).set({
      status: "submitted",
      updatedAt: new Date(),
    }).where(and(
      eq(eventCriterionAssignmentsTable.eventId, token.eventId),
      eq(eventCriterionAssignmentsTable.criterionId, token.criterionId),
    ));
  });

  res.json({ ok: true });
});

export default router;
