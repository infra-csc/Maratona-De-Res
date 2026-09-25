import { db, eventCriteriaTable, criteriaTable, areasTable, usersTable, eventCriterionAssignmentsTable } from "@workspace/db";
import { eq, inArray, aliasedTable } from "drizzle-orm";

/**
 * Critérios e atribuições de VÁRIOS eventos numa consulta cada. As rotas por
 * evento (GET /events/:id/criteria e /criterion-assignments) e a rota em lote
 * da Central de Avaliações usam estas mesmas funções, então o formato de cada
 * linha é idêntico nos dois caminhos.
 */

export async function loadEventCriteria(eventIds: number[]) {
  if (eventIds.length === 0) return [];
  const partialPubAlias = aliasedTable(usersTable, "partial_pub");
  const finalPubAlias = aliasedTable(usersTable, "final_pub");
  const criteria = await db
    .select({
      id: eventCriteriaTable.id,
      eventId: eventCriteriaTable.eventId,
      criterionId: eventCriteriaTable.criterionId,
      criterionName: criteriaTable.name,
      criterionDescription: criteriaTable.description,
      responsibleAreaId: criteriaTable.responsibleAreaId,
      responsibleAreaName: areasTable.name,
      active: eventCriteriaTable.active,
      originalWeight: criteriaTable.defaultWeight,
      weightOverride: eventCriteriaTable.weightOverride,
      eventScoped: criteriaTable.eventScoped,
      sourceCriterionId: criteriaTable.sourceCriterionId,
      partialPublishedAt: eventCriteriaTable.partialPublishedAt,
      finalPublishedAt: eventCriteriaTable.finalPublishedAt,
      partialPublishedByUserName: partialPubAlias.name,
      finalPublishedByUserName: finalPubAlias.name,
    })
    .from(eventCriteriaTable)
    .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
    .leftJoin(areasTable, eq(criteriaTable.responsibleAreaId, areasTable.id))
    .leftJoin(partialPubAlias, eq(eventCriteriaTable.partialPublishedByUserId, partialPubAlias.id))
    .leftJoin(finalPubAlias, eq(eventCriteriaTable.finalPublishedByUserId, finalPubAlias.id))
    .where(eventIds.length === 1 ? eq(eventCriteriaTable.eventId, eventIds[0]) : inArray(eventCriteriaTable.eventId, eventIds));

  // Peso normalizado é por evento: soma dos pesos ativos de CADA evento.
  const totalByEvent = new Map<number, number>();
  for (const c of criteria) {
    if (!c.active) continue;
    totalByEvent.set(c.eventId, (totalByEvent.get(c.eventId) ?? 0) + parseFloat(c.weightOverride ?? c.originalWeight ?? "1"));
  }
  return criteria.map(c => {
    const w = parseFloat(c.weightOverride ?? c.originalWeight ?? "1");
    const totalWeight = totalByEvent.get(c.eventId) ?? 0;
    return { ...c, originalWeight: parseFloat(c.originalWeight ?? "1"), weightOverride: c.weightOverride ? parseFloat(c.weightOverride) : null, normalizedWeight: c.active && totalWeight > 0 ? w / totalWeight : 0, weight: c.active ? w : 0 };
  });
}

/** Todas as atribuições reais dos eventos (visão de gestor: sem filtro por avaliador). */
export async function loadCriterionAssignments(eventIds: number[]) {
  if (eventIds.length === 0) return [];
  const allAssigned = await db.select({
    id: eventCriterionAssignmentsTable.id,
    eventId: eventCriterionAssignmentsTable.eventId,
    criterionId: eventCriterionAssignmentsTable.criterionId,
    criterionName: criteriaTable.name,
    criterionAreaId: criteriaTable.responsibleAreaId,
    assignedToId: eventCriterionAssignmentsTable.assignedToId,
    assignedToName: usersTable.name,
    status: eventCriterionAssignmentsTable.status,
    redirectedFromId: eventCriterionAssignmentsTable.redirectedFromId,
    confirmedAt: eventCriterionAssignmentsTable.confirmedAt,
    updatedAt: eventCriterionAssignmentsTable.updatedAt,
    createdAt: eventCriterionAssignmentsTable.createdAt,
  })
    .from(eventCriterionAssignmentsTable)
    .leftJoin(criteriaTable, eq(eventCriterionAssignmentsTable.criterionId, criteriaTable.id))
    .leftJoin(usersTable, eq(eventCriterionAssignmentsTable.assignedToId, usersTable.id))
    .where(eventIds.length === 1 ? eq(eventCriterionAssignmentsTable.eventId, eventIds[0]) : inArray(eventCriterionAssignmentsTable.eventId, eventIds))
    .orderBy(criteriaTable.name);

  // redirectedFromName numa segunda consulta (o alias do mesmo users na junção
  // acima deixaria a leitura confusa).
  const redirectFromIds = [...new Set(allAssigned.map(a => a.redirectedFromId).filter((id): id is number => id != null))];
  const redirectFromUsers = redirectFromIds.length > 0
    ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, redirectFromIds))
    : [];
  const redirectFromMap = new Map(redirectFromUsers.map(u => [u.id, u.name]));

  return allAssigned.map(a => ({
    ...a,
    redirectedFromName: a.redirectedFromId != null ? (redirectFromMap.get(a.redirectedFromId) ?? null) : null,
  }));
}
