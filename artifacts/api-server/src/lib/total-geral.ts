/**
 * "Total geral" (todos os ciclos) — a MESMA conta em Resultados & Ranking
 * (GET /ranking/total), Dashboard e Análises (regra do dono, 06/10/2026).
 * Função pura sobre as linhas de quarterly_results (uma por pessoa × ciclo),
 * já recortadas por rankingScope.
 *
 *  - média da pessoa = PONDERADA PELOS EVENTOS COM NOTA:
 *    Σ(nota final do ciclo × eventos com nota) ÷ Σ eventos com nota;
 *  - média do Total geral (o KPI de Dashboard, Análises e /ranking/total —
 *    D4, 06/10/2026) = a MESMA ponderação no conjunto: Σ(nota final do ciclo
 *    × eventos com nota) ÷ Σ eventos com nota, somando todas as linhas
 *    pessoa × ciclo com nota (um número só, em toda tela);
 *  - bônus OFICIAL = ciclos FECHADOS em que foi elegível; bônus PROJETADO =
 *    ciclos ainda abertos (muda até o fechamento). Nunca somados sem aviso:
 *    o total é só a soma dos dois, para compatibilidade.
 */
export interface TotalGeralRow {
  employeeId: number;
  cycleId: number;
  finalResult: number;
  eventsCount: number;
  eligible: boolean;
  bonusValue: number;
}

export interface TotalGeralPerson {
  employeeId: number;
  /** null = nenhum evento com nota em ciclo nenhum. */
  avgFinalResult: number | null;
  eventsCount: number;
  bonusOfficial: number;
  bonusProjected: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

export function totalGeralByPerson(rows: TotalGeralRow[], isOfficialCycle: (cycleId: number) => boolean): Map<number, TotalGeralPerson> {
  const out = new Map<number, TotalGeralPerson & { weighted: number }>();
  for (const r of rows) {
    const p = out.get(r.employeeId) ?? { employeeId: r.employeeId, avgFinalResult: null, eventsCount: 0, bonusOfficial: 0, bonusProjected: 0, weighted: 0 };
    if (r.eventsCount > 0) {
      p.weighted += r.finalResult * r.eventsCount;
      p.eventsCount += r.eventsCount;
    }
    const bonus = r.eligible ? r.bonusValue : 0;
    if (isOfficialCycle(r.cycleId)) p.bonusOfficial += bonus;
    else p.bonusProjected += bonus;
    out.set(r.employeeId, p);
  }
  const result = new Map<number, TotalGeralPerson>();
  for (const [id, p] of out) {
    result.set(id, {
      employeeId: id,
      avgFinalResult: p.eventsCount > 0 ? r1(p.weighted / p.eventsCount) : null,
      eventsCount: p.eventsCount,
      bonusOfficial: r2(p.bonusOfficial),
      bonusProjected: r2(p.bonusProjected),
    });
  }
  return result;
}

/** Resumo do Total geral para os KPIs (Dashboard, Análises e /ranking/total). */
export function totalGeralSummary(rows: TotalGeralRow[], isOfficialCycle: (cycleId: number) => boolean) {
  const people = [...totalGeralByPerson(rows, isOfficialCycle).values()];
  const scoredRows = rows.filter(r => r.eventsCount > 0);
  const events = scoredRows.reduce((s, r) => s + r.eventsCount, 0);
  const weighted = scoredRows.reduce((s, r) => s + r.finalResult * r.eventsCount, 0);
  const bonusOfficial = r2(people.reduce((s, p) => s + p.bonusOfficial, 0));
  const bonusProjected = r2(people.reduce((s, p) => s + p.bonusProjected, 0));
  return {
    avgFinalResult: events > 0 ? r1(weighted / events) : null,
    /** Eventos com nota somados (o peso da média). */
    eventsWithScore: events,
    people: people.length,
    bonusOfficial,
    bonusProjected,
    bonusTotal: r2(bonusOfficial + bonusProjected),
  };
}
