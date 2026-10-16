// O resumo de cada área que a tela mostra: quem avalia por ela, quem mais
// está nela, os critérios de que é responsável e os que ela também responde.
// Tudo calculado das listas que a tela já carrega (áreas, critérios, usuários).
import type { Area, Criterion, User } from "@workspace/api-client-react";
import { evaluatingAreaIdsOf } from "../criteria/helpers";

export type AreaSummary = {
  area: Area;
  /** Avaliadores ativos da área (quem responde os critérios dela). */
  evaluators: User[];
  /** Outras pessoas ligadas à área (outros papéis ou inativas). */
  others: User[];
  /** Critérios ativos de que a área é a responsável. */
  responsible: Criterion[];
  /** Critérios ativos que a área também responde (sem ser a responsável). */
  alsoEvaluates: Criterion[];
  /** Área ativa com critério para responder e nenhum avaliador ativo. */
  needsEvaluator: boolean;
};

export type AreaFilter = "all" | "true" | "false";

export function summarize(areas: Area[], criteria: Criterion[], users: User[]): AreaSummary[] {
  const activeCriteria = criteria.filter(c => c.active);
  return areas.map(area => {
    const people = users.filter(u => u.areaId === area.id);
    const evaluators = people.filter(u => u.active && u.role === "avaliador").sort(byName);
    const others = people.filter(u => !evaluators.includes(u)).sort(byName);
    const responsible = activeCriteria.filter(c => c.responsibleAreaId === area.id);
    const alsoEvaluates = activeCriteria.filter(c => c.responsibleAreaId !== area.id && evaluatingAreaIdsOf(c, areas).has(area.id));
    return {
      area, evaluators, others, responsible, alsoEvaluates,
      needsEvaluator: area.active && evaluators.length === 0 && responsible.length + alsoEvaluates.length > 0,
    };
  });
}

function byName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name, "pt-BR");
}

/** Busca sem acento e sem caixa. */
export function norm(s: string | null | undefined) {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
