import {
  db, criteriaTable, eventCriteriaTable, areasTable, criterionEvaluatingAreasTable, criterionRoutingTable,
  eventCriterionAssignmentsTable, publicEvalTokensTable, publicEvalTokenCriteriaTable, calibrationsTable, evaluationsTable,
} from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { DbOrTx, Tx } from "./db-tx.js";

/**
 * Critério respondido por várias áreas.
 *
 * Padrão (catálogo): `criteria.evaluate_all_areas` ou a lista
 * `criterion_evaluating_areas` dizem quais áreas, além da responsável,
 * respondem o critério. No evento, cada área extra vira uma CÓPIA do critério
 * (event_scoped, source_criterion_id = original, peso 0, área própria) — o
 * mesmo mecanismo já usado à mão em "Qualidade da Entrega". A nota do critério
 * no evento é a média das áreas que avaliaram (mergeEventScopedCriteria) e a
 * calibração do RH vale para a nota final.
 */

export class AreaCopyError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

/** Nome da cópia: "Nome (n)" — o sufixo é o que Análises e o relatório usam para reagrupar. */
export const copyName = (base: string, n: number) => `${base} (${n})`;

/** Áreas extras desejadas para cada critério do catálogo (sem a área responsável). */
export async function catalogExtraAreas(parentIds: number[], exec: DbOrTx = db): Promise<Map<number, number[]>> {
  const out = new Map<number, number[]>();
  if (parentIds.length === 0) return out;
  const parents = await exec.select({ id: criteriaTable.id, all: criteriaTable.evaluateAllAreas, area: criteriaTable.responsibleAreaId })
    .from(criteriaTable).where(inArray(criteriaTable.id, parentIds));
  const needsAll = parents.some(p => p.all);
  const activeAreas = needsAll
    ? (await exec.select({ id: areasTable.id }).from(areasTable).where(eq(areasTable.active, true))).map(a => a.id)
    : [];
  const listed = await exec.select({ criterionId: criterionEvaluatingAreasTable.criterionId, areaId: criterionEvaluatingAreasTable.areaId })
    .from(criterionEvaluatingAreasTable).where(inArray(criterionEvaluatingAreasTable.criterionId, parentIds));
  for (const p of parents) {
    const base = p.all ? activeAreas : listed.filter(l => l.criterionId === p.id).map(l => l.areaId);
    out.set(p.id, [...new Set(base)].filter(a => a !== p.area).sort((a, b) => a - b));
  }
  return out;
}

interface EventCopy { ecId: number; criterionId: number; areaId: number | null; name: string }

/** Cópias já existentes no evento, por critério de origem. */
async function eventCopies(eventId: number, parentIds: number[], exec: DbOrTx): Promise<Map<number, EventCopy[]>> {
  const out = new Map<number, EventCopy[]>();
  if (parentIds.length === 0) return out;
  const rows = await exec.select({
    ecId: eventCriteriaTable.id, criterionId: criteriaTable.id, areaId: criteriaTable.responsibleAreaId,
    name: criteriaTable.name, sourceId: criteriaTable.sourceCriterionId,
  })
    .from(eventCriteriaTable)
    .innerJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
    .where(and(eq(eventCriteriaTable.eventId, eventId), eq(criteriaTable.eventScoped, true), inArray(criteriaTable.sourceCriterionId, parentIds)));
  for (const r of rows) {
    const list = out.get(r.sourceId!) ?? [];
    list.push({ ecId: r.ecId, criterionId: r.criterionId, areaId: r.areaId, name: r.name });
    out.set(r.sourceId!, list);
  }
  return out;
}

const SUFFIX = /\((\d+)\)\s*$/;

