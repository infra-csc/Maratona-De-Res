// Funções puras e constantes da Central de Avaliações (sem hooks, sem estado).
import type { CSSProperties } from "react";
import type { Evaluation, EventDetail } from "@workspace/api-client-react";
import { WARNING, AMBER, GOOD, GOOD_TEXT, AMBER_TEXT, DANGER_TEXT } from "@/lib/premium-theme";
import type {
  CritFilter, CritPillCounts, CritRow, CritState, ConformityRow, EnrichedEvent, QueueFilters,
} from "./types";

export function fmtDT(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

export const CENOGRAFIA_AREA_ID = 13;
export const FERRAMENTAS_AREA_ID = 16;

/** Lê `?eventId=N` da URL atual (deep-link vindo da tela de Eventos). */
export function readEventIdFromUrl(): number | null {
  const raw = new URLSearchParams(window.location.search).get("eventId");
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const STATE_CFG: Record<CritState, { label: string; bg: string; color: string; accent: string }> = {
  done: { label: "Completo", bg: "rgba(154,176,0,0.14)", color: GOOD_TEXT, accent: GOOD },
  partial: { label: "Parcial", bg: "rgba(232,162,61,0.14)", color: AMBER_TEXT, accent: AMBER },
  pending: { label: "Aguardando", bg: "var(--secondary)", color: "var(--muted-foreground)", accent: "var(--border)" },
  unassigned: { label: "Sem avaliador", bg: "rgba(229,72,77,0.12)", color: DANGER_TEXT, accent: WARNING },
};

export function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

export const fieldStyle: CSSProperties = { backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" };

/** Consultas de fundo (todos os eventos do ciclo): mudam pouco e alimentam
 *  só a fila/KPIs. 5 min de validade e sem refetch ao focar a janela — antes
 *  eram refeitas a cada 30 s e a cada foco (3 × N requisições). O evento
 *  SELECIONADO tem observadores próprios com a validade padrão (30 s). */
export const BACKGROUND_QUERY = { staleTime: 5 * 60_000, refetchOnWindowFocus: false } as const;

/** Índice evento → critério → avaliações, para não varrer o array inteiro
 *  com `find` linear por critério (era O(eventos × critérios × avaliações)). */
export function indexEvaluations(rows: Evaluation[] | undefined): Map<number, Map<number, Evaluation[]>> {
  const byEvent = new Map<number, Map<number, Evaluation[]>>();
  for (const e of rows ?? []) {
    let byCrit = byEvent.get(e.eventId);
    if (!byCrit) { byCrit = new Map(); byEvent.set(e.eventId, byCrit); }
    const list = byCrit.get(e.criterionId);
    if (list) list.push(e); else byCrit.set(e.criterionId, [e]);
  }
  return byEvent;
}

/** Mesmo conjunto de ids (ordem irrelevante). */
export function sameIdSet(a: number[], b: number[]) {
  const sa = new Set(a);
  const sb = new Set(b);
  return sa.size === sb.size && [...sa].every(id => sb.has(id));
}

/** Fila de eventos: aplica busca/filtros e ordena (aba já escolhida em `baseTab`). */
export function filterQueueEvents(baseTab: EnrichedEvent[], filters: QueueFilters): EnrichedEvent[] {
  const { q, areaFilter, evaluatorFilter, filterDateFrom, filterDateTo, sort, conformityFilter, noEvaluatorFilter } = filters;
  const qNorm = q.trim().toLowerCase();
  return baseTab
    .filter(e => {
      const matchConformity = conformityFilter === "all" || (
        conformityFilter === "pending"
          ? (e.conformityNeeded && !e.conformityComplete)
          : (e.conformityNeeded && e.conformityComplete)
      );
      return (!qNorm || e.name.toLowerCase().includes(qNorm))
        && (!areaFilter || e.areaNames.includes(areaFilter))
        && (!evaluatorFilter || e.evaluatorNames.includes(evaluatorFilter))
        && (!filterDateFrom || (e.endDate ?? "") >= filterDateFrom)
        && (!filterDateTo || (e.startDate ?? "") <= filterDateTo)
        && matchConformity
        && (!noEvaluatorFilter || e.unassigned > 0);
    })
    .slice()
    .sort((a, b) => {
      if (sort === "pct") return a.pct - b.pct;
      if (sort === "pending") return (b.total - b.done) - (a.total - a.done);
      if (sort === "data") return (a.startDate ?? "").localeCompare(b.startDate ?? "");
      if (sort === "urgencia") {
        const aUrgent = a.unassigned > 0 ? 1 : 0;
        const bUrgent = b.unassigned > 0 ? 1 : 0;
        if (bUrgent !== aUrgent) return bUrgent - aUrgent;
        if (bUrgent === 1) return b.unassigned - a.unassigned;
        return (a.startDate ?? "").localeCompare(b.startDate ?? "");
      }
      return a.name.localeCompare(b.name, "pt-BR");
    });
}

/** Critérios do evento selecionado filtrados pela pílula ativa + contagem de cada pílula. */
export function computeCriteriaFilter(selected: EnrichedEvent | null, critFilter: CritFilter): { filteredCriteria: CritRow[]; critPillCounts: CritPillCounts } {
  const critFilterLabelMap: Record<string, CritState> = { unassigned: "unassigned", pending: "pending", partial: "partial", done: "done" };
  const filteredCriteria = selected
    ? (critFilter === "all" ? selected.criteria : selected.criteria.filter(c => c.state === critFilterLabelMap[critFilter]))
    : [];
  const critPillCounts = selected
    ? {
        all: selected.total,
        unassigned: selected.criteria.filter(c => c.state === "unassigned").length,
        pending: selected.criteria.filter(c => c.state === "pending").length,
        partial: selected.criteria.filter(c => c.state === "partial").length,
        done: selected.done,
      }
    : { all: 0, unassigned: 0, pending: 0, partial: 0, done: 0 };
  return { filteredCriteria, critPillCounts };
}

/** Linhas da Matriz de conformidade (Cenografia + Ferramentas) do evento selecionado. */
export function buildConformityRows(selectedDetail: EventDetail | undefined): ConformityRow[] {
  const conformity = selectedDetail?.conformity ?? null;
  const cenografiaFilled = conformity
    ? [conformity.epi, conformity.estaiamentos, conformity.conduta, conformity.standoutResponse].filter(v => v != null).length
      + (conformity.absencesReport?.trim() ? 1 : 0)
    : 0;
  const ferramentasFilled = conformity?.guardaEquipamentos != null ? 1 : 0;
  return [
    {
      key: "cenografia" as const,
      name: "Matriz de Conformidade",
      scope: "Cenografia · 5 itens",
      evaluatorId: selectedDetail?.conformityEvaluatorUserId ?? null,
      evaluatorName: selectedDetail?.conformityEvaluatorName ?? null,
      filled: cenografiaFilled, total: 5,
      areaId: CENOGRAFIA_AREA_ID,
    },
    {
      key: "ferramentas" as const,
      name: "Guarda de Ferramentas",
      scope: "Ferramentas e Case · 1 item",
      evaluatorId: selectedDetail?.conformityEvaluatorFerramentasUserId ?? null,
      evaluatorName: selectedDetail?.conformityEvaluatorFerramentasName ?? null,
      filled: ferramentasFilled, total: 1,
      areaId: FERRAMENTAS_AREA_ID,
    },
  ];
}
