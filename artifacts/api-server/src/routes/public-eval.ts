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
  eventCriteriaTable,
} from "@workspace/db";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import {
  tokenCriterionClosures, lockCriterionInEvent, areaModeForeignCriteria, AREA_MODE_LINK_REASON, closedMessage, type Closure,
  cenografiaConformityAnswered, ferramentasConformityAnswered, conformityClosedMessage, tokenSubjectToDayLock, dayAfterLockMessage,
  type ConformityAnswered, lockEventCycleShared,
} from "../lib/area-evaluation.js";
import { anyEventLockedByClosedCycle, closedCycleBody } from "../lib/closed-cycle-guard.js";
import { isEventInNextCycle, nextCycleBody } from "../lib/next-cycle.js";
import type { DbOrTx } from "../lib/db-tx.js";
import { recomputeCycleResults } from "./results.js";
import { eventsWithoutConduta } from "../lib/cycle-data.js";

const router = Router();

class TokenAlreadyUsedError extends Error {
  constructor() { super("Este link já foi utilizado"); }
}

interface Rejected { criterionId: number; criterionName: string; reason: string; kind: "criterion" | "conformity" }

/** Tudo o que veio no envio já estava respondido (critérios e/ou matriz): nada gravado. */
function nothingSavedMessage(rejected: Rejected[]): string {
  return rejected.some(r => r.kind === "conformity")
    ? "Tudo o que este link pedia já tinha sido respondido. Nada foi gravado."
    : "Todos os critérios deste link já foram respondidos. Nada foi gravado.";
}
class NothingSavedError extends Error {
  constructor(readonly rejected: Rejected[]) { super(nothingSavedMessage(rejected)); }
}

/** Nome exibido para a parte da matriz em `rejected`. */
const CONFORMITY_PART = "Matriz de Conformidade (Cenografia)";
const FERRAMENTAS_PART = "Matriz de Conformidade (Ferramentas)";

/**
 * B3 (4ª revisão): o link só grava em critério ATIVO no evento
 * (event_criteria.active). Critério desativado depois que o link foi gerado
 * sai da lista do GET (não é pedido) e, se vier no envio, é IGNORADO com
 * aviso em `rejected` (o resto do envio segue). Escolhido em vez de 409 para
 * o freela não perder as outras respostas por um critério que o RH tirou.
 */
const INACTIVE_CRITERION_REASON = "Este critério foi desativado neste evento depois que o link foi gerado: a resposta não foi gravada.";

/** Dos critérios informados, os que estão ATIVOS no evento. */
async function activeCriterionIds(exec: DbOrTx, eventId: number, criterionIds: number[]): Promise<Set<number>> {
  if (criterionIds.length === 0) return new Set();
  const rows = await exec.select({ criterionId: eventCriteriaTable.criterionId }).from(eventCriteriaTable)
    .where(and(eq(eventCriteriaTable.eventId, eventId), inArray(eventCriteriaTable.criterionId, criterionIds), eq(eventCriteriaTable.active, true)));
  return new Set(rows.map(r => r.criterionId));
}

/** Ciclo do evento fechado: o link não grava nada e continua sem uso (A1). */
const CLOSED_CYCLE_LINK_ERROR = "Ciclo fechado: este evento não recebe mais respostas. Nada foi gravado e o link não foi usado.";

/** A parte da matriz que este link de conformidade responde já tem resposta? */
async function conformityLinkAnswered(eventId: number, tokenType: string, exec?: DbOrTx): Promise<ConformityAnswered> {
  if (tokenType === "conformity_cenografia") return cenografiaConformityAnswered(eventId, exec);
  if (tokenType === "conformity_ferramentas") return ferramentasConformityAnswered(eventId, exec);
  return { answered: false, byName: null };
}
class ConformityAlreadyAnsweredError extends Error {
  constructor(readonly rejected: Rejected[]) { super(rejected[0]?.reason ?? "A Matriz de Conformidade deste evento já foi respondida."); }
}
const CONFORMITY_FIELDS = ["epi", "estaiamentos", "conduta", "absencesReport", "standoutResponse"] as const;

