/**
 * Carregadores EM LOTE do recálculo do ciclo e da nota do time por evento.
 *
 * Cada função faz um número FIXO de consultas, independente de quantos
 * eventos/colaboradores o ciclo tem (antes: 5 por evento + 3 por colaborador).
 * As consultas rodam em sequência de propósito: pegam uma conexão do pool por
 * vez, sem o risco de esgotar o pool que o Promise.all por evento trazia.
 *
 * O cálculo em si é puro e fica em lib/cycle-compute.ts.
 */
import {
  db, eventsTable, eventParticipantsTable, evaluationsTable, calibrationsTable,
  eventCriteriaTable, criteriaTable, absencesTable, quarterlyResultsTable,
  platoonRulesTable, employeesTable, employeeCycleEligibilityTable, areasTable,
  eventConformitiesTable, eventAreaAssignmentsTable,
  type EventConformity,
} from "@workspace/db";
import { eq, inArray, sql, type SQL } from "drizzle-orm";
import type { AnyPgTable } from "drizzle-orm/pg-core";
import { getMinEventsForEligibility } from "./cycle.js";
import {
  employeeIdsNeededForRecompute,
  type CycleRecomputeInput, type EventTeamData, type PlatoonRuleMapped,
} from "./cycle-compute.js";
import { pgNum } from "./pg-num.js";

export async function loadPlatoonRules(): Promise<PlatoonRuleMapped[]> {
  const rows = await db.select().from(platoonRulesTable).where(eq(platoonRulesTable.active, true)).orderBy(platoonRulesTable.displayOrder);
  return rows.map(r => ({
    name: r.name, color: r.color,
    minScore: pgNum(r.minScore),
    maxScore: pgNum(r.maxScore),
    minInclusive: r.minInclusive, maxInclusive: r.maxInclusive,
    bonusValue: pgNum(r.bonusValue),
    bonusPerExtraEvent: pgNum(r.bonusPerExtraEvent),
  }));
}

/** Agrupa por chave preservando a ordem em que o banco devolveu as linhas. */
function groupBy<T, K>(rows: T[], key: (r: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const r of rows) {
    const k = key(r);
    let list = map.get(k);
    if (!list) { list = []; map.set(k, list); }
    list.push(r);
  }
  return map;
}

/**
 * Ordem física (heap) das linhas de uma tabela — a ordem em que um seq scan ou
 * bitmap scan as devolve. Ver a nota sobre ORDEM em loadEventTeamData.
 */
export function heapOrder(table: AnyPgTable): SQL {
  return sql`${table}.ctid`;
}

/**
 * ORDEM DAS LINHAS (importa, e o lote precisa reproduzir a consulta antiga):
 *  - critérios: desempatam o mesmo displayOrder em criteriaDetails (ordem
 *    visível). A consulta antiga por evento (com os joins) vinha pelo índice
 *    único (event_id, criterion_id) → aqui ORDER BY event_id, criterion_id;
 *  - avaliações: a média de cada critério é somada nessa ordem (ponto
 *    flutuante: ordem diferente muda o último dígito binário). A consulta
 *    antiga `select * ... where event_id = X` vinha em ordem física (heap) →
 *    aqui ORDER BY event_id, ctid.
 * Sem ORDER BY, o IN (...) com joins veio em outra ordem no harness de
 * equivalência (critérios empatados trocados de lugar e médias com 1 ulp de
 * diferença). Calibrações, designações e conformidade são buscadas por chave
 * única, então a ordem delas não importa.
 *
 * Dados da nota do time de VÁRIOS eventos em 5 consultas (critérios do evento,
 * avaliações, calibrações, avaliadores designados, matriz de conformidade).
 * Todo id pedido aparece no Map (evento sem nada vira listas vazias).
 */
export async function loadEventTeamData(eventIds: number[]): Promise<Map<number, EventTeamData<EventConformity>>> {
  const ids = [...new Set(eventIds)];
  const out = new Map<number, EventTeamData<EventConformity>>();
  if (ids.length === 0) return out;

  const criteriaRows = await db
    .select({
      eventId: eventCriteriaTable.eventId,
      criterionId: eventCriteriaTable.criterionId,
      criterionName: criteriaTable.name,
      criterionDescription: criteriaTable.description,
      responsibleAreaId: criteriaTable.responsibleAreaId,
      responsibleAreaLabel: criteriaTable.responsibleAreaLabel,
      responsibleAreaName: areasTable.name,
      active: eventCriteriaTable.active,
      originalWeight: criteriaTable.defaultWeight,
      weightOverride: eventCriteriaTable.weightOverride,
      displayOrder: criteriaTable.displayOrder,
      eventScoped: criteriaTable.eventScoped,
      sourceCriterionId: criteriaTable.sourceCriterionId,
    })
    .from(eventCriteriaTable)
    .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
    .leftJoin(areasTable, eq(criteriaTable.responsibleAreaId, areasTable.id))
    .where(inArray(eventCriteriaTable.eventId, ids))
    .orderBy(eventCriteriaTable.eventId, eventCriteriaTable.criterionId);
  const evaluations = await db.select().from(evaluationsTable).where(inArray(evaluationsTable.eventId, ids))
    .orderBy(evaluationsTable.eventId, heapOrder(evaluationsTable));
  const calibrations = await db.select().from(calibrationsTable).where(inArray(calibrationsTable.eventId, ids));
  const assignments = await db.select({ eventId: eventAreaAssignmentsTable.eventId, areaId: eventAreaAssignmentsTable.areaId, evaluatorUserId: eventAreaAssignmentsTable.evaluatorUserId })
    .from(eventAreaAssignmentsTable).where(inArray(eventAreaAssignmentsTable.eventId, ids));
  const conformities = await db.select().from(eventConformitiesTable).where(inArray(eventConformitiesTable.eventId, ids));

  const critBy = groupBy(criteriaRows, r => r.eventId);
  const evalBy = groupBy(evaluations, r => r.eventId);
  const calBy = groupBy(calibrations, r => r.eventId);
  const asgBy = groupBy(assignments, r => r.eventId);
  // event_conformities tem índice único por evento; se houvesse duplicata, a
  // consulta antiga (`const [conformity] = ...`) ficava com a primeira.
  const confBy = new Map<number, EventConformity>();
  for (const c of conformities) if (!confBy.has(c.eventId)) confBy.set(c.eventId, c);

  for (const id of ids) {
    out.set(id, {
      criteriaRows: critBy.get(id) ?? [],
      evaluations: evalBy.get(id) ?? [],
      calibrations: calBy.get(id) ?? [],
      areaAssignments: asgBy.get(id) ?? [],
      conformity: confBy.get(id),
    });
  }
  return out;
}

