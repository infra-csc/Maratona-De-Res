// Regras puras da lista de eventos: classificação (filtros/contadores/badge),
// filtro + ordenação e os valores derivados de cada linha da tabela.
import type { Cycle } from "@workspace/api-client-react";
import { fmtDate, evaluationOpensOn, todayBR, fmtOpensOn, eventPeriodPosition } from "@/lib/utils";
import { WARNING, GOOD, AMBER, GOOD_TEXT, AMBER_TEXT, DANGER_TEXT, INFO_TEXT } from "@/lib/premium-theme";
import type { EventItem } from "./types";
import { completedCriteriaCount, type AreaResponseCount } from "./criteria-rules";

// Datas vêm como "YYYY-MM-DD": comparar como string evita o deslocamento de
// fuso (new Date("YYYY-MM-DD") é meia-noite UTC = 21h do dia anterior no Brasil,
// o que marcava o evento como "passado" no próprio dia).
export const isPastOrClosed = (e: EventItem, todayStr: string) => e.status === "closed" || (!!e.endDate && e.endDate < todayStr);

/**
 * A avaliação ainda não abriu: ela abre SOZINHA no dia seguinte ao fim do
 * evento (regra do dono, 05/10/2026). Não existe mais "Aguardando RH" para
 * evento futuro — o RH só antecipa a confirmação dos critérios.
 */
export const isNotOpenYet = (e: EventLike, todayStr: string = todayBR()) => {
  const opens = evaluationOpensOn(e);
  return !!opens && todayStr < opens && !e.isHistorical;
};

/**
 * Frase ÚNICA do evento do próximo ciclo (detalhe, Eventos, Central, Matriz,
 * tela do avaliador): o que dá para fazer agora e o que espera o ciclo novo.
 * Mesma regra da API (409 EVENT_NEXT_CYCLE em avaliação, respostas da Matriz e links).
 */
export const NEXT_CYCLE_NOTICE = "Evento do próximo ciclo: dá para preparar equipe, critérios e responsáveis; avaliações, Matriz e links abrem quando o ciclo novo for criado.";

/** Selo curto do evento do próximo ciclo (a frase única vai no título/popover). */
export const NEXT_CYCLE_BADGE = "Próximo ciclo";

/** O mínimo de um evento para as regras de período/abertura (lista de Eventos, Central, avaliador). */
export type EventLike = {
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isHistorical?: boolean | null;
  /** Vem da API (GET /events): evento do próximo ciclo. Quando existe, vale mais que a conta local. */
  nextCycle?: boolean;
  /** Vem da API (GET /events): aberto para avaliação pela regra única. Quando existe, vale mais que a conta local. */
  openForEvaluation?: boolean;
};
type CyclePeriod = (Pick<Cycle, "startDate" | "endDate"> & { status?: string | null }) | null | undefined;

/**
 * Evento do PRÓXIMO ciclo: começa depois do fim do ciclo em que está guardado
 * ("fora do período"). Não conta neste ciclo e não aceita avaliação até o
 * ciclo novo ser criado (a API responde 409 EVENT_NEXT_CYCLE).
 */
export const isNextCycleEvent = (e: EventLike, cycle: CyclePeriod) =>
  typeof e.nextCycle === "boolean" ? e.nextCycle : eventPeriodPosition(e, cycle) === "after";

/**
 * Regra ÚNICA de "evento aberto" (aberto para avaliação) — a mesma do servidor
 * (Event.openForEvaluation, stats.eventsOpen de Ciclos e o Dashboard), usada no
 * cabeçalho de Eventos e na Central: não histórico, status "open", do período
 * do ciclo (o de fora é do próximo ciclo), ciclo não fechado e hoje (Brasília)
 * já é o dia seguinte ao fim do evento. Com o campo da API, vale o da API.
 */
export const isOpenEvent = (e: EventLike, cycle: CyclePeriod, todayStr: string = todayBR()) =>
  typeof e.openForEvaluation === "boolean"
    ? e.openForEvaluation
    : !e.isHistorical && e.status === "open" && cycle?.status !== "closed" && !isNextCycleEvent(e, cycle) && !isNotOpenYet(e, todayStr);

export type CycleEventCounts = {
  /** Todos os eventos guardados no ciclo (= o que a lista mostra = stats.eventsStored). */
  stored: number;
  /** Do período: contam na nota e no bônus (= stats.eventsTotal). */
  inPeriod: number;
  /** Fora do período: são do próximo ciclo (= stats.eventsAfterEnd). */
  afterEnd: number;
  /** Abertos pela regra única (isOpenEvent). */
  open: number;
  /** Do período, ainda não fechados, mas a avaliação não abriu (o evento não terminou). */
  notOpenYet: number;
};

