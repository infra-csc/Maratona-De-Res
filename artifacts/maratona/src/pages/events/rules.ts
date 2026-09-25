// Regras puras da lista de eventos: classificação (filtros/contadores/badge),
// filtro + ordenação e os valores derivados de cada linha da tabela.
import { fmtDate } from "@/lib/utils";
import { WARNING, GOOD, AMBER, GOOD_TEXT, AMBER_TEXT, DANGER_TEXT, INFO_TEXT } from "@/lib/premium-theme";
import type { EventItem } from "./types";

// Datas vêm como "YYYY-MM-DD": comparar como string evita o deslocamento de
// fuso (new Date("YYYY-MM-DD") é meia-noite UTC = 21h do dia anterior no Brasil,
// o que marcava o evento como "passado" no próprio dia).
export const isPastOrClosed = (e: EventItem, todayStr: string) => e.status === "closed" || (!!e.endDate && e.endDate < todayStr);

export const isInEvaluation = (e: EventItem) =>
  !!e.criteriaConfirmed &&
  (e.evaluationProgress ?? 0) > 0 &&
  (e.calibratedCriteriaCount ?? 0) === 0;

// Publicado parcialmente: tem critério(s) com prévia publicada, mas nem tudo já virou Final.
// O evento só é FINAL quando TODOS os quesitos têm publicação final — enquanto sobrar
// qualquer critério só-parcial, ele é Parcial (mesmo que o feedback já tenha sido liberado).
export const hasPartialPublication = (e: EventItem) =>
  Math.max(0, (e.partialPublishedCount ?? 0) - (e.finalCalibratedCriteria ?? 0)) > 0;

// Pub. Final = TODOS os quesitos com publicação final (ou o evento já liberado),
// e nenhum quesito ainda só-parcial. Mesma regra usada no badge, no filtro e no contador.
export const isPubFinal = (e: EventItem) => {
  if (e.isHistorical) return true;
  if (hasPartialPublication(e)) return false;
  const totalC = e.totalCriteria ?? 0;
  const finalC = e.finalCalibratedCriteria ?? 0;
  return (totalC > 0 && finalC >= totalC) || !!e.feedbackReleased;
};

export type EventListParams = {
  search: string;
  filterDateFrom: string;
  filterDateTo: string;
  cardFilter: string | null;
  sortBy: string;
  todayStr: string;
};

/** Aplica busca, período, chip de status e ordenação (a lista original não é alterada). */
export function filterAndSortEvents(all: EventItem[], { search, filterDateFrom, filterDateTo, cardFilter, sortBy, todayStr }: EventListParams): EventItem[] {
  return all.filter(ev => {
    const matchSearch = ev.name.toLowerCase().includes(search.toLowerCase())
      || (ev.clientName ?? "").toLowerCase().includes(search.toLowerCase())
      || (ev.city ?? "").toLowerCase().includes(search.toLowerCase())
      || (ev.location ?? "").toLowerCase().includes(search.toLowerCase());
    const matchDate = (!filterDateFrom || ev.endDate >= filterDateFrom) && (!filterDateTo || ev.startDate <= filterDateTo);
    const matchCard = cardFilter === null
      || (cardFilter === "pendingRH"  && !ev.criteriaConfirmed)
      // Resultados ainda não confirmados (botão "Confirmar Resultados"): equipe/elegibilidade
      // pendente de validação. Históricos importados ficam de fora — não passam por essa etapa.
      || (cardFilter === "unconfirmed" && !ev.resultsConfirmed && !ev.isHistorical)
      || (cardFilter === "inEval"     && isInEvaluation(ev))
      || (cardFilter === "pendingCal" && isPastOrClosed(ev, todayStr) && (ev.finalCalibratedCriteria ?? 0) === 0 && (ev.partialPublishedCount ?? 0) === 0)
      || (cardFilter === "partialPub" && hasPartialPublication(ev))
      || (cardFilter === "fullyEval"  && isPubFinal(ev));
    return matchSearch && matchDate && matchCard;
  }).slice().sort((a, b) => {
    const sc = (ev: typeof a) => (ev.teamScore ?? ev.averageScore) ?? null;
    const ec = (ev: typeof a) => (ev.totalCriteria ?? 0) > 0 ? (ev.evaluatedCriteria ?? 0) / (ev.totalCriteria ?? 1) : -1;
    const cc = (ev: typeof a) => (ev.totalCriteria ?? 0) > 0 ? (ev.calibratedCriteriaCount ?? 0) / (ev.totalCriteria ?? 1) : -1;
    if (sortBy === "nameAsc")          return a.name.localeCompare(b.name);
    if (sortBy === "nameDesc")         return b.name.localeCompare(a.name);
    if (sortBy === "dateAsc")          return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    if (sortBy === "participantsDesc") return (b.participantCount ?? 0) - (a.participantCount ?? 0);
    if (sortBy === "participantsAsc")  return (a.participantCount ?? 0) - (b.participantCount ?? 0);
    if (sortBy === "evaluatedDesc")    return ec(b) - ec(a);
    if (sortBy === "evaluatedAsc")     return ec(a) - ec(b);
    if (sortBy === "calibrDesc")       return cc(b) - cc(a);
    if (sortBy === "calibrAsc")        return cc(a) - cc(b);
    if (sortBy === "scoreDesc")        return (sc(b) ?? -1) - (sc(a) ?? -1);
    if (sortBy === "scoreAsc")         return (sc(a) ?? 101) - (sc(b) ?? 101);
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });
}

