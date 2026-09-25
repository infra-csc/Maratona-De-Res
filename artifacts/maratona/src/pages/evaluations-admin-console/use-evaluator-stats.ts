import { useMemo } from "react";
import type { EventDetail } from "@workspace/api-client-react";
import { AMBER, GOOD, GOOD_TEXT, AMBER_TEXT } from "@/lib/premium-theme";
import type { ConformityRow, EnrichedEvent, EventEvaluatorCard, GlobalEvaluatorCard, PendingEvaluatorStats } from "./types";

/** KPI "Avaliadores pendentes" + cards da aba Avaliadores (por evento e global). */
export function useEvaluatorStats({ enrichedEvents, selected, selectedDetail, conformityRows }: {
  enrichedEvents: EnrichedEvent[];
  selected: EnrichedEvent | null;
  selectedDetail: EventDetail | undefined;
  conformityRows: ConformityRow[];
}) {
  // ---- KPIs ----
  const pendingEvaluatorNames = useMemo(() => {
    const map = new Map<number, PendingEvaluatorStats>();
    for (const ev of enrichedEvents) {
      // Critérios regulares
      for (const c of ev.criteria) {
        if (c.assignedToId == null || !c.assignedToName) continue;
        const cur = map.get(c.assignedToId) ?? { name: c.assignedToName, assigned: 0, submitted: 0, pendingEvents: [] };
        cur.assigned++;
        if (c.state === "done") {
          cur.submitted++;
        } else {
          if (!cur.pendingEvents.some(e => e.id === ev.id)) {
            cur.pendingEvents.push({ id: ev.id, name: ev.name });
          }
        }
        map.set(c.assignedToId, cur);
      }
      // Avaliadores da Matriz de Conformidade (cenografia)
      if (ev.conformityEvaluatorUserId != null && ev.conformityEvaluatorName) {
        const cenoDone = ev.conformityCenografiaDone;
        const cur = map.get(ev.conformityEvaluatorUserId) ?? { name: ev.conformityEvaluatorName, assigned: 0, submitted: 0, pendingEvents: [] };
        cur.assigned++;
        if (cenoDone) { cur.submitted++; } else if (!cur.pendingEvents.some(e => e.id === ev.id)) { cur.pendingEvents.push({ id: ev.id, name: ev.name }); }
        map.set(ev.conformityEvaluatorUserId, cur);
      }
      // Avaliadores da Matriz de Conformidade (ferramentas)
      if (ev.conformityEvaluatorFerramentasUserId != null && ev.conformityEvaluatorFerramentasName) {
        const ferrDone = ev.conformityFerramentasDone;
        const cur = map.get(ev.conformityEvaluatorFerramentasUserId) ?? { name: ev.conformityEvaluatorFerramentasName, assigned: 0, submitted: 0, pendingEvents: [] };
        cur.assigned++;
        if (ferrDone) { cur.submitted++; } else if (!cur.pendingEvents.some(e => e.id === ev.id)) { cur.pendingEvents.push({ id: ev.id, name: ev.name }); }
        map.set(ev.conformityEvaluatorFerramentasUserId, cur);
      }
    }
    return map;
  }, [enrichedEvents]);
  const pendingEvaluatorsCount = [...pendingEvaluatorNames.values()].filter(v => v.submitted < v.assigned).length;

  // ---- Aba Avaliadores: por evento selecionado (critérios regulares + matriz) ----
  const evaluatorCards: EventEvaluatorCard[] = useMemo(() => {
    if (!selected) return [];
    const byEval = new Map<number, { name: string; area: string; assigned: number; submitted: number }>();

    // Critérios regulares
    for (const c of selected.criteria) {
      if (c.assignedToId == null || !c.assignedToName) continue;
      const cur = byEval.get(c.assignedToId) ?? { name: c.assignedToName, area: c.areaName, assigned: 0, submitted: 0 };
      cur.assigned++;
      if (c.state === "done") cur.submitted++;
      byEval.set(c.assignedToId, cur);
    }

    // Avaliadores da Matriz de Conformidade (cenografia + ferramentas)
    for (const row of conformityRows) {
      if (row.evaluatorId == null || !row.evaluatorName || row.total === 0) continue;
      const existing = byEval.get(row.evaluatorId);
      if (existing) {
        existing.assigned += row.total;
        existing.submitted += row.filled;
      } else {
        byEval.set(row.evaluatorId, { name: row.evaluatorName, area: row.name, assigned: row.total, submitted: row.filled });
      }
    }

    return Array.from(byEval.entries())
      .map(([id, stats]) => {
        const pct = stats.assigned > 0 ? Math.round((stats.submitted / stats.assigned) * 100) : 0;
        const isComplete = stats.submitted === stats.assigned;
        const cfg = isComplete
          ? { label: "Completo", bg: "rgba(154,176,0,0.14)", color: GOOD_TEXT, accent: GOOD }
          : { label: "Pendente", bg: "rgba(232,162,61,0.14)", color: AMBER_TEXT, accent: AMBER };
        return { id, ...stats, pct, ...cfg };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, selectedDetail]);

  // ---- Aba Avaliadores: visão global (todos os eventos do ciclo) ----
  const globalEvaluatorCards: GlobalEvaluatorCard[] = useMemo(() => {
    return Array.from(pendingEvaluatorNames.entries()).map(([id, stats]) => {
      const pct = stats.assigned > 0 ? Math.round((stats.submitted / stats.assigned) * 100) : 0;
      const isComplete = stats.submitted >= stats.assigned;
      const cfg = isComplete
        ? { label: "Em Dia", bg: "rgba(154,176,0,0.14)", color: GOOD_TEXT, accent: GOOD }
        : { label: "Pendente", bg: "rgba(232,162,61,0.14)", color: AMBER_TEXT, accent: AMBER };
      return { id, name: stats.name, assigned: stats.assigned, submitted: stats.submitted, pendingEvents: stats.pendingEvents, pct, ...cfg };
    }).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [pendingEvaluatorNames]);

  return { pendingEvaluatorsCount, evaluatorCards, globalEvaluatorCards };
}
