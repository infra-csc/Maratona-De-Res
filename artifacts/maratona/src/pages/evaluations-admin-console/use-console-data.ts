import { useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  useGetEvents, useGetUsers, useGetCurrentCycle, useGetEvaluations,
  getEventCriteria, getGetEvaluationsQueryKey, getGetEventsQueryKey,
  type Evaluation,
} from "@workspace/api-client-react";
import { getEventCriterionAssignments, eventCriterionAssignmentsKey } from "@/lib/routing-api";
import { getCycleWeekends } from "@/lib/utils";
import { BACKGROUND_QUERY, indexEvaluations, readEventIdFromUrl } from "./helpers";
import type { CritRow, CritState, EnrichedEvent } from "./types";

/**
 * Dados de base da Central: eventos do ciclo, usuários, ciclo atual,
 * critérios/atribuições/avaliações de TODOS os eventos (fundo) + os do evento
 * selecionado (frescos), e o enriquecimento por critério. Também sincroniza o
 * evento selecionado com a lista e com `?eventId=` da URL.
 */
export function useConsoleData(selectedEventId: number | null, setSelectedEventId: Dispatch<SetStateAction<number | null>>) {
  const { data: events } = useGetEvents(undefined, { query: { queryKey: getGetEventsQueryKey() } });
  const { data: allUsers } = useGetUsers({ query: { queryKey: ["users"] as unknown[] } });
  const { data: cycle } = useGetCurrentCycle();
  const cycleWeekends = getCycleWeekends(cycle?.startDate, cycle?.endDate);

  // Memoizado sobre `events`: antes era um `.filter()` novo a cada render, o
  // que invalidava o useMemo de `enrichedEvents` em TODO render.
  const configuredEvents = useMemo(
    () => (events ?? []).filter(e => e.status === "open" || e.status === "closed"),
    [events],
  );

  // Evento selecionado: estado explícito, inicializado quando a lista chega
  // (e re-apontado para o primeiro se o evento atual sair da lista). Nada de
  // cair silenciosamente em `enrichedEvents[0]`. Na primeira carga, `?eventId=`
  // da URL (link "Avaliações" na tela de Eventos) tem prioridade sobre o primeiro.
  const urlEventIdApplied = useRef(false);
  useEffect(() => {
    if (configuredEvents.length === 0) return;
    if (!urlEventIdApplied.current) {
      urlEventIdApplied.current = true;
      const fromUrl = readEventIdFromUrl();
      if (fromUrl != null && configuredEvents.some(e => e.id === fromUrl)) {
        setSelectedEventId(fromUrl);
        return;
      }
    }
    if (selectedEventId == null || !configuredEvents.some(e => e.id === selectedEventId)) {
      setSelectedEventId(configuredEvents[0].id);
    }
  }, [configuredEvents, selectedEventId]);

  // Espelha a seleção na URL (replaceState: não empilha histórico a cada clique
  // na fila), para que recarregar/compartilhar a página abra o mesmo evento.
  useEffect(() => {
    if (selectedEventId == null) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("eventId") === String(selectedEventId)) return;
    url.searchParams.set("eventId", String(selectedEventId));
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [selectedEventId]);

  // ---- Dados de TODOS os eventos (fundo, 5 min) ----
  // Critérios e atribuições por evento continuam sendo N + N requisições
  // porque a fila (contagem de critérios sem avaliador, filtros por área e
  // por avaliador, "Concluídos") e o KPI/aba global "Avaliadores pendentes"
  // dependem de dados POR CRITÉRIO de cada evento — os agregados de /events
  // (evaluatedCriteria, unassignedAreaNames) têm semântica diferente (por
  // área; exige todos os avaliadores da área) e não substituem isso.
  // As N consultas de avaliações viraram UMA (/evaluations sem eventId).
  const criteriaQueries = useQueries({
    queries: configuredEvents.map(ev => ({
      queryKey: ["event-criteria", ev.id] as unknown[],
      queryFn: () => getEventCriteria(ev.id),
      ...BACKGROUND_QUERY,
    })),
  });
  const assignQueries = useQueries({
    queries: configuredEvents.map(ev => ({
      queryKey: eventCriterionAssignmentsKey(ev.id),
      queryFn: () => getEventCriterionAssignments(ev.id),
      ...BACKGROUND_QUERY,
    })),
  });
  const { data: allEvaluations } = useGetEvaluations(undefined, {
    query: { queryKey: getGetEvaluationsQueryKey(), ...BACKGROUND_QUERY },
  });

  // ---- Evento selecionado (fresco, validade padrão de 30 s) ----
  // Critérios/atribuições usam a MESMA chave das consultas de fundo (cache
  // compartilhado, sem requisição duplicada); só a política de refetch é
  // mais agressiva. As avaliações do evento selecionado têm chave própria.
  useQuery({
    queryKey: ["event-criteria", selectedEventId] as unknown[],
    queryFn: () => getEventCriteria(selectedEventId as number),
    enabled: selectedEventId != null,
  });
  useQuery({
    queryKey: eventCriterionAssignmentsKey(selectedEventId),
    queryFn: () => getEventCriterionAssignments(selectedEventId as number),
    enabled: selectedEventId != null,
  });
  const { data: selectedEvaluationsData } = useGetEvaluations(
    { eventId: selectedEventId ?? undefined },
    {
      query: {
        enabled: selectedEventId != null,
        queryKey: (selectedEventId != null
          ? getGetEvaluationsQueryKey({ eventId: selectedEventId })
          : ["/evaluations", { eventId: null }]) as unknown[],
      },
    },
  );

  // Índice evento → critério → avaliações. Para o evento selecionado, usa a
  // consulta fresca (quando já carregou) no lugar da cópia de fundo.
  const evalIndex = useMemo(() => {
    const idx = indexEvaluations(allEvaluations);
    if (selectedEventId != null && selectedEvaluationsData) {
      const fresh = indexEvaluations(selectedEvaluationsData).get(selectedEventId) ?? new Map<number, Evaluation[]>();
      idx.set(selectedEventId, fresh);
    }
    return idx;
  }, [allEvaluations, selectedEvaluationsData, selectedEventId]);

  // Assinaturas estáveis: os arrays de useQueries são novos a cada render,
  // mas `dataUpdatedAt` só muda quando algum dado realmente chegou.
  const criteriaSig = criteriaQueries.map(q => q.dataUpdatedAt).join(",");
  const assignSig = assignQueries.map(q => q.dataUpdatedAt).join(",");

  // Enriquece cada evento com o status real de cada critério (atribuído +
  // enviado), combinando roteamento (quem está designado) com o envio de
  // fato (evaluations). A tabela de atribuições NUNCA marca "submitted" —
  // isso só existe na avaliação em si.
  const enrichedEvents: EnrichedEvent[] = useMemo(() => {
    return configuredEvents.map((ev, i) => {
      const criteria = (criteriaQueries[i]?.data ?? []).filter(c => c.active);
      const assignments = assignQueries[i]?.data ?? [];
      const assignByCrit = new Map(assignments.map(a => [a.criterionId, a]));
      const evalsByCrit = evalIndex.get(ev.id);
      const rows: CritRow[] = criteria.map(c => {
        const a = assignByCrit.get(c.criterionId);
        const assignedToId = a?.assignedToId ?? null;
        const assignedToName = a?.assignedToName ?? null;
        const critEvals = evalsByCrit?.get(c.criterionId) ?? [];
        const evalRow = assignedToId != null
          ? (critEvals.find(e => e.evaluatorUserId === assignedToId && e.status === "submitted")
             ?? critEvals.find(e => e.evaluatorUserId === assignedToId)
             ?? critEvals.find(e => e.status === "submitted"))
          : critEvals.find(e => e.status === "submitted");
        // Se o assignedToId não corresponde ao evaluatorUserId real (ex: avaliador
        // chegou pelo event_area_assignments enquanto o criterion_routing aponta outro
        // default), a avaliação ainda existe mas o lookup acima não encontra.
        // Verificar se qualquer avaliação submetida existe para o critério.
        const anySubmitted = critEvals.some(e => e.status === "submitted");
        let state: CritState;
        if (assignedToId == null) state = "unassigned";
        else if (anySubmitted || c.partialPublishedAt != null || c.finalPublishedAt != null) state = "done";
        else if (evalRow?.status === "draft") state = "partial";
        else state = "pending";
        return {
          criterionId: c.criterionId,
          criterionName: c.criterionName,
          areaId: c.responsibleAreaId ?? null,
          areaName: c.responsibleAreaName ?? "Sem área",
          assignedToId, assignedToName,
          formSubmitterName: evalRow?.evaluatorName ?? null,
          state,
          submittedAt: evalRow?.submittedAt ?? null,
          score: evalRow?.score != null ? parseFloat(evalRow.score as unknown as string) : null,
          comments: evalRow?.comments ?? null,
          audioUrl: evalRow?.audioUrl ?? null,
        };
      });
      const total = rows.length;
      const done = rows.filter(r => r.state === "done").length;
      const unassigned = rows.filter(r => r.state === "unassigned").length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      const evC = ev as unknown as { conformityNeeded?: boolean; conformityComplete?: boolean; conformityEvaluatorUserId?: number | null; conformityEvaluatorName?: string | null; conformityEvaluatorFerramentasUserId?: number | null; conformityEvaluatorFerramentasName?: string | null };
      return {
        id: ev.id, name: ev.name, clientName: ev.clientName ?? null, city: ev.city ?? null, state: ev.state ?? null,
        status: ev.status, startDate: ev.startDate ?? null, endDate: ev.endDate ?? null,
        criteria: rows, total, done, unassigned, pct,
        areaNames: [...new Set(rows.map(r => r.areaName))],
        evaluatorNames: [...new Set(rows.map(r => r.assignedToName).filter((n): n is string => !!n))],
        isDone: total > 0 && done === total,
        partialPublishedCount: ev.partialPublishedCount ?? 0,
        finalCalibratedCriteria: ev.finalCalibratedCriteria ?? 0,
        conformityNeeded: !!evC.conformityNeeded,
        conformityComplete: !!evC.conformityComplete,
        conformityEvaluatorUserId: evC.conformityEvaluatorUserId ?? null,
        conformityEvaluatorName: evC.conformityEvaluatorName ?? null,
        conformityEvaluatorFerramentasUserId: evC.conformityEvaluatorFerramentasUserId ?? null,
        conformityEvaluatorFerramentasName: evC.conformityEvaluatorFerramentasName ?? null,
      };
    });
  // criteriaQueries/assignQueries são lidos via índice; as assinaturas
  // (dataUpdatedAt) representam o conteúdo deles de forma estável.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configuredEvents, criteriaSig, assignSig, evalIndex]);

  return { allUsers, cycleWeekends, evalIndex, enrichedEvents };
}
