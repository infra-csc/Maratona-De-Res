// Funil do bônus (Análises, relatório e exportação): a ordem e os rótulos das
// etapas saem daqui, iguais nas três saídas — "participaram → atingiram o
// mínimo → elegíveis → com bônus", nessa ordem, venha a API na ordem que vier.

export type FunnelStep = { stage: string; label: string; count: number };

const ORDER = ["participated", "reachedMin", "eligible", "withBonus"];

/**
 * Etapas na ordem certa e com rótulos coerentes com o escopo. No Total geral
 * cada ciclo usa o SEU mínimo de eventos (e uma pessoa conta uma vez por ciclo).
 * Etapas desconhecidas ficam no fim, com o rótulo da API.
 */
export function funnelSteps(
  funnel: readonly FunnelStep[] | null | undefined,
  { isAll, minEvents }: { isAll: boolean; minEvents?: number | null },
): FunnelStep[] {
  const label = (s: FunnelStep): string => {
    switch (s.stage) {
      case "participated": return isAll ? "Participações nos ciclos" : "Participaram do ciclo";
      case "reachedMin": return isAll ? "Atingiram o mínimo de eventos do ciclo" : minEvents != null ? `Atingiram o mínimo (${minEvents} eventos)` : "Atingiram o mínimo de eventos";
      case "eligible": return "Elegíveis ao bônus";
      case "withBonus": return "Com bônus";
      default: return s.label;
    }
  };
  const rank = (s: FunnelStep) => { const i = ORDER.indexOf(s.stage); return i < 0 ? ORDER.length : i; };
  return [...(funnel ?? [])]
    .map((s, i) => ({ s, i }))
    .sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i)
    .map(({ s: step }) => ({ ...step, label: label(step) }));
}

/** O funil só estreita: cada etapa ≤ a anterior. `false` = dado inconsistente (a tela avisa). */
export function isFunnelMonotonic(steps: readonly FunnelStep[]): boolean {
  return steps.every((s, i) => i === 0 || s.count <= steps[i - 1].count);
}
