import type { ConformityArea } from "./types";

/** Mensagem do servidor sem o prefixo "HTTP 409 Conflict: " que o cliente gerado acrescenta. */
export function serverMessage(e: unknown): string {
  const data = (e as { data?: { error?: unknown; message?: unknown } } | null)?.data;
  if (data && typeof data.error === "string" && data.error.trim()) return data.error;
  if (data && typeof data.message === "string" && data.message.trim()) return data.message;
  const msg = (e as { message?: string } | null)?.message ?? "";
  return msg.replace(/^HTTP \d{3}[^:]*:\s*/, "") || "Tente novamente.";
}

/** Campo obrigatório que rejeita espaços em branco (o `required` nativo aceita "   "). */
export const requiredText = (message: string) => ({
  validate: (v: unknown) => (typeof v === "string" && v.trim().length > 0) || message,
});

/**
 * Avaliadores oferecidos para um critério: os da área responsável, ou todos
 * quando o critério não tem área (ou a área não tem ninguém elegível).
 */
export function evaluatorsForArea<T extends { areaId?: number | null }>(evaluators: T[], responsibleAreaId: number | null | undefined): T[] {
  const areaFiltered = responsibleAreaId != null
    ? evaluators.filter(u => (u.areaId ?? null) === responsibleAreaId)
    : [];
  return areaFiltered.length > 0 ? areaFiltered : evaluators;
}

/**
 * Áreas da matriz de conformidade (Cenografia e Ferramentas e Case) com o
 * resumo do que é perguntado. A Conduta sai da matriz nos ciclos que a tiram
 * (cycles.conformity_without_conduta): passe `withoutConduta` quando souber.
 */
export function conformityAreasOf(areas: { id: number; name: string }[], opts: { withoutConduta?: boolean } = {}): ConformityArea[] {
  return areas
    .filter(a => {
      const n = a.name.trim().toLowerCase();
      return n.includes("cenografia") || n.includes("ferramentas");
    })
    .map(a => {
      const tools = a.name.trim().toLowerCase().includes("ferramentas");
      return {
        ...a,
        questions: tools ? ["Guarda de equipamentos"] : opts.withoutConduta ? ["EPI", "Estaiamentos"] : ["EPI", "Estaiamentos", "Conduta"],
        extra: tools ? null : "Faltas/atrasos e destaque",
        note: !tools && opts.withoutConduta ? "A Conduta saiu da matriz neste ciclo." : null,
      };
    });
}

/** Ids das áreas que respondem o critério (responsável + extras; todas as ativas com evaluateAllAreas). */
export function evaluatingAreaIdsOf(
  c: { responsibleAreaId?: number | null; evaluateAllAreas?: boolean; evaluatingAreaIds?: number[] },
  areas: { id: number; active?: boolean }[],
): Set<number> {
  const ids = new Set<number>();
  if (c.responsibleAreaId != null) ids.add(c.responsibleAreaId);
  if (c.evaluateAllAreas) areas.filter(a => a.active !== false).forEach(a => ids.add(a.id));
  else (c.evaluatingAreaIds ?? []).forEach(id => ids.add(id));
  return ids;
}

/** Peso como fatia do total ("23%"); total zero vira "—". */
export function weightShare(weight: number, total: number): number | null {
  return total > 0 ? (weight / total) * 100 : null;
}