async function createCopies(tx: Tx, eventId: number, parentId: number, areaIds: number[], existing: EventCopy[]): Promise<number> {
  if (areaIds.length === 0) return 0;
  const [parent] = await tx.select().from(criteriaTable).where(eq(criteriaTable.id, parentId)).limit(1);
  if (!parent) return 0;
  const areaNames = new Map((await tx.select({ id: areasTable.id, name: areasTable.name }).from(areasTable)
    .where(inArray(areasTable.id, areaIds))).map(a => [a.id, a.name]));
  let n = Math.max(1, ...existing.map(c => Number(SUFFIX.exec(c.name)?.[1] ?? 1)));
  for (const areaId of areaIds) {
    n += 1;
    const [created] = await tx.insert(criteriaTable).values({
      name: copyName(parent.name, n),
      description: parent.description,
      responsibleAreaId: areaId,
      responsibleAreaLabel: areaNames.get(areaId) ?? null,
      defaultWeight: parent.defaultWeight,
      active: true,
      displayOrder: parent.displayOrder,
      eventScoped: true,
      sourceCriterionId: parentId,
    }).returning({ id: criteriaTable.id });
    // Peso 0: o grupo entra na nota com o peso do original.
    await tx.insert(eventCriteriaTable).values({ eventId, criterionId: created.id, active: true, weightOverride: "0" });
  }
  return areaIds.length;
}

/**
 * Remove uma cópia do evento sem deixar órfãos (atribuição e link público não
 * têm cascade). Mesma regra da rota de exclusão manual: calibrada não sai.
 */
export async function deleteEventCopyTx(tx: Tx, eventId: number, ecId: number, criterionId: number): Promise<void> {
  const [{ calCount }] = await tx.select({ calCount: sql<number>`count(*)` }).from(calibrationsTable)
    .where(and(eq(calibrationsTable.eventId, eventId), eq(calibrationsTable.criterionId, criterionId)));
  if (Number(calCount) > 0) throw new AreaCopyError("Este quesito já foi calibrado. Remova a calibração antes de excluí-lo.", 409);
  const [crit] = await tx.select({ sourceCriterionId: criteriaTable.sourceCriterionId }).from(criteriaTable).where(eq(criteriaTable.id, criterionId)).limit(1);

  await tx.delete(eventCriterionAssignmentsTable).where(and(
    eq(eventCriterionAssignmentsTable.eventId, eventId),
    eq(eventCriterionAssignmentsTable.criterionId, criterionId),
  ));
  const eventTokens = tx.select({ id: publicEvalTokensTable.id }).from(publicEvalTokensTable).where(eq(publicEvalTokensTable.eventId, eventId));
  await tx.delete(publicEvalTokenCriteriaTable).where(and(
    eq(publicEvalTokenCriteriaTable.criterionId, criterionId),
    inArray(publicEvalTokenCriteriaTable.tokenId, eventTokens),
  ));
  await tx.delete(eventCriteriaTable).where(eq(eventCriteriaTable.id, ecId));

  // Só apaga o critério em si se nenhum outro evento o usa (ex.: após mesclagem).
  const [{ otherLinks }] = await tx.select({ otherLinks: sql<number>`count(*)` }).from(eventCriteriaTable)
    .where(eq(eventCriteriaTable.criterionId, criterionId));
  if (Number(otherLinks) === 0) {
    await tx.update(criteriaTable).set({ sourceCriterionId: crit?.sourceCriterionId ?? null })
      .where(eq(criteriaTable.sourceCriterionId, criterionId));
    await tx.delete(criteriaTable).where(eq(criteriaTable.id, criterionId));
  }
}

async function eventHasEvaluationsTx(eventId: number, exec: DbOrTx): Promise<boolean> {
  const [row] = await exec.select({ id: evaluationsTable.id }).from(evaluationsTable).where(eq(evaluationsTable.eventId, eventId)).limit(1);
  return !!row;
}

/**
 * Aplica o padrão do catálogo no evento: cria as cópias das áreas que faltam.
 * Nunca remove (uma área tirada à mão no evento não volta sozinha por outro
 * caminho — só por este botão, que é explícito). `onlyCriterionIds` limita aos
 * critérios recém-vinculados (criação do evento, sincronização).
 */
