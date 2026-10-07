import type { AnalyticsOverview, EventsReport } from "@workspace/api-client-react";
import { displayCriterionName } from "../../lib/criterion-name";

/**
 * Números da apresentação para a equipe, derivados das Análises e do relatório
 * por evento. Só agregados: nenhum nome de avaliador, nenhuma calibração
 * individual e nenhum nome de colaborador sai daqui.
 */

export interface Highlight { label: string; detail?: string; value: number }

export interface TeamStory {
  /** current = ciclo atual; past = ciclo anterior (consulta); all = Total geral (todos os ciclos). */
  scopeKind: "current" | "past" | "all";
  cycleName: string;
  period: string | null;
  teamScore: number | null;
  eventsConfirmed: number;
  eventsTotal: number;
  people: number;
  trend: { label: string; avgScore: number; events: number }[];
  trendDelta: number | null;
  bestWeekend: { label: string; avgScore: number } | null;
  strengths: Highlight[];
  improvements: Highlight[];
  conformityGood: Highlight[];
  conformityImprove: Highlight[];
  areas: Highlight[];
  merits: { occurrences: number; people: number };
  commonPenalties: Highlight[];
  topEvents: { name: string; detail: string; score: number }[];
  faixas: { name: string; color: string | null; count: number; minScore: number | null }[];
  reachedMinEvents: number;
  nearNextFaixa: number;
  minEvents: number;
  pointsPerNo: number;
}

const TOP = 3;


export function buildTeamStory(data: AnalyticsOverview, report: EventsReport | undefined, fmtDay: (iso: string) => string, scopeKind: TeamStory["scopeKind"] = "current"): TeamStory {
  const k = data.kpis;

  // Critérios: fortes = acima da média geral dos critérios; a melhorar = abaixo.
  // Nunca o mesmo critério nas duas listas.
  const crit = data.criteria.filter(c => c.eventsCount > 0);
  const mean = crit.length ? crit.reduce((s, c) => s + c.avgScore, 0) / crit.length : 0;
  const byScore = [...crit].sort((a, b) => b.avgScore - a.avgScore);
  const strengths = byScore.filter(c => c.avgScore >= mean).slice(0, TOP)
    .map(c => ({ label: displayCriterionName(c.name), detail: c.area ?? undefined, value: c.avgScore }));
  const strongKeys = new Set(byScore.filter(c => c.avgScore >= mean).slice(0, TOP).map(c => c.key));
  const improvements = [...byScore].reverse().filter(c => c.avgScore < mean && !strongKeys.has(c.key)).slice(0, TOP)
    .map(c => ({ label: displayCriterionName(c.name), detail: c.area ?? undefined, value: c.avgScore }));

  // Por área: média dos critérios ponderada pelo número de eventos.
  const areaAcc = new Map<string, { sum: number; w: number }>();
  for (const c of crit) {
    if (!c.area) continue;
    const a = areaAcc.get(c.area) ?? { sum: 0, w: 0 };
    a.sum += c.avgScore * c.eventsCount; a.w += c.eventsCount;
    areaAcc.set(c.area, a);
  }
  const areas = [...areaAcc.entries()].map(([label, a]) => ({ label, value: a.sum / a.w })).sort((a, b) => b.value - a.value);

  // Matriz: "bom" = itens com mais "Sim"; "a melhorar" = itens com "Não" (os piores).
  const conf = data.conformity.filter(c => c.answered > 0 && c.naoPct != null);
  const conformityGood = [...conf].sort((a, b) => (a.naoPct ?? 0) - (b.naoPct ?? 0)).slice(0, TOP)
    .map(c => ({ label: c.label, value: 100 - (c.naoPct ?? 0), detail: `${c.answered} respostas` }));
  const goodItems = new Set(conformityGood.map(c => c.label));
  const conformityImprove = [...conf].filter(c => (c.naoPct ?? 0) > 0 && !goodItems.has(c.label))
    .sort((a, b) => (b.naoPct ?? 0) - (a.naoPct ?? 0)).slice(0, TOP)
    .map(c => ({ label: c.label, value: c.naoPct ?? 0, detail: `${c.nao} de ${c.answered} respostas` }));

  const meritRows = data.adjustments.filter(a => a.kind === "merit");
  const merits = {
    occurrences: meritRows.reduce((s, a) => s + a.occurrences, 0),
    people: Math.max(0, ...meritRows.map(a => a.employees)),
  };
  const commonPenalties = data.adjustments.filter(a => a.kind !== "merit")
    .sort((a, b) => b.occurrences - a.occurrences).slice(0, TOP)
    // Sem número de pessoas: num grupo pequeno "1 pessoa" identifica alguém.
    .map(a => ({ label: a.label, value: a.occurrences }));

  const topEvents = (report?.events ?? [])
    .filter(e => e.resultsConfirmed && e.finalScore != null)
    .sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0))
    .slice(0, TOP)
    .map(e => ({
      name: e.name,
      detail: [fmtDay(e.startDate), e.clientName, [e.city, e.state].filter(Boolean).join("/")].filter(Boolean).join(" · "),
      score: e.finalScore as number,
    }));

  const trend = data.scoreTrend.map(t => ({ label: t.label, avgScore: t.avgScore, events: t.events }));
  // Primeira metade × segunda metade do ciclo, ponderado por eventos: um fim de
  // semana isolado (às vezes com 1 evento só) não decide a tendência.
  const half = Math.floor(trend.length / 2);
  const weighted = (xs: typeof trend) => {
    const w = xs.reduce((s, t) => s + t.events, 0);
    return w > 0 ? xs.reduce((s, t) => s + t.avgScore * t.events, 0) / w : null;
  };
  const firstHalf = trend.length >= 2 ? weighted(trend.slice(0, half)) : null;
  const secondHalf = trend.length >= 2 ? weighted(trend.slice(trend.length - half)) : null;
  const trendDelta = firstHalf != null && secondHalf != null ? secondHalf - firstHalf : null;
  const bestWeekend = trend.length ? trend.reduce((best, t) => (t.avgScore > best.avgScore ? t : best)) : null;

  return {
    scopeKind,
    cycleName: data.cycle.name,
    period: data.cycle.startDate && data.cycle.endDate ? `${fmtDay(data.cycle.startDate)} a ${fmtDay(data.cycle.endDate)}` : null,
    teamScore: k.avgEventScore ?? null,
    eventsConfirmed: k.eventsConfirmed,
    eventsTotal: k.eventsTotal,
    people: k.collaborators,
    trend, trendDelta, bestWeekend,
    strengths, improvements, conformityGood, conformityImprove, areas,
    merits, commonPenalties, topEvents,
    faixas: data.faixas.map(f => ({ name: f.name, color: f.color ?? null, count: f.count, minScore: f.minScore ?? null })),
    reachedMinEvents: k.reachedMinEvents,
    nearNextFaixa: data.nearNextFaixa.length,
    minEvents: data.ruleSet.minEvents,
    pointsPerNo: data.ruleSet.conformityPenaltyPerNo,
  };
}
