import { useState } from "react";
import type { EventSummary, StatusFilter } from "./types";

/**
 * Busca por texto + filtro de status do "Histórico de Eventos". O estado mora
 * na página (acima do retorno antecipado), como antes; a lista filtrada e a
 * contagem de pendentes são derivadas a cada render.
 */
export function useEventFilters(events: EventSummary[] | undefined) {
  const [eventFilter, setEventFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Eventos ainda sem confirmação do RH ficam fora da lista e da nota; contamos
  // para avisar o colaborador em vez de escondê-los em silêncio.
  const pendingConfirmationCount = (events ?? []).filter(ev => !ev.resultsConfirmed).length;

  const filteredEvents = (events ?? []).filter(ev => {
    if (!ev.resultsConfirmed) return false;
    const matchesText = !eventFilter ||
      ev.eventName.toLowerCase().includes(eventFilter.toLowerCase()) ||
      (ev.city?.toLowerCase() ?? "").includes(eventFilter.toLowerCase()) ||
      (ev.state?.toLowerCase() ?? "").includes(eventFilter.toLowerCase());
    // "Avaliado" = feedbackReleased OU todos os quesitos (com score) têm publicação final OU histórico.
    const visibleCriteria = ev.criteriaDetails.filter(c => c.scoreUsed !== null);
    const allScoredAreFinal = visibleCriteria.length > 0 && (
      visibleCriteria.every(c => !!c.finalPublishedAt) || !!ev.isHistorical
    );
    const allFinal = ev.feedbackReleased || allScoredAreFinal;
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "avaliado" && allFinal)
      || (statusFilter === "em_avaliacao" && !allFinal && !!ev.criteriaConfirmed);
    return matchesText && matchesStatus;
  });

  return { eventFilter, setEventFilter, statusFilter, setStatusFilter, pendingConfirmationCount, filteredEvents };
}

export type EventFilters = ReturnType<typeof useEventFilters>;
