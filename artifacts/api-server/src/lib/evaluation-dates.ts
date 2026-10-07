/**
 * Datas da liberação da avaliação (puras, sem banco): a avaliação abre no
 * DIA SEGUINTE ao fim do evento, à meia-noite de Brasília.
 */

/** Hoje em Brasília, "AAAA-MM-DD". */
export function todayBR(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Dia em que a avaliação abre: o dia seguinte ao fim do evento. */
export function evaluationOpensOn(ev: { startDate?: string | null; endDate?: string | null }): string | null {
  const end = (ev.endDate ?? ev.startDate ?? "").slice(0, 10);
  if (!end) return null;
  const d = new Date(`${end}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** A avaliação deste evento já abriu (hoje ≥ dia seguinte ao fim). */
export function isOpenForEvaluation(ev: { startDate?: string | null; endDate?: string | null }, now: Date = new Date()): boolean {
  const opens = evaluationOpensOn(ev);
  return !!opens && todayBR(now) >= opens;
}

/** "a partir de 05/10" — para mensagens. */
export function opensLabel(ev: { startDate?: string | null; endDate?: string | null }): string {
  const opens = evaluationOpensOn(ev);
  if (!opens) return "depois do evento";
  const [y, m, d] = opens.split("-");
  return `a partir de ${d}/${m}/${y}`;
}
