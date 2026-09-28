import type { CSSProperties } from "react";
import type { ConformityArea } from "./types";

export const fieldStyle: CSSProperties = { backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" };

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

/** Áreas da matriz de conformidade (Cenografia e Ferramentas e Case) com o resumo do que é perguntado. */
export function conformityAreasOf(areas: { id: number; name: string }[]): ConformityArea[] {
  return areas
    .filter(a => {
      const n = a.name.trim().toLowerCase();
      return n.includes("cenografia") || n.includes("ferramentas");
    })
    .map(a => ({
      ...a,
      description: a.name.trim().toLowerCase().includes("ferramentas")
        ? "1 pergunta: Guarda de Equipamentos"
        : "3 perguntas (EPI, Estaiamentos, Conduta) + faltas/atrasos e destaque",
    }));
}
