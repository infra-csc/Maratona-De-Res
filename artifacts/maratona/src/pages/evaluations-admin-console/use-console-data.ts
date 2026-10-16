import { useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useGetEvents, useGetUsers, useGetCurrentCycle, useGetEvaluations,
  getEventCriteria, getGetEvaluationsQueryKey, getGetEventsQueryKey,
  getEvaluationConsole, getGetEvaluationConsoleQueryKey,
  type Evaluation,
} from "@workspace/api-client-react";
import { getEventCriterionAssignments, eventCriterionAssignmentsKey } from "@/lib/routing-api";
import { getCycleWeekends, weekendsEnd, todayBR } from "@/lib/utils";
import { isCriterionComplete, isNextCycleEvent, isNotOpenYet, isOpenEvent, opensLabelFor, queueTabFor } from "../events/rules";
import { BACKGROUND_QUERY, indexEvaluations, readEventIdFromUrl } from "./helpers";
import type { CritRow, CritState, EnrichedEvent } from "./types";

/**
 * Dados de base da Central: eventos do ciclo, usuários, ciclo atual,
 * critérios/atribuições/avaliações de TODOS os eventos (fundo) + os do evento
 * selecionado (frescos), e o enriquecimento por critério. Também sincroniza o
 * evento selecionado com a lista e com `?eventId=` da URL.
 */
