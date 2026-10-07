// Regras ÚNICAS de "critério completo" e da aba da fila da Central — puras
// (sem os aliases do app), para os testes rodarem direto no node --test.
import type { EventItem } from "./types";

/**
 * Regra ÚNICA de "critério completo" (Eventos e Central de Avaliações):
 * o critério tem avaliação ENVIADA (pela regra do ciclo — por área, uma
 * resposta basta) OU calibração PUBLICADA (parcial ou final). Calibração só
 * salva não conta: ela só vale depois de publicar (regra do dono, 01/10/2026).
 * Por critério (a Central tem o detalhe de cada um):
 */
export const isCriterionComplete = (c: { submitted: boolean; published: boolean }) => c.submitted || c.published;

/**
 * A mesma regra pelos totais de GET /events (a lista de Eventos não tem o
 * detalhe por critério): enviados (evaluatedCriteria) ou publicados — o maior
 * dos dois, limitado ao total. Antes contava a calibração salva e o mesmo
 * evento aparecia "2/2" em Eventos e "0/2" na Central.
 */
export function completedCriteriaCount(e: Pick<EventItem, "totalCriteria" | "evaluatedCriteria" | "partialPublishedCount" | "finalCalibratedCriteria">): number {
  const total = e.totalCriteria ?? 0;
  const done = Math.max(e.evaluatedCriteria ?? 0, e.partialPublishedCount ?? 0, e.finalCalibratedCriteria ?? 0);
  return Math.min(total, done);
}

/** Contagem de respostas no ciclo por área: done de total. */
export type AreaResponseCount = { done: number; total: number };

/**
 * Ciclo por ÁREA: respostas por área — cada critério ATIVO do evento conta,
 * inclusive as cópias por área dos critérios multiárea (5 critérios = 2 de
 * uma área + 3 × 6 áreas = 20). Completo pela regra única (enviado ou
 * publicado). É a mesma conta da Central (quadro por área), da lista de
 * Eventos, dos cartões do celular e do detalhe do evento.
 */
export function areaResponseCounts(
  criteria: { criterionId: number; eventId?: number; active: boolean; partialPublishedAt?: string | null; finalPublishedAt?: string | null }[],
  evaluations: { criterionId: number; eventId?: number; status: string }[],
): AreaResponseCount {
  const submitted = new Set(evaluations.filter(e => e.status === "submitted").map(e => e.criterionId));
  const active = criteria.filter(c => c.active);
  const done = active.filter(c => isCriterionComplete({ submitted: submitted.has(c.criterionId), published: c.partialPublishedAt != null || c.finalPublishedAt != null })).length;
  return { done, total: active.length };
}

/** Aba da fila da Central: "A fazer" (aberto e não concluído), "A abrir" ou "Concluídos". */
export type QueueTabKind = "todo" | "waiting" | "done";

/**
 * Em que aba da Central o evento fica — partição única (todo evento cai em
 * exatamente uma aba):
 *  - Concluídos: todos os critérios completos, evento fechado, histórico ou
 *    com publicação final em todos os critérios;
 *  - A fazer: aberto pela regra única (isOpenEvent) e não concluído — o mesmo
 *    número de "Eventos abertos" de Eventos/Ciclos, menos os já concluídos;
 *  - A abrir: ainda não abriu (o evento não terminou ou é do próximo ciclo);
 *  - o resto (ex.: ciclo fechado) vai para Concluídos.
 */
export function queueTabFor(e: {
  isOpen: boolean; isDone: boolean; nextCycle: boolean; notOpenYet: boolean;
  status?: string | null; isHistorical?: boolean | null; total: number; finalCalibratedCriteria: number;
}): QueueTabKind {
  const concluded = e.isDone || e.status === "closed" || !!e.isHistorical || (e.total > 0 && e.finalCalibratedCriteria >= e.total);
  if (concluded) return "done";
  if (e.isOpen) return "todo";
  if (e.nextCycle || e.notOpenYet) return "waiting";
  return "done";
}