export async function applyAreaDefaults(eventId: number, exec: DbOrTx = db, onlyCriterionIds?: number[]): Promise<{ created: number }> {
  return exec.transaction(async (tx) => {
    if (await eventHasEvaluationsTx(eventId, tx)) return { created: 0 };
    const parents = await tx.select({ criterionId: eventCriteriaTable.criterionId })
      .from(eventCriteriaTable)
      .innerJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
      .where(and(eq(eventCriteriaTable.eventId, eventId), eq(eventCriteriaTable.active, true), eq(criteriaTable.eventScoped, false)));
    const parentIds = parents.map(p => p.criterionId).filter(id => !onlyCriterionIds || onlyCriterionIds.includes(id));
    const desired = await catalogExtraAreas(parentIds, tx);
    const copies = await eventCopies(eventId, parentIds, tx);
    let created = 0;
    for (const parentId of parentIds) {
      const have = new Set((copies.get(parentId) ?? []).map(c => c.areaId));
      const missing = (desired.get(parentId) ?? []).filter(a => !have.has(a));
      created += await createCopies(tx, eventId, parentId, missing, copies.get(parentId) ?? []);
    }
    return { created };
  });
}

/**
 * Ajuste por evento: define EXATAMENTE quais áreas extras respondem o critério
 * neste evento (cria as que faltam, remove as que saíram). Bloqueado depois
 * que o evento tem avaliações, como qualquer mudança de estrutura.
 */
export async function setEventCriterionAreas(eventId: number, parentId: number, areaIds: number[], exec: DbOrTx = db): Promise<{ created: number; removed: number }> {
  return exec.transaction(async (tx) => {
    if (await eventHasEvaluationsTx(eventId, tx)) {
      throw new AreaCopyError("Este evento já possui avaliações. Os critérios não podem mais ser alterados.", 409);
    }
    const [link] = await tx.select({ id: eventCriteriaTable.id, eventScoped: criteriaTable.eventScoped, area: criteriaTable.responsibleAreaId })
      .from(eventCriteriaTable)
      .innerJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
      .where(and(eq(eventCriteriaTable.eventId, eventId), eq(eventCriteriaTable.criterionId, parentId)))
      .limit(1);
    if (!link) throw new AreaCopyError("Critério não está vinculado a este evento", 404);
    if (link.eventScoped) throw new AreaCopyError("Ajuste as áreas no critério original, não na cópia.", 400);

    const wanted = [...new Set(areaIds)].filter(a => a !== link.area);
    const copies = (await eventCopies(eventId, [parentId], tx)).get(parentId) ?? [];
    const have = new Set(copies.map(c => c.areaId));
    const toRemove = copies.filter(c => c.areaId == null || !wanted.includes(c.areaId));
    for (const c of toRemove) await deleteEventCopyTx(tx, eventId, c.ecId, c.criterionId);
    const created = await createCopies(tx, eventId, parentId, wanted.filter(a => !have.has(a)), copies.filter(c => !toRemove.includes(c)));
    return { created, removed: toRemove.length };
  });
}

/**
 * Avaliador sugerido para a cópia de uma área: o avaliador principal da área —
 * quem mais aparece como avaliador padrão dos critérios do catálogo daquela
 * área. O RH troca na Central quando precisar.
 */
export async function areaPrincipalEvaluators(exec: DbOrTx = db): Promise<Map<number, number>> {
  const rows = await exec.select({ areaId: criteriaTable.responsibleAreaId, userId: criterionRoutingTable.defaultEvaluatorId })
    .from(criterionRoutingTable)
    .innerJoin(criteriaTable, eq(criterionRoutingTable.criterionId, criteriaTable.id))
    .where(eq(criteriaTable.eventScoped, false));
  const counts = new Map<number, Map<number, number>>();
  for (const r of rows) {
    if (r.areaId == null || r.userId == null) continue;
    const byUser = counts.get(r.areaId) ?? new Map<number, number>();
    byUser.set(r.userId, (byUser.get(r.userId) ?? 0) + 1);
    counts.set(r.areaId, byUser);
  }
  const out = new Map<number, number>();
  for (const [areaId, byUser] of counts) {
    const [best] = [...byUser.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    if (best) out.set(areaId, best[0]);
  }
  return out;
}
