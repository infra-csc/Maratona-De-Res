import { Router } from "express";
import {
  db,
  publicEvalTokensTable,
  publicEvalTokenCriteriaTable,
  evaluationsTable,
  eventsTable,
  criteriaTable,
  eventCriterionAssignmentsTable,
  eventConformitiesTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

const router = Router();

// ---------------------------------------------------------------------------
// GET /public-eval/:token
// Rota pública (sem autenticação). Retorna informações do token.
// Para tokenType='criteria': retorna a lista de critérios do questionário.
// Para tokenType='conformity_cenografia'|'conformity_ferramentas': retorna
// as perguntas do formulário de conformidade correspondente.
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
    tokenType: publicEvalTokensTable.tokenType,
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

  const tokenType = token.tokenType ?? "criteria";

  if (tokenType === "conformity_cenografia") {
    res.json({
      tokenId: token.id,
      tokenType,
      isUsed: token.usedAt !== null,
      recipientName: token.recipientName,
      submitterName: token.submitterName,
      eventName: event?.name ?? null,
      eventStatus: event?.status ?? null,
      criteria: [],
    });
    return;
  }

  if (tokenType === "conformity_ferramentas") {
    res.json({
      tokenId: token.id,
      tokenType,
      isUsed: token.usedAt !== null,
      recipientName: token.recipientName,
      submitterName: token.submitterName,
      eventName: event?.name ?? null,
      eventStatus: event?.status ?? null,
      criteria: [],
    });
    return;
  }

  // Default: criteria token
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
    tokenType: "criteria",
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
// Rota pública (sem autenticação). Submete respostas de critérios.
// Body: { submitterName: string; evaluations: { criterionId: number; score: number; comments?: string }[] }
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
    if (isNaN(criterionId) || isNaN(score) || score < 0 || score > 10) {
      res.status(400).json({ error: "Cada critério precisa de uma nota entre 0 e 10" });
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
      const [existing] = await tx.select().from(evaluationsTable)
        .where(and(
          eq(evaluationsTable.eventId, token.eventId),
          eq(evaluationsTable.criterionId, item.criterionId),
          eq(evaluationsTable.evaluatorUserId, token.createdByUserId!),
        )).limit(1);
      if (existing) {
        if (existing.status === "submitted") continue;
        await tx.update(evaluationsTable).set({
          score: item.score.toFixed(2),
          comments: item.comments,
          status: "submitted",
          submittedAt: new Date(),
        }).where(eq(evaluationsTable.id, existing.id));
        continue;
      }
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

// ---------------------------------------------------------------------------
// POST /public-eval/:token/submit-conformity
// Rota pública (sem autenticação). Submete respostas de conformidade.
// Para conformity_cenografia: { submitterName, epi, estaiamentos, conduta,
//   epiComment?, estaiamentosComment?, condutaComment?, absencesReport?,
//   standoutResponse, standoutJustification? }
// Para conformity_ferramentas: { submitterName, guardaEquipamentos,
//   guardaEquipamentosComment? }
// ---------------------------------------------------------------------------
router.post("/public-eval/:token/submit-conformity", async (req, res) => {
  const tokenId = req.params.token as string;
  const { submitterName, ...answers } = req.body ?? {};

  if (!submitterName || typeof submitterName !== "string" || !submitterName.trim()) {
    res.status(400).json({ error: "Nome é obrigatório" });
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

  const tokenType = token.tokenType ?? "criteria";
  if (tokenType !== "conformity_cenografia" && tokenType !== "conformity_ferramentas") {
    res.status(400).json({ error: "Este link não é para conformidade" });
    return;
  }

  const [event] = await db.select({ status: eventsTable.status })
    .from(eventsTable).where(eq(eventsTable.id, token.eventId)).limit(1);

  if (!event || (event.status !== "open" && event.status !== "closed")) {
    res.status(400).json({ error: "Evento não está aberto para avaliações" });
    return;
  }

  const isCenografia = tokenType === "conformity_cenografia";
  const isFerramentas = tokenType === "conformity_ferramentas";

  // Validate required fields per type
  if (isCenografia) {
    if (answers.epi === undefined || answers.estaiamentos === undefined || answers.conduta === undefined) {
      res.status(400).json({ error: "EPI, Estaiamentos e Conduta são obrigatórios" });
      return;
    }
    // Resposta "Não" precisa vir com o comentário explicando o que aconteceu.
    const naoSemComentario = (
      [["epi", "epiComment"], ["estaiamentos", "estaiamentosComment"], ["conduta", "condutaComment"]] as const
    ).find(([key, commentKey]) => answers[key] === false && !(typeof answers[commentKey] === "string" && answers[commentKey].trim()));
    if (naoSemComentario) {
      res.status(400).json({ error: "Comentário é obrigatório quando a resposta é Não" });
      return;
    }
  }
  if (isFerramentas) {
    if (answers.guardaEquipamentos === undefined) {
      res.status(400).json({ error: "Guarda de Equipamentos é obrigatório" });
      return;
    }
    if (answers.guardaEquipamentos === false && !(typeof answers.guardaEquipamentosComment === "string" && answers.guardaEquipamentosComment.trim())) {
      res.status(400).json({ error: "Comentário é obrigatório quando a resposta é Não" });
      return;
    }
  }

  await db.transaction(async (tx) => {
    const existing = await tx.select({ id: eventConformitiesTable.id })
      .from(eventConformitiesTable)
      .where(eq(eventConformitiesTable.eventId, token.eventId));

    if (existing.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch: Record<string, any> = { updatedAt: new Date() };
      if (isCenografia) {
        if (answers.epi !== undefined) patch.epi = answers.epi;
        if (answers.estaiamentos !== undefined) patch.estaiamentos = answers.estaiamentos;
        if (answers.conduta !== undefined) patch.conduta = answers.conduta;
        if (answers.epiComment !== undefined) patch.epiComment = answers.epiComment || null;
        if (answers.estaiamentosComment !== undefined) patch.estaiamentosComment = answers.estaiamentosComment || null;
        if (answers.condutaComment !== undefined) patch.condutaComment = answers.condutaComment || null;
        if (answers.absencesResponse !== undefined) patch.absencesResponse = answers.absencesResponse;
        if (answers.absencesReport !== undefined) patch.absencesReport = answers.absencesReport || null;
        if (answers.standoutResponse !== undefined) patch.standoutResponse = answers.standoutResponse;
        if (answers.standoutJustification !== undefined) patch.standoutJustification = answers.standoutJustification || null;
      }
      if (isFerramentas) {
        if (answers.guardaEquipamentos !== undefined) patch.guardaEquipamentos = answers.guardaEquipamentos;
        if (answers.guardaEquipamentosComment !== undefined) patch.guardaEquipamentosComment = answers.guardaEquipamentosComment || null;
      }
      await tx.update(eventConformitiesTable)
        .set(patch)
        .where(eq(eventConformitiesTable.eventId, token.eventId));
    } else {
      const insertValues: typeof eventConformitiesTable.$inferInsert = {
        eventId: token.eventId,
        epi: isCenografia ? (answers.epi ?? null) : null,
        estaiamentos: isCenografia ? (answers.estaiamentos ?? null) : null,
        conduta: isCenografia ? (answers.conduta ?? null) : null,
        guardaEquipamentos: isFerramentas ? (answers.guardaEquipamentos ?? null) : null,
        epiComment: isCenografia ? (answers.epiComment || null) : null,
        estaiamentosComment: isCenografia ? (answers.estaiamentosComment || null) : null,
        condutaComment: isCenografia ? (answers.condutaComment || null) : null,
        guardaEquipamentosComment: isFerramentas ? (answers.guardaEquipamentosComment || null) : null,
        absencesResponse: isCenografia ? (answers.absencesResponse ?? null) : null,
        absencesReport: isCenografia ? (answers.absencesReport || null) : null,
        standoutResponse: isCenografia ? (answers.standoutResponse ?? null) : null,
        standoutJustification: isCenografia ? (answers.standoutJustification || null) : null,
        createdByUserId: token.createdByUserId!,
      };
      await tx.insert(eventConformitiesTable).values(insertValues);
    }

    await tx.update(publicEvalTokensTable).set({
      usedAt: new Date(),
      submitterName: submitterName.trim(),
    }).where(eq(publicEvalTokensTable.id, tokenId));
  });

  res.json({ ok: true });
});

export default router;
