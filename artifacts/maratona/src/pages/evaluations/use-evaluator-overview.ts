import { useQueries } from "@tanstack/react-query";
import { getGetEvaluationsQueryKey, getGetEventQueryKey, getEventCriteria, getEvent, getEvaluations, type Event } from "@workspace/api-client-react";
import { getEventCriterionAssignments, eventCriterionAssignmentsKey } from "@/lib/routing-api";
import type { EvaluatorEventStat, PrincipalAreaRow } from "./types";

interface Params {
  isEvaluator: boolean;
  events: Event[] | undefined;
  userId: number | undefined;
  myPrincipalAreas: PrincipalAreaRow[] | undefined;
}

// Visão geral do avaliador na sidebar: quais eventos liberados têm trabalho
// para ele e como se dividem em "A Fazer" / "Publicado" / "Concluídas".
export function useEvaluatorOverview({ isEvaluator, events, userId, myPrincipalAreas }: Params) {
  const activeEvents = (events ?? []).filter(e => e.status === "open" || e.status === "closed");
  // Only events whose criteria the RH has already confirmed can be evaluated.
  const configuredEvents = activeEvents.filter(e => e.criteriaConfirmed);

  // For evaluators: fetch criteria for every selectable event so the overview
  // only lists events that actually have work for their area (and so the empty
  // state is accurate). Same query key as the per-event fetch → deduped/cached.
  const evaluatorCriteriaQueries = useQueries({
    queries: isEvaluator
      ? configuredEvents.map(ev => ({
          queryKey: ["event-criteria", ev.id] as unknown[],
          queryFn: () => getEventCriteria(ev.id),
        }))
      : [],
  });
  const evaluatorEventDetailQueries = useQueries({
    queries: isEvaluator
      ? configuredEvents.map(ev => ({
          queryKey: getGetEventQueryKey(ev.id),
          queryFn: () => getEvent(ev.id),
        }))
      : [],
  });
  // Atribuição por critério (redirecionamento) manda sobre a atribuição por
  // área — sem isso, um critério redirecionado para outra pessoa da área
  // continuava marcando o evento como "a fazer" pra quem redirecionou.
  const evaluatorCriterionAssignmentQueries = useQueries({
    queries: isEvaluator
      ? configuredEvents.map(ev => ({
          queryKey: eventCriterionAssignmentsKey(ev.id),
          queryFn: () => getEventCriterionAssignments(ev.id),
        }))
      : [],
  });
  function myCriteriaForEvent(i: number) {
    const myAreaIds = new Set(
      (evaluatorEventDetailQueries[i]?.data?.areaAssignments ?? [])
        .filter(a => a.evaluatorUserId === userId)
        .map(a => a.areaId),
    );
    const assignmentByCriterionId = new Map(
      (evaluatorCriterionAssignmentQueries[i]?.data ?? []).map(a => [a.criterionId, a]),
    );
    return (evaluatorCriteriaQueries[i]?.data ?? []).filter(c => {
      if (!c.active) return false;
      const assignment = assignmentByCriterionId.get(c.criterionId);
      // Linha pending sem assignedToId não corta o fallback por área (mesma
      // regra do backend em isAssignedForCriterion).
      if (assignment?.assignedToId != null) return assignment.assignedToId === userId;
      return c.responsibleAreaId != null && myAreaIds.has(c.responsibleAreaId);
    });
  }
  const principalAreaIds = new Set((myPrincipalAreas ?? []).map(a => a.id));
  // Quesitos da(s) área(s) em que o usuário é avaliador PRINCIPAL mas que
  // estão com outra pessoa (delegados/redirecionados). O principal acompanha
  // esses quesitos: o evento só vai para "Concluídas" quando a área inteira
  // respondeu, e ele vê quem respondeu e quando.
  function delegatedAreaCriteriaForEvent(i: number) {
    if (principalAreaIds.size === 0) return [];
    const mineIds = new Set(myCriteriaForEvent(i).map(c => c.criterionId));
    return (evaluatorCriteriaQueries[i]?.data ?? []).filter(c =>
      c.active && c.responsibleAreaId != null && principalAreaIds.has(c.responsibleAreaId) && !mineIds.has(c.criterionId),
    );
  }
  const relevantEvaluatorEvents = isEvaluator
    ? configuredEvents.filter((_, i) => {
        const hasCriteria = myCriteriaForEvent(i).length > 0;
        const isConformityEval = evaluatorEventDetailQueries[i]?.data?.conformityEvaluatorUserId === userId;
        const isFerramentasEval = evaluatorEventDetailQueries[i]?.data?.conformityEvaluatorFerramentasUserId === userId;
        return hasCriteria || isConformityEval || isFerramentasEval || delegatedAreaCriteriaForEvent(i).length > 0;
      })
    : [];

  // Fetch this avaliador's evaluations for every configured event so the
  // overview can split events into "A Fazer" vs "Concluídas". Same query key as
  // the per-event/card fetch → deduped/cached, no extra network.
  const evaluatorEvalQueries = useQueries({
    queries: isEvaluator
      ? configuredEvents.map(ev => ({
          queryKey: getGetEvaluationsQueryKey({ eventId: ev.id }),
          queryFn: () => getEvaluations({ eventId: ev.id }),
        }))
      : [],
  });
  // Per-event completion stats for the avaliador (only events that actually
  // have criteria assigned to their area count as theirs).
  const evaluatorEventStats: EvaluatorEventStat[] = isEvaluator
    ? configuredEvents.map((ev, i) => {
        const myCrit = myCriteriaForEvent(i);
        const evs = evaluatorEvalQueries[i]?.data ?? [];
        const submitted = myCrit.filter(
          c => evs.find(e => e.criterionId === c.criterionId && e.evaluatorUserId === userId)?.status === "submitted",
        ).length;
        const total = myCrit.length;
        // Só conta como concluído para o avaliador depois que os resultados do
        // evento forem confirmados por RH/Admin — enviar tudo não basta.
        const detail = evaluatorEventDetailQueries[i]?.data;
        const isConformityEval = detail?.conformityEvaluatorUserId === userId;
        const isFerramentasEval2 = detail?.conformityEvaluatorFerramentasUserId === userId;
        // Quesitos da área principal com outra pessoa: contam para o "concluído"
        // do principal — respondidos por QUALQUER avaliador designado.
        const delegated = delegatedAreaCriteriaForEvent(i);
        const delegatedPending = delegated.filter(
          c => !evs.some(e => e.criterionId === c.criterionId && e.status === "submitted"),
        ).length;
        // Matriz de Conformidade conta como trabalho deste avaliador — mesma
        // contagem do card e do "Resumo da Avaliação" (Cenografia 5, Ferramentas 1).
        const conf = detail?.conformity;
        const confTotal = (isConformityEval ? 5 : 0) + (isFerramentasEval2 ? 1 : 0);
        const confDone =
          (isConformityEval
            ? [conf?.epi, conf?.estaiamentos, conf?.conduta, conf?.standoutResponse].filter(v => v != null).length
              + (conf?.absencesReport?.trim() ? 1 : 0)
            : 0)
          + (isFerramentasEval2 && conf?.guardaEquipamentos != null ? 1 : 0);
        // Respondido = concluído (não depende da confirmação de resultados do RH).
        const allWorkDone = (total > 0 || confTotal > 0 || delegated.length > 0)
          && submitted === total
          && delegatedPending === 0
          && confDone === confTotal;
        return { event: ev, total, submitted, done: allWorkDone, relevant: total > 0 || isConformityEval || isFerramentasEval2 || delegated.length > 0 };
      }).filter(s => s.relevant)
    : [];
  // Eventos com qualquer publicação (parcial ou final) mas onde o avaliador
  // ainda não concluiu — ficam numa seção própria "Publicado" e NÃO aparecem
  // mais em "A Fazer" para não pressionar o avaliador após a publicação.
  const publishedNotDoneEvents = evaluatorEventStats.filter(
    s => !s.done && ((s.event as { partialPublishedAt?: string | null; feedbackReleased?: boolean }).partialPublishedAt || (s.event as { feedbackReleased?: boolean }).feedbackReleased),
  ).map(s => s.event);
  const publishedNotDoneIds = new Set(publishedNotDoneEvents.map(e => e.id));
  const todoEvents = evaluatorEventStats.filter(s => !s.done && !publishedNotDoneIds.has(s.event.id)).map(s => s.event);
  const doneEvents = evaluatorEventStats.filter(s => s.done).map(s => s.event);

  return { configuredEvents, relevantEvaluatorEvents, evaluatorEventStats, publishedNotDoneEvents, todoEvents, doneEvents };
}
