import type { CSSProperties } from "react";
import type { ConformityArea } from "./types";

export const fieldStyle: CSSProperties = { backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" };

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
