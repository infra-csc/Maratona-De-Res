// Análises → Total geral → "Colaboradores por faixa": o bônus de cada faixa
// separado em OFICIAL (ciclos fechados) e PROJETADO (ciclo aberto). A visão
// geral (GET /analytics/overview) só traz o total da faixa; o recorte sai da
// soma pessoa × ciclo de GET /ranking/total (cada ciclo diz se é oficial).
import type { RankingTotal } from "@workspace/api-client-react";

export type FaixaBonus = { official: number; projected: number };

/**
 * Oficial × projetado por nome de faixa. `null` quando ainda não há dados ou
 * a soma não fecha com o total de alguma faixa da visão geral — a tela então
 * mostra um valor só, rotulado "Oficial + projetado".
 */
export function faixaBonusSplit(
  total: Pick<RankingTotal, "rows"> | undefined,
  faixas: { name: string; bonusTotal: number }[],
): Map<string, FaixaBonus> | null {
  if (!total) return null;
  const m = new Map<string, FaixaBonus>();
  for (const row of total.rows) {
    for (const c of row.cycles) {
      if (!c.platoon) continue;
      const cur = m.get(c.platoon) ?? { official: 0, projected: 0 };
      if (c.official) cur.official += c.bonusValue ?? 0;
      else cur.projected += c.bonusValue ?? 0;
      m.set(c.platoon, cur);
    }
  }
  const fecha = faixas.every(f => {
    const s = m.get(f.name);
    return Math.abs((s?.official ?? 0) + (s?.projected ?? 0) - f.bonusTotal) < 0.5;
  });
  return fecha ? m : null;
}
