/**
 * Regras puras de cadastro de ciclo (sem banco), para validar criação e
 * edição da mesma forma e poder testar sem Postgres.
 *
 * Ciclos NUNCA são excluídos: cada um guarda seus eventos, resultados e bônus
 * (tudo amarrado por cycleId), e é isso que forma o histórico.
 */

export interface CycleRange {
  id: number;
  name: string;
  startDate: string | null;
  endDate: string | null;
}

export interface CycleFields {
  name: string;
  startDate: string;
  endDate: string;
}

export const CYCLE_NAME_MAX = 80;

export interface CycleRuleValues {
  minEvents?: number | null;
  paymentDate?: string | null;
  conformityWithoutConduta?: boolean;
  areaEvaluation?: boolean;
}

/**
 * Regras POR CICLO vindas do corpo da requisição (só as chaves enviadas).
 * minEvents: inteiro 1–50 ou null (= regra global); paymentDate: AAAA-MM-DD
 * ou null; conformityWithoutConduta: boolean.
 */
export function parseCycleRules(body: Record<string, unknown>): { values: CycleRuleValues } | { error: string } {
  const values: CycleRuleValues = {};
  if (body.minEvents !== undefined) {
    const v = body.minEvents;
    if (v === null || v === "") values.minEvents = null;
    else if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 50) values.minEvents = v;
    else return { error: "Mínimo de eventos inválido (de 1 a 50, ou vazio para usar a regra geral)." };
  }
  if (body.paymentDate !== undefined) {
    const v = body.paymentDate;
    if (v === null || v === "") values.paymentDate = null;
    else if (isIsoDate(v)) values.paymentDate = v;
    else return { error: "Data de pagamento inválida." };
  }
  if (body.conformityWithoutConduta !== undefined) {
    if (typeof body.conformityWithoutConduta !== "boolean") return { error: "Valor inválido para a Conduta na matriz." };
    values.conformityWithoutConduta = body.conformityWithoutConduta;
  }
  if (body.areaEvaluation !== undefined) {
    if (typeof body.areaEvaluation !== "boolean") return { error: "Valor inválido para a avaliação por área." };
    values.areaEvaluation = body.areaEvaluation;
  }
  return { values };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" válido no calendário (rejeita 2026-02-30). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** "2026-08-08" -> "08/08/2026" sem passar por fuso. */
export function formatBrDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Valida nome + período de um ciclo contra os demais ciclos cadastrados.
 * `others` NÃO deve conter o próprio ciclo (na edição, filtre pelo id antes).
 * Retorna a mensagem de erro (pt-BR, pronta para a tela) ou null se ok.
 */
export function validateCycleFields(fields: CycleFields, others: CycleRange[]): string | null {
  const name = fields.name.trim();
  if (!name) return "Informe o nome do ciclo.";
  if (name.length > CYCLE_NAME_MAX) return `O nome do ciclo pode ter no máximo ${CYCLE_NAME_MAX} caracteres.`;
  if (!isIsoDate(fields.startDate)) return "Data de início inválida.";
  if (!isIsoDate(fields.endDate)) return "Data de término inválida.";
  if (fields.startDate > fields.endDate) return "A data de início deve ser anterior ou igual à data de término.";

  const sameName = others.find(o => o.name.trim().toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"));
  if (sameName) return `Já existe um ciclo chamado "${sameName.name}". Use outro nome para não confundir o histórico.`;

  const overlap = others.find(o =>
    o.startDate && o.endDate && fields.startDate <= o.endDate && fields.endDate >= o.startDate,
  );
  if (overlap) {
    return `O período se sobrepõe ao ciclo "${overlap.name}" (${formatBrDate(overlap.startDate)} a ${formatBrDate(overlap.endDate)}). Cada dia pertence a um ciclo só.`;
  }
  return null;
}

/** Dia seguinte a "YYYY-MM-DD" (para sugerir o início do próximo ciclo). */
export function nextDay(value: string): string {
  const d = new Date(`${value}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * "O evento pertence ao período do ciclo?" — critério ÚNICO do app inteiro
 * (lista de Eventos, selo "Fora do período", recálculo, fechamento, Análises,
 * ranking e a mudança de ciclo): vale a DATA DE INÍCIO do evento (startDate).
 *  - "before": começa antes do início do ciclo (ex.: histórico importado) —
 *    continua contando no ciclo em que está;
 *  - "after": começa depois do fim do ciclo (ex.: evento de outubro criado
 *    com o ciclo de jun–set ainda atual) — NÃO conta no ciclo em que está:
 *    fica "fora do período" e passa para o ciclo novo quando ele for criado;
 *  - "inside": dentro do período (ciclo sem datas: tudo é "inside").
 */
export type EventPeriodPosition = "before" | "inside" | "after";

export function eventPeriodPosition(
  ev: { startDate: string | null | undefined },
  cycle: { startDate: string | null | undefined; endDate: string | null | undefined } | null | undefined,
): EventPeriodPosition {
  const d = (ev.startDate ?? "").slice(0, 10);
  if (!d || !cycle) return "inside";
  if (cycle.endDate && d > cycle.endDate) return "after";
  if (cycle.startDate && d < cycle.startDate) return "before";
  return "inside";
}

/** Começa depois do fim do ciclo: não conta no ciclo em que está (ver eventPeriodPosition). */
export function isAfterCycleEnd(
  ev: { startDate: string | null | undefined },
  cycle: { endDate: string | null | undefined } | null | undefined,
): boolean {
  return eventPeriodPosition(ev, cycle ? { startDate: null, endDate: cycle.endDate } : cycle) === "after";
}