// Submissão por link público também muda a nota; se o evento já conta para o
// ciclo, recalcula o snapshot oficial (autor = quem gerou o link).
async function recomputeIfEventCounts(eventId: number, userId: number | null): Promise<void> {
  const [ev] = await db.select({ cycleId: eventsTable.cycleId, resultsConfirmed: eventsTable.resultsConfirmed, status: eventsTable.status })
    .from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (ev && (ev.resultsConfirmed || ev.status === "closed")) await recomputeCycleResults(ev.cycleId, userId ?? 0);
}

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
  // Ciclo novo: "Conduta" fora da Matriz de Conformidade — a tela esconde a pergunta.
  const conformityWithoutConduta = (await eventsWithoutConduta([token.eventId])).has(token.eventId);
  // Ciclo do evento fechado (só consulta): o link não aceita envio (A1).
  const cycleClosed = await anyEventLockedByClosedCycle([token.eventId]);
  // Evento do PRÓXIMO ciclo (fora do período): o link não aceita envio até o
  // evento ser movido para o ciclo novo (o POST responde 409 EVENT_NEXT_CYCLE).
  const nextCycle = await isEventInNextCycle(token.eventId);

  if (tokenType === "conformity_cenografia" || tokenType === "conformity_ferramentas") {
    // Link só da matriz: se a parte dele já tem resposta (pelo responsável ou
    // outro link), a tela avisa e não pede de novo (M6).
    const answered = token.usedAt === null
      ? await conformityLinkAnswered(token.eventId, tokenType)
      : { answered: false, byName: null };
    res.json({
      tokenId: token.id,
      tokenType,
      isUsed: token.usedAt !== null,
      usedAt: token.usedAt?.toISOString() ?? null,
      recipientName: token.recipientName,
      submitterName: token.submitterName,
      eventName: event?.name ?? null,
      eventStatus: event?.status ?? null,
      conformityWithoutConduta,
      cycleClosed,
      nextCycle,
      criteria: [],
      conformityAnswered: answered.answered,
      conformityAnsweredByName: answered.byName,
    });
    return;
  }

  // criteria ou criteria_with_conformity — retorna lista de critérios
  const allTokenCriteria = await db.select({
    criterionId: publicEvalTokenCriteriaTable.criterionId,
    criterionName: criteriaTable.name,
    criterionDescription: criteriaTable.description,
  })
    .from(publicEvalTokenCriteriaTable)
    .innerJoin(criteriaTable, eq(publicEvalTokenCriteriaTable.criterionId, criteriaTable.id))
    .where(eq(publicEvalTokenCriteriaTable.tokenId, tokenId));
  // B3: critério desativado no evento não é pedido (link ainda sem uso).
  const activeNow = await activeCriterionIds(db, token.eventId, allTokenCriteria.map(c => c.criterionId));
  const tokenCriteria = token.usedAt === null ? allTokenCriteria.filter(c => activeNow.has(c.criterionId)) : allTokenCriteria;

  // Critérios que a área já respondeu (por outra pessoa ou outro link) ficam
  // fechados: a tela mostra "já respondido pela área" e não os cobra.
  const closures = token.usedAt === null && token.createdByUserId != null
    ? await tokenCriterionClosures(db, token.eventId, token.createdByUserId, tokenCriteria.map(c => c.criterionId))
    : new Map<number, Closure>();
  const criteria = tokenCriteria.map(c => {
    const closure = closures.get(c.criterionId);
    return {
      ...c,
      closed: !!closure,
      closedByName: closure?.name ?? null,
      closedAt: closure?.submittedAt?.toISOString() ?? null,
    };
  });

  // Link combinado: a matriz já respondida (pelo responsável ou outro link)
  // não é pedida de novo — a tela mostra só o que falta.
  const conformity = tokenType === "criteria_with_conformity" && token.usedAt === null
    ? await cenografiaConformityAnswered(token.eventId)
    : { answered: false, byName: null };

  res.json({
    tokenId: token.id,
    tokenType,
    isUsed: token.usedAt !== null,
    usedAt: token.usedAt?.toISOString() ?? null,
    recipientName: token.recipientName,
    submitterName: token.submitterName,
    eventName: event?.name ?? null,
    eventStatus: event?.status ?? null,
    conformityWithoutConduta,
    cycleClosed,
    nextCycle,
    criteria,
    allClosed: criteria.length > 0 && criteria.every(c => c.closed),
    conformityAnswered: conformity.answered,
    conformityAnsweredByName: conformity.byName,
  });
});