export function useConsoleData(selectedEventId: number | null, setSelectedEventId: Dispatch<SetStateAction<number | null>>) {
  const { data: events, isLoading: eventsLoading, isError: eventsError, refetch: refetchEvents } = useGetEvents(undefined, { query: { queryKey: getGetEventsQueryKey() } });
  const { data: allUsers } = useGetUsers({ query: { queryKey: ["users"] as unknown[] } });
  const { data: cycle } = useGetCurrentCycle();
  const cycleWeekends = getCycleWeekends(cycle?.startDate, weekendsEnd(cycle?.endDate, events));

  // Memoizado sobre `events`: antes era um `.filter()` novo a cada render, o
  // que invalidava o useMemo de `enrichedEvents` em TODO render.
  const configuredEvents = useMemo(
    () => (events ?? []).filter(e => e.status === "open" || e.status === "closed"),
    [events],
  );

  // Evento selecionado: estado explícito. Na primeira carga, `?eventId=` da URL
  // (link "Avaliações" da tela de Eventos) vale; sem ele, a Central escolhe o
  // primeiro da aba (evaluations-admin-console.tsx). Se o evento sair da lista,
  // a seleção é limpa — a Central re-aponta para o primeiro da aba.
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
    if (selectedEventId != null && !configuredEvents.some(e => e.id === selectedEventId)) {
      setSelectedEventId(null);
    }
  }, [configuredEvents, selectedEventId]);

  // Espelha a seleção na URL (replaceState: não empilha histórico a cada clique
  // na fila), para que recarregar/compartilhar a página abra o mesmo evento.
  useEffect(() => {
    if (!urlEventIdApplied.current) return;
    const url = new URL(window.location.href);
    const current = url.searchParams.get("eventId");
    if (selectedEventId == null) {
      if (current == null) return;
      url.searchParams.delete("eventId");
    } else {
      if (current === String(selectedEventId)) return;
      url.searchParams.set("eventId", String(selectedEventId));
    }
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [selectedEventId]);

  // ---- Dados de TODOS os eventos (fundo, 5 min) ----
  // A fila (contagem de critérios sem avaliador, filtros por área e por
  // avaliador, "Concluídos") e o KPI "Avaliadores pendentes" dependem de dados
  // POR CRITÉRIO de cada evento. Critérios e atribuições de todos os eventos
  // vêm numa requisição só (/evaluation-console) e as avaliações em outra
  // (/evaluations sem eventId) — antes eram 2 requisições por evento.
  const eventIdsParam = useMemo(() => configuredEvents.map(e => e.id).join(","), [configuredEvents]);
  const qc = useQueryClient();
  const { data: consoleData, dataUpdatedAt: consoleUpdatedAt, isLoading: consoleLoading, isError: consoleError, refetch: refetchConsole } = useQuery({
    queryKey: getGetEvaluationConsoleQueryKey({ eventIds: eventIdsParam }),
    queryFn: () => getEvaluationConsole({ eventIds: eventIdsParam }),
    enabled: eventIdsParam !== "",
    ...BACKGROUND_QUERY,
  });
  const { data: allEvaluations } = useGetEvaluations(undefined, {
    query: { queryKey: getGetEvaluationsQueryKey(), ...BACKGROUND_QUERY },
  });

  // ---- Evento selecionado (fresco, validade padrão de 30 s) ----
  // Critérios, atribuições e avaliações do evento selecionado têm consultas
  // próprias, com as chaves que as mutações da Central invalidam; quando
  // chegam, substituem a cópia de fundo daquele evento.
  const { data: selectedCriteria } = useQuery({
    queryKey: ["event-criteria", selectedEventId] as unknown[],
    queryFn: () => getEventCriteria(selectedEventId as number),
    enabled: selectedEventId != null,
  });
  const { data: selectedAssignments } = useQuery({
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

  // Índices evento → linhas. Para cada evento, a consulta própria (do evento
  // selecionado agora ou de um que foi selecionado antes e editado) vence a
  // cópia em lote quando é mais nova — assim trocar de evento não faz a fila
  // voltar a mostrar o estado de antes da edição.
  const criteriaByEvent = useMemo(
    () => indexByEvent(consoleData?.criteria, consoleUpdatedAt, id => ["event-criteria", id]),
    // selectedCriteria entra só para recalcular quando a consulta fresca chega.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [consoleData, consoleUpdatedAt, selectedCriteria, selectedEventId],
  );
  const assignmentsByEvent = useMemo(
    () => indexByEvent(consoleData?.assignments, consoleUpdatedAt, id => eventCriterionAssignmentsKey(id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [consoleData, consoleUpdatedAt, selectedAssignments, selectedEventId],
  );

  function indexByEvent<T extends { eventId: number }>(rows: T[] | undefined, batchUpdatedAt: number, keyOf: (id: number) => readonly unknown[]) {
    const m = new Map<number, T[]>();
    for (const r of rows ?? []) {
      const list = m.get(r.eventId);
      if (list) list.push(r); else m.set(r.eventId, [r]);
    }
    for (const ev of configuredEvents) {
      const state = qc.getQueryState<T[]>(keyOf(ev.id));
      if (state?.data && state.dataUpdatedAt > batchUpdatedAt) m.set(ev.id, state.data);
    }
    return m;
  }

  // Enriquece cada evento com o status real de cada critério (atribuído +
  // enviado), combinando roteamento (quem está designado) com o envio de
  // fato (evaluations). A tabela de atribuições NUNCA marca "submitted" —
  // isso só existe na avaliação em si.
  // Eventos de ciclo com avaliação por área: uma resposta enviada basta e
  // "sem avaliador" não trava (qualquer avaliador da área responde).
  const areaModeIds = useMemo(() => new Set(consoleData?.areaModeEventIds ?? []), [consoleData]);
  const enrichedEvents: EnrichedEvent[] = useMemo(() => {
    const today = todayBR();
    return configuredEvents.map(ev => {
      const areaMode = areaModeIds.has(ev.id);
      const criteria = (criteriaByEvent.get(ev.id) ?? []).filter(c => c.active);
      const assignments = assignmentsByEvent.get(ev.id) ?? [];
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
          : (critEvals.find(e => e.status === "submitted") ?? (areaMode ? critEvals.find(e => e.status === "draft") : undefined));
        // Se o assignedToId não corresponde ao evaluatorUserId real (ex: avaliador
        // chegou pelo event_area_assignments enquanto o criterion_routing aponta outro
        // default), a avaliação ainda existe mas o lookup acima não encontra.
        // Verificar se qualquer avaliação submetida existe para o critério.
        const anySubmitted = critEvals.some(e => e.status === "submitted");
        // Regra única de "critério completo" (a mesma da lista de Eventos):
        // avaliação enviada ou calibração publicada — calibração só salva não conta.
        const complete = isCriterionComplete({ submitted: anySubmitted, published: c.partialPublishedAt != null || c.finalPublishedAt != null });
        let state: CritState;
        if (complete) state = "done";
        else if (assignedToId == null && !areaMode) state = "unassigned";
        else if (evalRow?.status === "draft") state = "partial";
        else state = "pending";
        return {
          criterionId: c.criterionId,
          criterionName: c.criterionName,
          areaId: c.responsibleAreaId ?? null,
          areaName: c.responsibleAreaName ?? "Sem área",
          assignedToId, assignedToName,
          formSubmitterName: evalRow?.evaluatorName ?? null,
          formSubmitterId: evalRow?.status === "submitted" ? evalRow.evaluatorUserId ?? null : null,
          areaMode,
          state,
          submittedAt: evalRow?.submittedAt ?? null,
          score: evalRow?.score != null ? Number(evalRow.score) : null,
          comments: evalRow?.comments ?? null,
          audioUrl: evalRow?.audioUrl ?? null,
        };
      });
      const total = rows.length;
      const done = rows.filter(r => r.state === "done").length;
      const unassigned = rows.filter(r => r.state === "unassigned").length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      const isDone = total > 0 && done === total;
      const nextCycle = !ev.isHistorical && isNextCycleEvent(ev, cycle);
      const notOpenYet = !isNextCycleEvent(ev, cycle) && isNotOpenYet(ev, today);
      const isOpen = isOpenEvent(ev, cycle, today);
      const finalCalibratedCriteria = ev.finalCalibratedCriteria ?? 0;
      return {
        id: ev.id, name: ev.name, clientName: ev.clientName ?? null, city: ev.city ?? null, state: ev.state ?? null,
        status: ev.status, startDate: ev.startDate ?? null, endDate: ev.endDate ?? null,
        criteria: rows, total, done, unassigned, pct,
        areaNames: [...new Set(rows.map(r => r.areaName))],
        evaluatorNames: [...new Set(rows.map(r => r.assignedToName).filter((n): n is string => !!n))],
        isDone,
        areaMode,
        isHistorical: !!ev.isHistorical,
        // Mesmas regras da lista de Eventos (events/rules.ts): evento do
        // próximo ciclo e evento que ainda não terminou não são "a fazer".
        nextCycle,
        notOpenYet,
        opensLabel: ev.isHistorical ? null : opensLabelFor(ev, cycle, today),
        isOpen,
        queueTab: queueTabFor({ isOpen, isDone, nextCycle, notOpenYet, status: ev.status, isHistorical: ev.isHistorical, total, finalCalibratedCriteria }),
        partialPublishedCount: ev.partialPublishedCount ?? 0,
        finalCalibratedCriteria,
        conformityNeeded: !!ev.conformityNeeded,
        conformityComplete: !!ev.conformityComplete,
        conformityCenografiaDone: !!ev.conformityCenografiaDone,
        conformityFerramentasDone: !!ev.conformityFerramentasDone,
        conformityEvaluatorUserId: ev.conformityEvaluatorUserId ?? null,
        conformityEvaluatorName: ev.conformityEvaluatorName ?? null,
        conformityEvaluatorFerramentasUserId: ev.conformityEvaluatorFerramentasUserId ?? null,
        conformityEvaluatorFerramentasName: ev.conformityEvaluatorFerramentasName ?? null,
      };
    });
  }, [configuredEvents, criteriaByEvent, assignmentsByEvent, evalIndex, areaModeIds, cycle]);

  // Ciclo com avaliação por área: a Central acompanha (não atribui) — títulos,
  // aba e indicadores mudam (console-header.tsx, evaluators-view.tsx).
  const cycleAreaMode = !!cycle?.areaEvaluation;
  // Estado da carga (esqueleto/erro da tela): a lista de eventos e o lote de
  // critérios/atribuições — sem eles a fila mostraria "0/0" em tudo.
  const loading = eventsLoading || (eventIdsParam !== "" && consoleLoading);
  const loadError = eventsError || consoleError;
  const retry = () => { void refetchEvents(); void refetchConsole(); };
  return { allUsers, cycleWeekends, evalIndex, enrichedEvents, cycleAreaMode, cycle, loading, loadError, retry };
}
