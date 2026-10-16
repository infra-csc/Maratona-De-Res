// O que cada regra geral significa (rótulo, explicação e tipo de campo), as
// formas de pagamento e as faixas padrão de 2026. Mesmos valores de antes —
// só saíram da tela para um arquivo próprio.
import type { ComponentType } from "react";
import { CircleDollarSign, ClipboardCheck, ShieldCheck } from "lucide-react";

// Faixas fechadas nas duas pontas, com folga decimal de 0,01 entre elas
// (ex: 74,99 / 75,00) — evita a ambiguidade de duas faixas “tocando” no
// mesmo número inteiro (uma nota de 80 pontos precisa cair em UMA faixa
// só, nunca nas duas ao mesmo tempo nem em nenhuma).
export const NEW_TIERS_2026 = [
  { name: "Sem Bônus",              minScore: 0,  maxScore: 69.99, minInclusive: true, maxInclusive: true, bonusValue: 0,    bonusPerExtraEvent: 0,   color: "#64748b" },
  { name: "Branco Caminhada",       minScore: 70, maxScore: 74.99, minInclusive: true, maxInclusive: true, bonusValue: 1200, bonusPerExtraEvent: 200, color: "#e2e8f0" },
  { name: "Branco Corrida",         minScore: 75, maxScore: 79.99, minInclusive: true, maxInclusive: true, bonusValue: 1700, bonusPerExtraEvent: 250, color: "#cbd5e1" },
  { name: "Verde",                  minScore: 80, maxScore: 84.99, minInclusive: true, maxInclusive: true, bonusValue: 2200, bonusPerExtraEvent: 300, color: "#22c55e" },
  { name: "Azul",                   minScore: 85, maxScore: 89.99, minInclusive: true, maxInclusive: true, bonusValue: 2700, bonusPerExtraEvent: 350, color: "#3b82f6" },
  { name: "Quênia",                 minScore: 90, maxScore: 94.99, minInclusive: true, maxInclusive: true, bonusValue: 3200, bonusPerExtraEvent: 400, color: "#ca8a04" },
  { name: "Quênia Alto Rendimento", minScore: 95, maxScore: 100,   minInclusive: true, maxInclusive: true, bonusValue: 3700, bonusPerExtraEvent: 450, color: "#facc15" },
];

export const PAYMENT_OPTIONS = [
  { value: "caju", label: "Caju" },
  { value: "pix", label: "PIX" },
  { value: "transferencia", label: "Transferência bancária" },
  { value: "outro", label: "Outro" },
];

export type GroupKey = "avaliacao" | "elegibilidade" | "pagamento";

export const RULE_META: Record<string, { group: GroupKey; label: string; help: string; unit?: string; inputType: "text" | "number" | "select" }> = {
  max_score: {
    group: "avaliacao",
    label: "Nota máxima por critério",
    help: "Nota máxima de cada critério numa avaliação (escala 0–10 por padrão). Mudar não recalcula avaliações já lançadas: o ideal é mudar só antes do primeiro evento do ciclo.",
    unit: "pontos",
    inputType: "number",
  },
  min_evaluations_to_close: {
    group: "avaliacao",
    label: "Mínimo de avaliações para fechar o evento",
    help: "Quantos avaliadores precisam enviar a avaliação para o evento poder ser fechado e ir para a calibração. Com 1, basta um envio.",
    unit: "avaliações",
    inputType: "number",
  },
  absence_penalty_per_absence: {
    group: "elegibilidade",
    label: "Penalidade por ausência não comunicada",
    help: "Desconto, em pontos (escala 0–100), na nota final por cada “Ausência não comunicada” lançada em Penalidades e méritos. O sistema não lança faltas sozinho: o RH ou o admin lança cada uma.",
    unit: "pontos",
    inputType: "number",
  },
  min_events_eligibility: {
    group: "elegibilidade",
    label: "Mínimo de eventos para o bônus",
    help: "Quantos eventos o colaborador precisa ter no ciclo para ter direito ao bônus. Vale para os ciclos sem mínimo próprio e aparece no desempenho do colaborador, em Resultados e no simulador.",
    unit: "eventos",
    inputType: "number",
  },
  cycle_bonus_paid_by: {
    group: "pagamento",
    label: "Forma de pagamento do bônus",
    help: "Como o bônus do ciclo é pago. Aparece nas exportações e nos relatórios.",
    inputType: "select",
  },
};

type Icon = ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
export const GROUP_META: Record<GroupKey, { icon: Icon; title: string; subtitle: string }> = {
  avaliacao: { icon: ClipboardCheck, title: "Avaliação", subtitle: "Como as notas são dadas e quando o evento pode fechar." },
  elegibilidade: { icon: ShieldCheck, title: "Elegibilidade e penalidade", subtitle: "Quem tem direito ao bônus e quanto pesa uma ausência." },
  pagamento: { icon: CircleDollarSign, title: "Pagamento", subtitle: "Como o bônus chega ao colaborador." },
};
