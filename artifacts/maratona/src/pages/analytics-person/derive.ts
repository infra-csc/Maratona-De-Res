import type { EventsReport, PlatoonRule, QuarterlyResult, RankingDetail, RankingDetailEvent } from "@workspace/api-client-react";
import { displayCriterionName } from "../../lib/criterion-name";

/**
 * Contas da análise por colaborador. Tudo aqui replica, no navegador, as
 * regras do servidor (api-server/src/lib/calculations.ts e cycle-compute.ts):
 *
 *   nota final = arred1( Σnotas/N − (penalidades − méritos)/N ), entre 0 e 100
 *   faixa      = regra ativa cujo intervalo contém a nota (2 casas)
 *   bônus      = elegível e faixa paga → base da faixa + extras × valor por extra da MESMA faixa
 *
 * A comparação "com × sem penalidades" só é exibida quando a conta refeita aqui
 * bate com a nota (e o bônus) que o servidor devolveu — se não bater, a tela
 * não inventa número.
 */

// ── Formatação ────────────────────────────────────────────────────────────
// Sem imports de "@/…": este arquivo também roda no `node --test` (derive.test.ts).
/** Número no padrão brasileiro (vírgula decimal), casas fixas — igual a fmtNum de lib/utils. */
export const fmtNum = (value: number, digits = 1) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const n1 = (v: number | null | undefined) => (v == null ? "—" : fmtNum(v, 1));
export const pts = (v: number) => fmtNum(v, Number.isInteger(v) ? 0 : 1);
export const brl = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
/** Sinal tipográfico de verdade (−) e 1 casa. */
export const signed = (v: number, digits = 1) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${fmtNum(Math.abs(v), digits)}`;
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ── Faixas ────────────────────────────────────────────────────────────────
export interface Faixa {
  name: string; color: string; minScore: number; maxScore: number;
  minInclusive: boolean; maxInclusive: boolean; bonusValue: number; bonusPerExtraEvent: number;
}

export function activeFaixas(rules: PlatoonRule[] | undefined): Faixa[] {
  return (rules ?? [])
    .filter(r => r.active)
    .map(r => ({
      name: r.name, color: r.color, minScore: r.minScore, maxScore: r.maxScore,
      minInclusive: r.minInclusive ?? true, maxInclusive: r.maxInclusive ?? true,
      bonusValue: r.bonusValue, bonusPerExtraEvent: r.bonusPerExtraEvent ?? 0,
    }))
    .sort((a, b) => a.minScore - b.minScore);
}

/** Mesma regra de getPlatoonByScore: compara com 2 casas. */
export function faixaOf(score: number | null | undefined, faixas: Faixa[]): Faixa | null {
  if (score == null) return null;
  const s = Math.round(score * 100) / 100;
  for (const f of [...faixas].sort((a, b) => b.minScore - a.minScore)) {
    const aboveMin = f.minInclusive ? s >= f.minScore : s > f.minScore;
    const belowMax = f.maxInclusive ? s <= f.maxScore : s < f.maxScore;
    if (aboveMin && belowMax) return f;
  }
  return null;
}

/**
 * Menor nota final (1 casa, como a nota é gravada) que entra na faixa: o próprio
 * mínimo quando é inclusivo; quando é exclusivo ("acima de 70"), 70,1.
 */
export function entryScoreOf(f: Faixa): number {
  const k = f.minInclusive ? Math.ceil(f.minScore * 10 - 1e-7) : Math.floor(f.minScore * 10 + 1e-7) + 1;
  return k / 10;
}

/** Próxima faixa acima da nota (a de menor nota de entrada maior que a nota). */
export function nextFaixaOf(score: number | null | undefined, faixas: Faixa[]): Faixa | null {
  if (score == null) return null;
  const cur = faixaOf(score, faixas);
  return [...faixas]
    .sort((a, b) => entryScoreOf(a) - entryScoreOf(b))
    .find(f => entryScoreOf(f) > score + 1e-9 && f.name !== cur?.name) ?? null;
}

export interface NextStep {
  faixa: Faixa;
  /** Menor nota final que entra na faixa. */
  entry: number;
  /** Pontos que faltam na nota final (≥ 0, 1 casa). */
  gap: number;
  /** Elegível: bônus total que pagaria com a nota de entrada (mesmos extras). Senão: prêmio base da faixa. */
  bonus: number;
}

/** O que falta para a próxima faixa e quanto ela pagaria, pela nota de ENTRADA (respeita limite exclusivo). */
export function nextStepOf(score: number | null | undefined, faixas: Faixa[], eligible: boolean | null, extras: number): NextStep | null {
  const faixa = nextFaixaOf(score, faixas);
  if (score == null || !faixa) return null;
  const entry = entryScoreOf(faixa);
  return {
    faixa, entry,
    gap: Math.max(0, round1(entry - score)),
    bonus: eligible ? bonusOf(entry, extras, faixas) : faixa.bonusValue,
  };
}

// ── Nota e bônus ──────────────────────────────────────────────────────────
const round1 = (v: number) => Math.round(v * 10 + 1e-7) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;

export function finalOf(scoreSum: number, n: number, penalty: number, merit: number): number | null {
  if (n <= 0) return null;
  return Math.min(100, Math.max(0, round1(scoreSum / n - (penalty - merit) / n)));
}

export function bonusOf(final: number | null, extras: number, faixas: Faixa[]): number {
  const f = faixaOf(final, faixas);
  if (!f || f.bonusValue <= 0) return 0;
  return round2(f.bonusValue + extras * f.bonusPerExtraEvent);
}

export interface Impact {
  /** Pontos lançados. */
  penalty: number; merit: number; n: number;
  final: number | null;
  /** Nota sem as penalidades (méritos mantidos) e sem nenhum lançamento. */
  finalNoPenalty: number | null;
  finalClean: number | null;
  faixa: Faixa | null; faixaNoPenalty: Faixa | null; faixaClean: Faixa | null;
  /** Quanto as penalidades tiraram da nota final (≥ 0). */
  lostPoints: number;
  /** Quanto os méritos somaram à nota final (≥ 0). */
  gainedPoints: number;
  /** A conta refeita bate com a nota do servidor. */
  verified: boolean;
  /** Bônus com e sem penalidades; null = não dá para calcular com segurança. */
  bonus: { eligible: boolean; extras: number; now: number; noPenalty: number; clean: number; lost: number } | null;
}

export function impactOf(input: {
  scoreSum: number | null | undefined; n: number; penalty: number; merit: number;
  reportedFinal: number | null | undefined;
  /** null = elegibilidade desconhecida (sem bônus na resposta). */
  eligible: boolean | null; extras: number | null;
  /** Bônus que o servidor informou para hoje (para conferir a conta); null = não conferir. */
  reportedBonus: number | null;
  faixas: Faixa[];
}): Impact {
  const { scoreSum, n, penalty, merit, faixas } = input;
  const ok = scoreSum != null && n > 0;
  const final = ok ? finalOf(scoreSum, n, penalty, merit) : null;
  const finalNoPenalty = ok ? finalOf(scoreSum, n, 0, merit) : null;
  const finalClean = ok ? finalOf(scoreSum, n, 0, 0) : null;
  const verified = ok && input.reportedFinal != null && final != null && Math.abs(final - input.reportedFinal) < 0.001;
  let bonus: Impact["bonus"] = null;
  if (verified && input.eligible != null && input.extras != null && faixas.length > 0) {
    const calc = (f: number | null) => (input.eligible ? bonusOf(f, input.extras!, faixas) : 0);
    const now = calc(final);
    if (input.reportedBonus == null || Math.abs(now - input.reportedBonus) < 0.01) {
      const noPenalty = calc(finalNoPenalty);
      bonus = { eligible: input.eligible, extras: input.extras, now, noPenalty, clean: calc(finalClean), lost: Math.max(0, round2(noPenalty - now)) };
    }
  }
  return {
    penalty, merit, n, final, finalNoPenalty, finalClean,
    faixa: faixaOf(final, faixas), faixaNoPenalty: faixaOf(finalNoPenalty, faixas), faixaClean: faixaOf(finalClean, faixas),
    lostPoints: final != null && finalNoPenalty != null ? Math.max(0, round1(finalNoPenalty - final)) : 0,
    gainedPoints: finalNoPenalty != null && finalClean != null ? Math.max(0, round1(finalNoPenalty - finalClean)) : 0,
    verified, bonus,
  };
}

/**
 * Impacto a partir da linha do ranking (/results/quarterly, valores gravados no
 * último recálculo). Extras: deduzidos do valor extra gravado; se a faixa não
 * paga extra, eventos COM NOTA além do mínimo (a conta é conferida com o
 * bônus gravado antes de ser usada). minEvents null = mínimo desconhecido.
 */
export function impactOfRow(q: QuarterlyResult, minEvents: number | null, faixas: Faixa[]): Impact {
  const n = q.eventsCount ?? 0;
  const eligible = q.eligible ?? null;
  const f = faixaOf(q.finalResult, faixas);
  let extras: number | null = null;
  if (eligible === false) extras = 0;
  else if (eligible) {
    extras = f && f.bonusValue > 0 && f.bonusPerExtraEvent > 0
      ? Math.round((q.extraBonusValue ?? 0) / f.bonusPerExtraEvent)
      : minEvents != null ? Math.max(0, n - minEvents) : null;
  }
  return impactOf({
    scoreSum: q.scoreSum, n, penalty: q.absencePenalty ?? 0, merit: q.meritPoints ?? 0,
    reportedFinal: q.finalResult, eligible, extras, reportedBonus: q.bonusValue, faixas,
  });
}

// ── Eventos do colaborador ────────────────────────────────────────────────
type DetailEvent = RankingDetailEvent & {
  hasScore?: boolean; participationConfirmed?: boolean | null; noScoreReason?: string | null; participationFunction?: string | null;
};

export interface PersonEvent {
  id: number; name: string; date: string | null; place: string | null;
  score: number; counts: boolean;
  /** Por que não entra na nota (quando não entra). */
  why: string | null;
  /** Nota do evento já existe (mesmo sem confirmar). */
  hasScore: boolean;
  faixaName: string | null; faixaColor: string | null;
  /** Média acumulada da nota depois deste evento (só eventos que contam). */
  runningAvg: number | null;
  /** Pontos tirados da nota do evento pela matriz de conformidade (relatório por evento). */
  conformityPenalty: number | null;
}

export function personEvents(detail: RankingDetail, report: EventsReport | undefined): PersonEvent[] {
  const conf = new Map((report?.events ?? []).map(e => [e.id, e.conformityPenalty]));
  const rows = (detail.events as DetailEvent[]).map(e => {
    const hasScore = e.hasScore ?? e.eventScore > 0;
    let why: string | null = null;
    if (!e.countsForScore) {
      why = e.noScoreReason === "sup_ceno" ? `Função ${e.participationFunction ?? "Sup Ceno"}: participação informativa`
        : e.noScoreReason === "freela" ? "Freela: não entra na nota" : "Participação informativa";
    } else if (e.participationConfirmed === false) why = "Marcado como ausente no evento";
    else if (!e.resultsConfirmed) why = hasScore ? "Resultados ainda não confirmados (nota prévia)" : "Resultados ainda não confirmados";
    else if (!hasScore) why = "Evento sem nota";
    return {
      id: e.eventId, name: e.eventName, date: e.startDate ?? null,
      place: [e.city, e.state].filter(Boolean).join("/") || null,
      score: e.eventScore, counts: why == null, why, hasScore,
      faixaName: e.platoon ?? null, faixaColor: e.platoonColor ?? null,
      runningAvg: null as number | null,
      conformityPenalty: conf.get(e.eventId) ?? null,
    };
  });
  rows.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.name.localeCompare(b.name, "pt-BR"));
  let sum = 0, k = 0;
  for (const r of rows) {
    if (!r.counts) continue;
    sum += r.score; k += 1;
    r.runningAvg = Math.round((sum / k) * 100) / 100;
  }
  return rows;
}

// ── Critérios ─────────────────────────────────────────────────────────────
export interface CriterionCompare {
  key: string; name: string; area: string | null;
  mine: number; team: number; diff: number;
  /** Em quantos eventos dele o critério teve nota. */
  myEvents: number; teamEvents: number;
}

/**
 * Média de cada critério nos eventos confirmados DELE × em todos os eventos
 * confirmados do ciclo, na mesma conta (relatório por evento, nota usada =
 * calibrada quando há; escala 0–10 vira 0–100). A nota do critério é do time
 * do evento, não da pessoa.
 */
export function criteriaCompare(report: EventsReport | undefined, myEventIds: Set<number>): CriterionCompare[] {
  if (!report) return [];
  const acc = new Map<string, { name: string; area: string | null; mine: number[]; team: number[] }>();
  for (const ev of report.events) {
    if (!ev.resultsConfirmed || ev.finalScore == null) continue;
    for (const c of ev.criteria) {
      // O relatório só lista inativos já calibrados, e esses CONTAM na nota
      // (computeEventTeamResultFromData): o filtro é ter nota usada, não `active`.
      if (c.used == null) continue;
      const key = `${displayCriterionName(c.name)}|${c.area ?? ""}`.toLowerCase();
      const v = c.used <= 10 ? c.used * 10 : c.used;
      const a = acc.get(key) ?? { name: displayCriterionName(c.name), area: c.area ?? null, mine: [], team: [] };
      a.team.push(v);
      if (myEventIds.has(ev.id)) a.mine.push(v);
      acc.set(key, a);
    }
  }
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  return [...acc.entries()]
    .filter(([, a]) => a.mine.length > 0)
    .map(([key, a]) => {
      const mine = avg(a.mine), team = avg(a.team);
      return { key, name: a.name, area: a.area, mine, team, diff: mine - team, myEvents: a.mine.length, teamEvents: a.team.length };
    })
    .sort((x, y) => y.mine - x.mine);
}

// ── Equipe ────────────────────────────────────────────────────────────────
/** Posição no ranking (empate divide a posição), do maior para o menor. */
export function rankOf(rows: QuarterlyResult[], employeeId: number): { position: number; total: number } | null {
  const me = rows.find(r => r.employeeId === employeeId);
  if (!me) return null;
  return { position: rows.filter(r => r.finalResult > me.finalResult).length + 1, total: rows.length };
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/** Texto preto ou branco legível sobre a cor da faixa. */
export function inkOn(hex: string | null | undefined): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return "var(--foreground)";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.32 ? "#111111" : "#ffffff";
}

/** Domínio do eixo de nota recortado em volta dos valores (múltiplos de 5). */
export function scoreDomain(values: (number | null | undefined)[], pad = 2): [number, number] {
  const vs = values.filter((v): v is number => v != null);
  if (!vs.length) return [0, 100];
  const lo = Math.max(0, Math.floor((Math.min(...vs) - pad) / 5) * 5);
  const hi = Math.min(100, Math.ceil((Math.max(...vs) + pad) / 5) * 5);
  return hi - lo < 10 ? [Math.max(0, lo - 5), Math.min(100, hi + 5)] : [lo, hi];
}
