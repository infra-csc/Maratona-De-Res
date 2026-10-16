import type { Absence, Event } from "@workspace/api-client-react";
import { fmtNum, plural } from "@/lib/utils";

export const DATE_FULL: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };

/** Sinal tipográfico do lançamento ("−" é o sinal de menos, não o hífen). */
export const signOf = (kind: string | undefined) => (kind === "merit" ? "+" : "−");

/** Pontos totais do lançamento (pontos do tipo × quantidade). */
export const totalPoints = (a: Pick<Absence, "points" | "quantity">) => a.points * a.quantity;

/** Pontos com sinal ("−50", "+25"). */
export function signedPts(kind: string | undefined, pts: number): string {
  return `${signOf(kind)}${pts.toLocaleString("pt-BR")}`;
}

/**
 * Efeito na nota final: o ponto é dividido pelos eventos com nota do
 * colaborador no ciclo (nota final = média bruta − saldo ÷ nº de eventos).
 * Sem eventos com nota ainda, não dá para dizer (o servidor dá nota 0).
 */
export function scoreEffect(pts: number, events: number | null | undefined): number | null {
  if (!events || events <= 0) return null;
  return pts / events;
}

/** "−6,3" / "+3,1" / "−0,0" vira "< 0,1". */
export function fmtEffect(kind: string | undefined, effect: number | null): string {
  if (effect == null) return "—";
  if (effect > 0 && effect < 0.05) return `${signOf(kind)}<0,1`;
  return `${signOf(kind)}${fmtNum(effect, 1)}`;
}

/** Saldo líquido com sinal (penalidade − mérito): negativo desconta. */
export function fmtNet(net: number): string {
  if (net === 0) return "0";
  return `${net > 0 ? "−" : "+"}${Math.abs(net).toLocaleString("pt-BR")}`;
}

/** "÷ 8 eventos". */
export const perEventsText = (events: number) => `÷ ${plural(events, "evento", "eventos")}`;

/**
 * Evento travado pelo ciclo fechado — espelha a guarda da API
 * (closed-cycle-guard): ciclo fechado e o evento DENTRO do período dele; o
 * "fora do período" (próximo ciclo) continua aceitando lançamento.
 */
export function eventLockedByClosedCycle(ev: Pick<Event, "periodPosition"> | undefined, cycleClosed: boolean): boolean {
  return cycleClosed && ev?.periodPosition !== "after";
}

/** Texto de busca de um lançamento: colaborador, tipo, evento e observação. */
export function absenceHaystack(a: Absence, typeLabel: (slug: string) => string): string {
  return [a.employeeName, typeLabel(a.penaltyType), a.eventName, a.reason]
    .filter(Boolean).join(" ").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