/** Contagens dos eventos de um ciclo com as regras acima. `cycleOf` = ciclo de cada evento. */
export function countCycleEvents<T extends EventLike>(events: readonly T[], cycleOf: (e: T) => CyclePeriod, todayStr: string = todayBR()): CycleEventCounts {
  const c: CycleEventCounts = { stored: 0, inPeriod: 0, afterEnd: 0, open: 0, notOpenYet: 0 };
  for (const e of events) {
    const cycle = cycleOf(e);
    c.stored++;
    if (isNextCycleEvent(e, cycle)) { c.afterEnd++; continue; }
    c.inPeriod++;
    if (isOpenEvent(e, cycle, todayStr)) c.open++;
    else if (e.status === "open" && isNotOpenYet(e, todayStr)) c.notOpenYet++;
  }
  return c;
}

/** Selo de quando a avaliação abre: "Abre em DD/MM" ou, para evento do próximo ciclo, "Próximo ciclo" (a frase única, NEXT_CYCLE_NOTICE, vai no título). `null` = já abriu. */
export function opensLabelFor(e: EventLike, cycle: CyclePeriod, todayStr: string = todayBR()): string | null {
  if (isNextCycleEvent(e, cycle)) return NEXT_CYCLE_BADGE;
  if (!isNotOpenYet(e, todayStr)) return null;
  return `Abre em ${fmtOpensOn(evaluationOpensOn(e), todayStr)}`;
}

// Regras puras de "critério completo" e da aba da Central: em ./criteria-rules (testáveis sem o app).
export { isCriterionComplete, completedCriteriaCount, queueTabFor, areaResponseCounts, type QueueTabKind, type AreaResponseCount } from "./criteria-rules";

/** "Aguardando RH" de verdade: a avaliação já devia ter aberto e os critérios não foram confirmados. */
export const isPendingRH = (e: EventItem, todayStr: string = todayBR()) =>
  !e.criteriaConfirmed && !e.isHistorical && !isNotOpenYet(e, todayStr);

export const isInEvaluation = (e: EventItem) =>
  !!e.criteriaConfirmed &&
  (e.evaluationProgress ?? 0) > 0 &&
  (e.calibratedCriteriaCount ?? 0) === 0;

// Publicado parcialmente: tem critérios com prévia publicada, mas nem tudo já virou Final.
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
      || (cardFilter === "pendingRH"  && isPendingRH(ev, todayStr))
      // Resultados ainda não confirmados (botão "Confirmar Resultados"): equipe/elegibilidade
      // pendente de validação. Históricos importados ficam de fora — não passam por essa etapa.
      || (cardFilter === "unconfirmed" && !ev.resultsConfirmed && !ev.isHistorical)
      || (cardFilter === "inEval"     && isInEvaluation(ev))
      || (cardFilter === "pendingCal" && isPastOrClosed(ev, todayStr) && (ev.finalCalibratedCriteria ?? 0) === 0 && (ev.partialPublishedCount ?? 0) === 0)
      || (cardFilter === "pendingPub" && (ev.pendingPublishCount ?? 0) > 0)
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
export type EventBadge = { bg: string; fg: string; label: string; title?: string; next?: { href: string; title: string } };

/** Valores derivados de um evento para desenhar a linha da tabela (e o cartão no celular). */
/**
 * "DD/MM" no ano corrente; "DD/MM/AAAA" quando a data é de outro ano (evento
 * de um ciclo anterior ou que vira o ano) — sem o ano, "10/12" era ambíguo.
 */
