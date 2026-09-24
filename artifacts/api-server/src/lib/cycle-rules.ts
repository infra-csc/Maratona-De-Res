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