/** Badge de status; `next` = destino do próximo passo quando indica uma pendência acionável. */
export type EventBadge = { bg: string; fg: string; label: string; next?: { href: string; title: string } };

/** Valores derivados de um evento para desenhar a linha da tabela. */
export function deriveEventRow(ev: EventItem) {
  const score = ev.teamScore ?? ev.averageScore ?? null;
  const concluded = ev.status === "closed";
  const total = ev.totalCriteria ?? 0;
  const evaluated = ev.evaluatedCriteria ?? 0;
  const calCount = ev.calibratedCriteriaCount ?? 0;
  // Barra de avaliações: usa critérios como unidade (totalCriteria como denominador).
  // Calibração conta como avaliado para exibição — evita "1/2" quando há 5/5 calibrações.
  const evalTotal = total;
  const evalDone = Math.max(evaluated, calCount);
  const fc = ev.fullyCalibrated ?? false;
  const finalPubCount = ev.finalCalibratedCriteria ?? 0;
  const partialPubTotal = ev.partialPublishedCount ?? 0;
  const calSaved = ev.calibratedCriteriaCount ?? 0;
  const partialOnlyCount = Math.max(0, partialPubTotal - finalPubCount);
  const isPureHistorical = !!ev.isHistorical && calSaved === 0;
  const hasEvals = evalDone > 0;
  const hasAnyPublication = calSaved > 0 || finalPubCount > 0 || partialPubTotal > 0;
  const missing = ev.unassignedAreaNames ?? [];
  const evaluationsHref = `/evaluations?eventId=${ev.id}`;
  const matrixSummary = ev.conformityNeeded ? `Matriz ${ev.conformityFilled ?? 0}/${ev.conformityTotal ?? 0}` : "Matriz não exigida";
  const evalTooltip = `${evalDone} de ${evalTotal} critérios com avaliação completa · ${matrixSummary}`;

  // Accent bar color
  const accentColor = !ev.criteriaConfirmed && !hasEvals && !hasAnyPublication ? WARNING
    : ev.feedbackReleased ? GOOD
    : evalDone === evalTotal && evalTotal > 0 ? "var(--accent)"
    : evalDone > 0 ? AMBER
    : "var(--border)";

  // Score label
  const scoreLabel = finalPubCount > 0 && partialOnlyCount > 0
      ? `${finalPubCount}F · ${partialOnlyCount}P`
      : finalPubCount > 0 ? "Pub. Final"
      : partialOnlyCount > 0 ? "Pub. Parcial"
      : calSaved > 0 ? "Rascunho"
      : "Avaliador";
  const scoreLabelColor = finalPubCount > 0 && partialOnlyCount === 0 ? GOOD_TEXT
    : finalPubCount > 0 || partialOnlyCount > 0 ? AMBER_TEXT
    : calSaved > 0 ? INFO_TEXT
    : "var(--muted-foreground)";

  // MiniBar colors
  const evalColor = !isPureHistorical && evalDone === evalTotal && evalTotal > 0 ? GOOD : "var(--accent)";

  // Date display
  const dateStr = ev.startDate === ev.endDate
    ? fmtDate(ev.startDate)
    : `${fmtDate(ev.startDate)}–${fmtDate(ev.endDate)}`;

  // Mesma regra do chip/contador "Pub. Final" (isPubFinal): antes o badge
  // usava outra fórmula e eventos com "Pub. Final" sumiam do filtro.
  // `next` = destino do próximo passo quando o badge indica uma pendência acionável.
  const badge: EventBadge = ev.isHistorical || isPubFinal(ev)
    ? { bg: "rgba(154,176,0,0.14)", fg: GOOD_TEXT, label: "Pub. Final" }
    : !ev.criteriaConfirmed && !hasEvals && !hasAnyPublication
    ? { bg: "rgba(229,72,77,0.12)", fg: DANGER_TEXT, label: "Aguardando RH", next: { href: evaluationsHref, title: "Aguardando RH: confirmar os critérios e atribuir avaliadores em Avaliações" } }
        : partialOnlyCount > 0
          ? { bg: "rgba(232,162,61,0.14)", fg: AMBER_TEXT, label: "Pub. Parcial" }
          : (calSaved > 0 || fc)
            ? { bg: "rgba(91,141,239,0.14)", fg: INFO_TEXT, label: "Rascunho" }
          : concluded
            ? { bg: "rgba(154,176,0,0.14)", fg: GOOD_TEXT, label: "Concluído" }
            : evalDone === evalTotal && evalTotal > 0
              ? { bg: "rgba(154,176,0,0.14)", fg: GOOD_TEXT, label: "Avaliado" }
              : missing.length > 0
                ? { bg: "rgba(229,72,77,0.12)", fg: DANGER_TEXT, label: "Sem Avaliador", next: { href: evaluationsHref, title: `Sem avaliador em: ${missing.join(", ")}. Atribuir em Avaliações` } }
                : evalDone > 0 || evalTotal > 0
                  ? { bg: "rgba(232,162,61,0.14)", fg: AMBER_TEXT, label: "Em Avaliação" }
                  : { bg: "var(--secondary)", fg: "var(--muted-foreground)", label: "Aguardando" };

  return {
    score, fc, total, evalTotal, evalDone, finalPubCount, partialOnlyCount, isPureHistorical,
    hasEvals, hasAnyPublication, missing, evaluationsHref, evalTooltip, accentColor,
    scoreLabel, scoreLabelColor, evalColor, dateStr, badge,
  };
}