/**
 * Tudo o que recomputeCycleResults precisa de um ciclo, em ~15 consultas fixas
 * (antes: ~8 por evento + 3 por colaborador). Leitura fora da transação, como
 * sempre foi; a escrita atômica (com advisory lock) continua em results.ts.
 */
export async function loadCycleRecomputeInput(cycleId: number, userId: number): Promise<CycleRecomputeInput<EventConformity> & { allCycleEventIds: number[] }> {
  const cycleEvents = await db.select().from(eventsTable).where(eq(eventsTable.cycleId, cycleId));
  const confirmedIds = cycleEvents.filter(e => e.resultsConfirmed).map(e => e.id);
  const allCycleEventIds = cycleEvents.map(e => e.id);
  const platoonRules = await loadPlatoonRules();
  const minEvents = await getMinEventsForEligibility();

  // Snapshot do estado de pagamento atual para preservar decisões manuais.
  const existingRows = await db.select().from(quarterlyResultsTable)
    .where(eq(quarterlyResultsTable.cycleId, cycleId));

  // Nota do time: só eventos confirmados e NÃO históricos (históricos usam importedScore).
  const teamEventIds = cycleEvents.filter(e => e.resultsConfirmed && !e.isHistorical).map(e => e.id);
  const teamDataByEvent = await loadEventTeamData(teamEventIds);

  // Participações nos eventos confirmados (base da nota e da elegibilidade).
  const participationRows = confirmedIds.length > 0
    ? await db.select({
        employeeId: eventParticipantsTable.employeeId,
        eventId: eventParticipantsTable.eventId,
        functionName: eventParticipantsTable.functionName,
        confirmed: eventParticipantsTable.confirmed,
        employmentType: employeesTable.employmentType,
        employeeFunction: employeesTable.functionName,
      })
        .from(eventParticipantsTable)
        .leftJoin(employeesTable, eq(eventParticipantsTable.employeeId, employeesTable.id))
        .where(inArray(eventParticipantsTable.eventId, confirmedIds))
    : [];
  // "Sup Ceno *" em QUALQUER evento do ciclo (confirmado ou não).
  const supCenoCheckRows = allCycleEventIds.length > 0
    ? await db.select({
        employeeId: eventParticipantsTable.employeeId,
        functionName: eventParticipantsTable.functionName,
        employeeFunction: employeesTable.functionName,
      })
        .from(eventParticipantsTable)
        .leftJoin(employeesTable, eq(eventParticipantsTable.employeeId, employeesTable.id))
        .where(inArray(eventParticipantsTable.eventId, allCycleEventIds))
    : [];

  const employeeIds = employeeIdsNeededForRecompute(participationRows, existingRows);
  const employees = employeeIds.length > 0
    ? await db.select().from(employeesTable).where(inArray(employeesTable.id, employeeIds))
    : [];

  const absences = await db.select({
    employeeId: absencesTable.employeeId,
    kind: absencesTable.kind,
    points: absencesTable.points,
    quantity: absencesTable.quantity,
  }).from(absencesTable).where(eq(absencesTable.cycleId, cycleId));

  const eligibilityRows = await db.select().from(employeeCycleEligibilityTable)
    .where(eq(employeeCycleEligibilityTable.cycleId, cycleId));
  // Índice único (employee_id, cycle_id); a consulta antiga usava limit(1).
  const eligibilityByEmployee = new Map<number, { eligible: boolean; reason: string | null }>();
  for (const r of eligibilityRows) if (!eligibilityByEmployee.has(r.employeeId)) eligibilityByEmployee.set(r.employeeId, r);

  return {
    cycleId,
    userId,
    now: new Date(),
    cycleEvents,
    allCycleEventIds,
    platoonRules,
    minEvents,
    existingRows,
    teamDataByEvent,
    participationRows,
    supCenoCheckRows,
    employeesById: new Map(employees.map(e => [e.id, e])),
    absences,
    eligibilityByEmployee,
  };
}