export function fmtEventDate(dateStr: string | null | undefined, todayStr: string = todayBR(), forceYear = false): string {
  if (!dateStr) return "—";
  const sameYear = dateStr.slice(0, 4) === todayStr.slice(0, 4);
  return fmtDate(dateStr, sameYear && !forceYear ? undefined : { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * `areaCounts` (ciclo por área): respostas por ÁREA — as cópias por área dos
 * critérios multiárea contam uma a uma, a mesma conta da Central. Sem ele (fluxo
 * antigo, ou antes de os dados chegarem) a barra conta critérios de origem.
 */
export function deriveEventRow(ev: EventItem, todayStr: string = todayBR(), cycle: CyclePeriod = null, areaCounts: AreaResponseCount | null = null) {
  const score = ev.teamScore ?? ev.averageScore ?? null;
  const concluded = ev.status === "closed";
  const total = ev.totalCriteria ?? 0;
  // Barra de avaliações: critérios completos pela regra única
  // (completedCriteriaCount: enviado ou publicado — o mesmo número da Central).
  const evalTotal = areaCounts ? areaCounts.total : total;
  const fc = ev.fullyCalibrated ?? false;
  const partialPubTotal = ev.partialPublishedCount ?? 0;
  const calSaved = ev.calibratedCriteriaCount ?? 0;
  // Feedback liberado sem "Publicar final" (POST /feedback/release grava o
  // retrato mas não a data de publicação final): para a regra única (isPubFinal)
  // o evento é Pub. Final — a nota, as barras e o selo dizem o mesmo (antes:
  // selo "Pub. Final" ao lado de "Rascunho" e "Calibrações 0/2").
  const releasedAsFinal = !!ev.feedbackReleased && Math.max(0, partialPubTotal - (ev.finalCalibratedCriteria ?? 0)) === 0 && (ev.finalCalibratedCriteria ?? 0) < total;
  const finalPubCount = releasedAsFinal ? total : ev.finalCalibratedCriteria ?? 0;
  const partialOnlyCount = Math.max(0, partialPubTotal - finalPubCount);
  const evalDone = areaCounts ? (releasedAsFinal ? areaCounts.total : areaCounts.done) : releasedAsFinal ? total : completedCriteriaCount(ev);
  const isPureHistorical = !!ev.isHistorical && calSaved === 0;
  const hasEvals = evalDone > 0;
  const hasAnyPublication = calSaved > 0 || finalPubCount > 0 || partialPubTotal > 0;
  const missing = ev.unassignedAreaNames ?? [];
  const evaluationsHref = `/evaluations?eventId=${ev.id}`;
  const matrixSummary = ev.conformityNeeded ? `Matriz ${ev.conformityFilled ?? 0}/${ev.conformityTotal ?? 0}` : "Matriz não exigida";
  // Antes do dia seguinte ao evento a avaliação não abre (nem com o RH tendo
  // confirmado os critérios antes): o status diz quando abre.
  const opensOn = evaluationOpensOn(ev);
  // Evento do próximo ciclo (fora do período): não aceita avaliação até o
  // ciclo novo ser criado — isso vale mais que a data de abertura.
  const nextCycle = isNextCycleEvent(ev, cycle) && !hasEvals && !hasAnyPublication && !ev.isHistorical;
  const notOpenYet = !nextCycle && isNotOpenYet(ev, todayStr) && !hasEvals && !hasAnyPublication;
  // "DD/MM" (ou "DD/MM/AA" a mais de 12 meses): o selo cabe na coluna Status.
  const opensLabel = opensOn ? fmtOpensOn(opensOn, todayStr) : null;
  const pendingRH = !nextCycle && isPendingRH(ev, todayStr) && !hasEvals && !hasAnyPublication;
  const evalTooltip = areaCounts
    ? `${evalDone} de ${evalTotal} respostas das áreas · ${matrixSummary}`
    : `${evalDone} de ${evalTotal} critérios com avaliação completa · ${matrixSummary}`;

  // Accent bar color
  const accentColor = notOpenYet || nextCycle ? "var(--status-info)"
    : pendingRH ? WARNING
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
      // Antes de calibrar: média das respostas enviadas até agora — não é a nota oficial.
      : "Prévia";
  const scoreLabelColor = finalPubCount > 0 && partialOnlyCount === 0 ? GOOD_TEXT
    : finalPubCount > 0 || partialOnlyCount > 0 ? AMBER_TEXT
    : calSaved > 0 ? INFO_TEXT
    : "var(--muted-foreground)";

  // MiniBar colors
  const evalColor = !isPureHistorical && evalDone === evalTotal && evalTotal > 0 ? GOOD : "var(--accent)";

  // Date display
  // Período que toca outro ano: o ano aparece nas duas pontas.
  const otherYear = [ev.startDate, ev.endDate].some(d => !!d && d.slice(0, 4) !== todayStr.slice(0, 4));
  const dateStr = ev.startDate === ev.endDate
    ? fmtEventDate(ev.startDate, todayStr)
    : `${fmtEventDate(ev.startDate, todayStr, otherYear)}–${fmtEventDate(ev.endDate, todayStr, otherYear)}`;

  // Mesma regra do chip/contador "Pub. Final" (isPubFinal): antes o badge
  // usava outra fórmula e eventos com "Pub. Final" sumiam do filtro.
  // `next` = destino do próximo passo quando o badge indica uma pendência acionável.
  const badge: EventBadge = ev.isHistorical || isPubFinal(ev)
    ? { bg: "rgba(154,176,0,0.14)", fg: GOOD_TEXT, label: "Pub. Final" }
    : nextCycle
    ? { bg: "var(--status-info-bg)", fg: INFO_TEXT, label: NEXT_CYCLE_BADGE, title: NEXT_CYCLE_NOTICE }
    : notOpenYet
    ? { bg: "var(--status-info-bg)", fg: INFO_TEXT, label: `Abre em ${opensLabel}`, title: `A avaliação abre sozinha em ${opensOn ? fmtEventDate(opensOn, todayStr, true) : opensLabel}, o dia seguinte ao evento. Não depende do RH.` }
    : pendingRH
    ? { bg: "rgba(229,72,77,0.12)", fg: DANGER_TEXT, label: "Aguardando RH", next: { href: evaluationsHref, title: "Aguardando RH: a avaliação já devia ter aberto — confira os critérios (pesos) e os avaliadores em Avaliações" } }
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
    scoreLabel, scoreLabelColor, evalColor, dateStr, badge, notOpenYet, nextCycle, pendingRH, opensLabel,
    // Prévia (sem calibração): só com ao menos uma resposta; com respostas parciais, "3/20".
    isPreview: scoreLabel === "Prévia",
    previewPartial: scoreLabel === "Prévia" && evalDone > 0 && evalDone < evalTotal ? `${evalDone}/${evalTotal}` : null,
  };
}