// ---------------------------------------------------------------------------
// POST /public-eval/:token/submit
// Rota pública (sem autenticação). Submete respostas de critérios.
// Body: { submitterName: string; evaluations: { criterionId: number; score: number; comments?: string }[] }
// ---------------------------------------------------------------------------
router.post("/public-eval/:token/submit", async (req, res) => {
  const tokenId = req.params.token as string;
  const { submitterName, evaluations, ...conformityData } = req.body ?? {};

  if (!submitterName || typeof submitterName !== "string" || !submitterName.trim()) {
    res.status(400).json({ error: "Nome é obrigatório" });
    return;
  }
  if (!Array.isArray(evaluations)) {
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
  const submitTokenType = token.tokenType ?? "criteria";
  if (submitTokenType !== "criteria" && submitTokenType !== "criteria_with_conformity") {
    res.status(400).json({ error: "Este link não é para critérios" });
    return;
  }
  const isCombined = submitTokenType === "criteria_with_conformity";

  // Ciclo fechado só consulta — também pelo link (A1). Nada é gravado e o
  // link continua sem uso.
  if (await anyEventLockedByClosedCycle([token.eventId])) {
    res.status(409).json(closedCycleBody(CLOSED_CYCLE_LINK_ERROR));
    return;
  }
  // Evento do próximo ciclo: nada é gravado e o link continua sem uso (D1).
  if (await isEventInNextCycle(token.eventId)) {
    res.status(409).json(nextCycleBody());
    return;
  }

  // Link gerado por avaliador só vale a partir do dia seguinte ao evento
  // (admin/RH, ou link gerado por eles, podem sempre).
  if (await tokenSubjectToDayLock(token)) {
    const lock = await dayAfterLockMessage(token.eventId);
    if (lock) { res.status(400).json({ error: lock }); return; }
  }

  const tokenCriteria = await db.select({ criterionId: publicEvalTokenCriteriaTable.criterionId, criterionName: criteriaTable.name })
    .from(publicEvalTokenCriteriaTable)
    .innerJoin(criteriaTable, eq(publicEvalTokenCriteriaTable.criterionId, criteriaTable.id))
    .where(eq(publicEvalTokenCriteriaTable.tokenId, tokenId));
  const tokenCriterionIds = new Set(tokenCriteria.map(c => c.criterionId));
  const criterionNameOf = new Map(tokenCriteria.map(c => [c.criterionId, c.criterionName]));

  if (parsedEvaluations.some(e => !tokenCriterionIds.has(e.criterionId))) {
    res.status(400).json({ error: "Avaliação inclui um critério fora do questionário deste link" });
    return;
  }
  if (new Set(parsedEvaluations.map(e => e.criterionId)).size !== parsedEvaluations.length) {
    res.status(400).json({ error: "Critério repetido no envio" });
    return;
  }
  // B3: critério desativado no evento não é cobrado e, se vier, é ignorado
  // com aviso em `rejected` (nunca gravado).
  const activeIds = await activeCriterionIds(db, token.eventId, [...tokenCriterionIds]);
  const inactiveRejected: Rejected[] = parsedEvaluations.filter(e => !activeIds.has(e.criterionId))
    .map(e => ({ criterionId: e.criterionId, criterionName: criterionNameOf.get(e.criterionId) ?? "", reason: INACTIVE_CRITERION_REASON, kind: "criterion" as const }));
  for (let i = parsedEvaluations.length - 1; i >= 0; i--) if (!activeIds.has(parsedEvaluations[i].criterionId)) parsedEvaluations.splice(i, 1);
  // Critérios já respondidos não são cobrados (e, se vierem, são recusados um
  // a um com o motivo — nunca descartados em silêncio). Os ainda abertos
  // precisam estar todos respondidos.
  const closedNow = await tokenCriterionClosures(db, token.eventId, token.createdByUserId, [...activeIds]);
  const answeredIds = new Set(parsedEvaluations.map(e => e.criterionId));
  if ([...activeIds].some(id => !closedNow.has(id) && !answeredIds.has(id))) {
    res.status(400).json({ error: "É necessário avaliar todos os critérios do questionário" });
    return;
  }

  // Link combinado: a matriz só é gravada se ninguém a respondeu ainda. Se já
  // tem resposta, a parte da matriz é recusada com o motivo (a resposta que
  // está lá fica) — o link nunca sobrescreve a Matriz de Conformidade.
  const sentConformity = isCombined && CONFORMITY_FIELDS.some(k => conformityData[k] !== undefined && conformityData[k] !== null && conformityData[k] !== "");
  const conformityBefore = isCombined ? await cenografiaConformityAnswered(token.eventId) : { answered: true, byName: null };
  const wantsConformity = isCombined && !conformityBefore.answered;
  const conformityRejection = (c: { answered: boolean; byName: string | null }): Rejected =>
    ({ criterionId: 0, criterionName: CONFORMITY_PART, reason: conformityClosedMessage(c), kind: "conformity" });

  const criteriaRejected = (): Rejected[] => [...inactiveRejected, ...[...closedNow.entries()]
    .map(([criterionId, c]) => ({ criterionId, criterionName: criterionNameOf.get(criterionId) ?? "", reason: closedMessage(c), kind: "criterion" as const }))];
  if (activeIds.size === 0 && !wantsConformity) {
    // Todos os critérios do link foram desativados no evento: nada a gravar.
    const rejected = criteriaRejected();
    if (isCombined && sentConformity) rejected.push(conformityRejection(conformityBefore));
    res.status(409).json({ error: "Os critérios deste link foram desativados neste evento. Nada foi gravado e o link não foi usado.", code: "CRITERIA_INACTIVE", rejected });
    return;
  }
  if (closedNow.size === activeIds.size && !wantsConformity) {
    const rejected = criteriaRejected();
    if (isCombined && sentConformity) rejected.push(conformityRejection(conformityBefore));
    res.status(409).json({ error: nothingSavedMessage(rejected), code: "AREA_ALREADY_ANSWERED", rejected });
    return;
  }
  if (parsedEvaluations.length === 0 && !wantsConformity) {
    res.status(400).json({ error: "Nenhuma avaliação enviada" });
    return;
  }

  if (wantsConformity) {
    // Ciclo sem "Conduta" na matriz: não é cobrada e é gravada vazia (null).
    const noConduta = (await eventsWithoutConduta([token.eventId])).has(token.eventId);
    if (noConduta) { conformityData.conduta = null; conformityData.condutaComment = null; }
    if (conformityData.epi === undefined || conformityData.estaiamentos === undefined || (!noConduta && conformityData.conduta === undefined)) {
      res.status(400).json({ error: noConduta ? "EPI e Estaiamentos são obrigatórios" : "EPI, Estaiamentos e Conduta são obrigatórios" });
      return;
    }
    const naoSemComentario = (
      [["epi", "epiComment"], ["estaiamentos", "estaiamentosComment"], ["conduta", "condutaComment"]] as [string, string][]
    ).find(([key, commentKey]) => conformityData[key] === false && !(typeof conformityData[commentKey] === "string" && (conformityData[commentKey] as string).trim()));
    if (naoSemComentario) {
      res.status(400).json({ error: "Comentário é obrigatório quando a resposta é Não" });
      return;
    }
    if (!conformityData.absencesReport || typeof conformityData.absencesReport !== "string" || !(conformityData.absencesReport as string).trim()) {
      res.status(400).json({ error: "Informe faltas/atrasos antes de enviar" });
      return;
    }
    if (conformityData.standoutResponse === undefined || conformityData.standoutResponse === null) {
      res.status(400).json({ error: "Responda a pergunta de destaque" });
      return;
    }
    if (conformityData.standoutResponse === true && !(typeof conformityData.standoutJustification === "string" && (conformityData.standoutJustification as string).trim())) {
      res.status(400).json({ error: "Descreva o destaque antes de enviar" });
      return;
    }
  }

  const [event] = await db.select({ status: eventsTable.status })
    .from(eventsTable).where(eq(eventsTable.id, token.eventId)).limit(1);

  if (!event || (event.status !== "open" && event.status !== "closed")) {
    res.status(400).json({ error: "Evento não está aberto para avaliações" });
    return;
  }

  const saved: number[] = [];
  const rejected: Rejected[] = [...inactiveRejected];
  let conformitySaved = false;

  await db.transaction(async (tx) => {
    // B2: a troca da avaliação por área no ciclo espera este envio (e vice-versa).
    await lockEventCycleShared(tx, token.eventId);
    // Mesma trava do envio pela tela: dois envios do mesmo critério (link e
    // tela, ou dois links) ficam em fila e só o primeiro grava.
    await lockCriterionInEvent(tx, token.eventId, parsedEvaluations.map(e => e.criterionId));
    const closed = await tokenCriterionClosures(tx, token.eventId, token.createdByUserId!, parsedEvaluations.map(e => e.criterionId));
    // B3: confere de novo, com as linhas travadas, que o critério segue ativo.
    const stillActive = await activeCriterionIds(tx, token.eventId, parsedEvaluations.map(e => e.criterionId));
    // Ciclo por área: o link responde em nome de quem o gerou — critério de
    // outra área não grava (vale também para link criado antes da marca).
    const foreign = await areaModeForeignCriteria(tx, token.eventId, token.createdByUserId!, parsedEvaluations.map(e => e.criterionId));
    // Um instante só para o envio e para o "usado em" do link: é o que liga a
    // nota a quem preencheu (nome do freela em "Respondido por").
    const now = new Date();
    for (const item of parsedEvaluations) {
      if (!stillActive.has(item.criterionId)) {
        rejected.push({ criterionId: item.criterionId, criterionName: criterionNameOf.get(item.criterionId) ?? "", reason: INACTIVE_CRITERION_REASON, kind: "criterion" });
        continue;
      }
      if (foreign.has(item.criterionId)) {
        rejected.push({ criterionId: item.criterionId, criterionName: criterionNameOf.get(item.criterionId) ?? "", reason: AREA_MODE_LINK_REASON, kind: "criterion" });
        continue;
      }
      const closure = closed.get(item.criterionId);
      if (closure) {
        rejected.push({ criterionId: item.criterionId, criterionName: criterionNameOf.get(item.criterionId) ?? "", reason: closedMessage(closure), kind: "criterion" });
        continue;
      }
      const [existing] = await tx.select().from(evaluationsTable)
        .where(and(
          eq(evaluationsTable.eventId, token.eventId),
          eq(evaluationsTable.criterionId, item.criterionId),
          eq(evaluationsTable.evaluatorUserId, token.createdByUserId!),
        )).limit(1);
      if (existing) {
        // Rascunho de quem gerou o link vira a resposta do freela.
        await tx.update(evaluationsTable).set({
          score: item.score.toFixed(2),
          comments: item.comments,
          status: "submitted",
          submittedAt: now,
          publicTokenId: tokenId,
        }).where(and(eq(evaluationsTable.id, existing.id), eq(evaluationsTable.status, "draft")));
      } else {
        await tx.insert(evaluationsTable).values({
          eventId: token.eventId,
          criterionId: item.criterionId,
          evaluatorUserId: token.createdByUserId!,
          score: item.score.toFixed(2),
          comments: item.comments,
          audioUrl: null,
          commentVisibility: "internal",
          status: "submitted",
          submittedAt: now,
          // Vínculo explícito com o link (B5): "Respondido por" = quem preencheu.
          publicTokenId: tokenId,
        });
      }
      saved.push(item.criterionId);
    }

    // Link combinado: confere de novo a matriz já com o evento travado (dois
    // links, ou o link e a tela do responsável, ao mesmo tempo).
    if (isCombined) {
      await tx.select({ id: eventsTable.id }).from(eventsTable).where(eq(eventsTable.id, token.eventId)).for("update");
      const conformityNow = await cenografiaConformityAnswered(token.eventId, tx);
      if (wantsConformity && !conformityNow.answered) {
        const values = {
          epi: conformityData.epi as boolean,
          estaiamentos: conformityData.estaiamentos as boolean,
          conduta: conformityData.conduta as boolean,
          epiComment: (conformityData.epiComment as string) || null,
          estaiamentosComment: (conformityData.estaiamentosComment as string) || null,
          condutaComment: (conformityData.condutaComment as string) || null,
          absencesResponse: true,
          absencesReport: (conformityData.absencesReport as string) || null,
          standoutResponse: conformityData.standoutResponse as boolean,
          standoutJustification: (conformityData.standoutJustification as string) || null,
          cenografiaSubmittedByName: submitterName.trim(),
        };
        const existingConf = await tx.select({ id: eventConformitiesTable.id })
          .from(eventConformitiesTable)
          .where(eq(eventConformitiesTable.eventId, token.eventId));
        if (existingConf.length > 0) {
          await tx.update(eventConformitiesTable).set({ ...values, updatedAt: new Date() })
            .where(eq(eventConformitiesTable.eventId, token.eventId));
        } else {
          await tx.insert(eventConformitiesTable).values({
            eventId: token.eventId,
            ...values,
            guardaEquipamentos: null,
            guardaEquipamentosComment: null,
            createdByUserId: token.createdByUserId!,
          });
        }
        conformitySaved = true;
      } else if (sentConformity || wantsConformity) {
        rejected.push(conformityRejection(conformityNow.answered ? conformityNow : conformityBefore));
      }
    }

    // Nada gravado (tudo foi respondido entre abrir e enviar): o link
    // continua sem uso e a pessoa vê o motivo de cada parte.
    if (saved.length === 0 && !conformitySaved) throw new NothingSavedError(rejected);

    // Marca o link como usado de forma atômica: dois envios simultâneos
    // passavam a checagem inicial e o segundo sobrescrevia o primeiro.
    const claimed = await tx.update(publicEvalTokensTable).set({
      usedAt: now,
      submitterName: submitterName.trim(),
    }).where(and(eq(publicEvalTokensTable.id, tokenId), isNull(publicEvalTokensTable.usedAt)))
      .returning({ id: publicEvalTokensTable.id });
    if (claimed.length === 0) throw new TokenAlreadyUsedError();

    if (saved.length > 0) {
      await tx.update(eventCriterionAssignmentsTable).set({
        status: "submitted",
        updatedAt: now,
      }).where(and(
        eq(eventCriterionAssignmentsTable.eventId, token.eventId),
        inArray(eventCriterionAssignmentsTable.criterionId, saved),
      ));
    }
  });

  // As notas enviadas pelo link entram na nota oficial se o evento já conta.
  await recomputeIfEventCounts(token.eventId, token.createdByUserId ?? null);
  // `rejected`: o que já estava respondido (não gravado, com o motivo) —
  // critérios e, no link combinado, a parte da matriz.
  res.json({ ok: true, saved, rejected, conformitySaved });
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
  // Ciclo fechado só consulta — também pelo link (A1).
  if (await anyEventLockedByClosedCycle([token.eventId])) {
    res.status(409).json(closedCycleBody(CLOSED_CYCLE_LINK_ERROR));
    return;
  }
  // Evento do próximo ciclo: nada é gravado e o link continua sem uso (D1).
  if (await isEventInNextCycle(token.eventId)) {
    res.status(409).json(nextCycleBody());
    return;
  }
  // Link gerado por avaliador só vale a partir do dia seguinte ao evento.
  if (await tokenSubjectToDayLock(token)) {
    const lock = await dayAfterLockMessage(token.eventId);
    if (lock) { res.status(400).json({ error: lock }); return; }
  }

  const [event] = await db.select({ status: eventsTable.status })
    .from(eventsTable).where(eq(eventsTable.id, token.eventId)).limit(1);

  if (!event || (event.status !== "open" && event.status !== "closed")) {
    res.status(400).json({ error: "Evento não está aberto para avaliações" });
    return;
  }

  const isCenografia = tokenType === "conformity_cenografia";
  const isFerramentas = tokenType === "conformity_ferramentas";
  const partName = isCenografia ? CONFORMITY_PART : FERRAMENTAS_PART;
  const conformityRejection = (c: ConformityAnswered): Rejected[] =>
    [{ criterionId: 0, criterionName: partName, reason: conformityClosedMessage(c), kind: "conformity" }];

  // Mesma proteção do link combinado (M6): a matriz já respondida (pelo
  // responsável ou por outro link) nunca é sobrescrita. 409 com o motivo e o
  // link continua sem uso.
  const answeredBefore = await conformityLinkAnswered(token.eventId, tokenType);
  if (answeredBefore.answered) {
    const rejected = conformityRejection(answeredBefore);
    res.status(409).json({ error: rejected[0].reason, code: "CONFORMITY_ALREADY_ANSWERED", rejected });
    return;
  }

  // Validate required fields per type
  if (isCenografia) {
    // Ciclo sem "Conduta" na matriz: não é cobrada e é gravada vazia (null).
    const noConduta = (await eventsWithoutConduta([token.eventId])).has(token.eventId);
    if (noConduta) { answers.conduta = null; answers.condutaComment = null; }
    if (answers.epi === undefined || answers.estaiamentos === undefined || (!noConduta && answers.conduta === undefined)) {
      res.status(400).json({ error: noConduta ? "EPI e Estaiamentos são obrigatórios" : "EPI, Estaiamentos e Conduta são obrigatórios" });
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
    // Trava a linha do evento (mesma trava do link combinado e da tela) e
    // confere de novo: dois envios ao mesmo tempo → só o primeiro grava.
    await tx.select({ id: eventsTable.id }).from(eventsTable).where(eq(eventsTable.id, token.eventId)).for("update");
    const answeredNow = await conformityLinkAnswered(token.eventId, tokenType, tx);
    if (answeredNow.answered) throw new ConformityAlreadyAnsweredError(conformityRejection(answeredNow));
    const existing = await tx.select({ id: eventConformitiesTable.id })
      .from(eventConformitiesTable)
      .where(eq(eventConformitiesTable.eventId, token.eventId));

    const trimmedSubmitterName = submitterName.trim();
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
        patch.cenografiaSubmittedByName = trimmedSubmitterName;
      }
      if (isFerramentas) {
        if (answers.guardaEquipamentos !== undefined) patch.guardaEquipamentos = answers.guardaEquipamentos;
        if (answers.guardaEquipamentosComment !== undefined) patch.guardaEquipamentosComment = answers.guardaEquipamentosComment || null;
        patch.ferramentasSubmittedByName = trimmedSubmitterName;
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
        cenografiaSubmittedByName: isCenografia ? trimmedSubmitterName : null,
        ferramentasSubmittedByName: isFerramentas ? trimmedSubmitterName : null,
      };
      await tx.insert(eventConformitiesTable).values(insertValues);
    }

    // Marca o link como usado de forma atômica: dois envios simultâneos
    // passavam a checagem inicial e o segundo sobrescrevia o primeiro.
    const claimed = await tx.update(publicEvalTokensTable).set({
      usedAt: new Date(),
      submitterName: submitterName.trim(),
    }).where(and(eq(publicEvalTokensTable.id, tokenId), isNull(publicEvalTokensTable.usedAt)))
      .returning({ id: publicEvalTokensTable.id });
    if (claimed.length === 0) throw new TokenAlreadyUsedError();
  });

  await recomputeIfEventCounts(token.eventId, token.createdByUserId ?? null);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// DELETE /public-eval-tokens/:tokenId   (autenticado)
// Remove um token PENDENTE (usedAt IS NULL). Tokens já respondidos não podem
// ser excluídos — retorna 409. O avaliador só pode excluir seus próprios tokens;
// admin/rh podem excluir qualquer um.
// ---------------------------------------------------------------------------
router.delete("/public-eval-tokens/:tokenId", requireAuth, async (req, res) => {
  const tokenId = req.params.tokenId as string;
  const user = req.user!;

  const [token] = await db
    .select({
      id: publicEvalTokensTable.id,
      createdByUserId: publicEvalTokensTable.createdByUserId,
      usedAt: publicEvalTokensTable.usedAt,
    })
    .from(publicEvalTokensTable)
    .where(eq(publicEvalTokensTable.id, tokenId))
    .limit(1);

  if (!token) {
    res.status(404).json({ error: "Token não encontrado" });
    return;
  }
  if (token.usedAt) {
    res.status(409).json({ error: "Este link já foi respondido e não pode ser excluído" });
    return;
  }
  const isOwner = token.createdByUserId === user.userId;
  const isAdminOrRh = user.role === "admin" || user.role === "rh";
  if (!isOwner && !isAdminOrRh) {
    res.status(403).json({ error: "Sem permissão para excluir este link" });
    return;
  }

  await db.delete(publicEvalTokensTable).where(eq(publicEvalTokensTable.id, tokenId));
  res.json({ ok: true });
});

// Erros lançados dentro das transações de submissão (link já usado).
router.use((err: unknown, _req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
  if (err instanceof TokenAlreadyUsedError) { res.status(409).json({ error: err.message }); return; }
  if (err instanceof NothingSavedError) { res.status(409).json({ error: err.message, code: "AREA_ALREADY_ANSWERED", rejected: err.rejected }); return; }
  if (err instanceof ConformityAlreadyAnsweredError) { res.status(409).json({ error: err.message, code: "CONFORMITY_ALREADY_ANSWERED", rejected: err.rejected }); return; }
  next(err);
});

export default router;
