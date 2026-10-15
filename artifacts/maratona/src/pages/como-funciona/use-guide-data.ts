// Dados do guia: mínimo de eventos do ciclo atual, Matriz (com ou sem
// Conduta), faixas com bônus e os tipos de penalidade/mérito ativos.
import { useGetRules, useGetPlatoonRules, useGetPenaltyTypes, useGetCurrentCycle } from "@workspace/api-client-react";

export function useGuideData() {
  const { data: rules } = useGetRules();
  const { data: platoonRules, isLoading: tiersLoading } = useGetPlatoonRules();
  const { data: penaltyTypes, isLoading: typesLoading } = useGetPenaltyTypes();
  const { data: currentCycle } = useGetCurrentCycle();

  // Mínimo do CICLO ATUAL (cada ciclo pode ter o seu, ex.: 7 no ciclo novo);
  // sem o ciclo, a regra geral de Regras do Sistema.
  const minEvents = (() => {
    if (currentCycle?.effectiveMinEvents != null) return currentCycle.effectiveMinEvents;
    const raw = rules?.find(r => r.key === "min_events_eligibility")?.value;
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) ? n : null;
  })();
  // Ciclo sem a Conduta na Matriz (avaliada no critério Proatividade/Conduta).
  const withoutConduta = !!currentCycle?.conformityWithoutConduta;
  const conformityItems = [
    { item: "Uso de EPI", desc: "Equipamentos de Proteção Individual utilizados corretamente durante o evento." },
    { item: "Estaiamento / Aterramento", desc: "Estruturas devidamente fixadas e aterradas conforme as normas de segurança." },
    { item: "Guarda de Equipamentos / Ferramentas", desc: "Todas as ferramentas e cases retornam à base sem perdas, danos ou esquecimentos." },
    ...(withoutConduta ? [] : [{ item: "Conduta e Comportamento", desc: "Comportamento profissional, uso correto de uniforme e cumprimento de horários durante o evento." }]),
  ];

  const bonusTiers = (platoonRules ?? [])
    .filter(t => t.active && t.bonusValue > 0)
    .slice()
    .sort((a, b) => a.minScore - b.minScore);

  const penalties = (penaltyTypes ?? []).filter(t => t.active && t.kind === "penalty").sort((a, b) => a.displayOrder - b.displayOrder);
  const merits = (penaltyTypes ?? []).filter(t => t.active && t.kind === "merit").sort((a, b) => a.displayOrder - b.displayOrder);

  return {
    minEvents, withoutConduta, conformityItems, bonusTiers, penalties, merits,
    tiersLoading, typesLoading, areaEvaluation: currentCycle?.areaEvaluation !== false, cycleName: currentCycle?.name ?? null,
  };
}

export type GuideData = ReturnType<typeof useGuideData>;

export const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtScore = (n: number) => {
  const r = Math.round(n * 100) / 100;
  return r % 1 === 0 ? String(r) : r.toFixed(2).replace(".", ",");
};
export const fmtRange = (min: number, max: number, maxInclusive?: boolean) =>
  maxInclusive ? `${fmtScore(min)} – ${fmtScore(max)}` : `${fmtScore(min)} – ${fmtScore(max - 0.01)}`;
