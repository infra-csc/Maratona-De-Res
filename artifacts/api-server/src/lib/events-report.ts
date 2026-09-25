import {
  db, eventsTable, employeeEventResultsTable, eventParticipantsTable, employeesTable, cyclesTable, type EventConformity,
} from "@workspace/db";
import { asc, eq, inArray } from "drizzle-orm";
import { loadEventTeamData } from "./cycle-data.js";
import { computeEventTeamResultFromData, emptyEventTeamData } from "./cycle-compute.js";
import { participantCountsForScore } from "./participation.js";
import { pgNum } from "./pg-num.js";

/**
 * Relatório por evento do ciclo: nota final oficial (calibrada), performance,
 * desconto da matriz, cada critério (média dos avaliadores, calibração e
 * justificativa, nota usada, peso) e a equipe que trabalhou. Usa exatamente o
 * cálculo oficial (computeEventTeamResultFromData) e o snapshot do recálculo
 * (employee_event_results) para a nota final dos eventos confirmados.
 */
export interface EventsReport {
  cycle: { id: number; name: string; startDate: string | null; endDate: string | null };
  events: EventReportRow[];
}

export interface EventReportRow {
  id: number;
  name: string;
  clientName: string | null;
  city: string | null;
  state: string | null;
  startDate: string;
  endDate: string;
  status: string;
  resultsConfirmed: boolean;
  isHistorical: boolean;
  /** Nota final oficial (0–100) do recálculo; só para eventos confirmados. */
  finalScore: number | null;
  /** Nota que o evento teria hoje pelo cálculo oficial (0–100), confirmado ou não. */
  projectedScore: number | null;
  /** Subtotal de performance antes da matriz (0–100). */
  performanceScore: number | null;
  /** Pontos descontados pela matriz de conformidade. */
  conformityPenalty: number;
  calibratedCriteria: number;
  evaluatedCriteria: number;
  totalCriteria: number;
  criteria: {
    name: string; area: string | null; weight: number;
    evaluatorAvg: number | null; calibrated: number | null; used: number | null;
    calibrationReason: string | null; status: string; active: boolean;
  }[];
  team: { name: string; functionName: string | null; employmentType: string | null; countsForScore: boolean }[];
}

const r2 = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? null : Math.round(n * 100) / 100);

export async function buildEventsReport(cycleId: number): Promise<EventsReport | null> {
  const [cycle] = await db.select().from(cyclesTable).where(eq(cyclesTable.id, cycleId)).limit(1);
  if (!cycle) return null;

  const events = await db.select().from(eventsTable)
    .where(eq(eventsTable.cycleId, cycleId))
    .orderBy(asc(eventsTable.startDate), asc(eventsTable.name));
  const ids = events.map(e => e.id);

  const [teamData, official, participants] = ids.length === 0
    ? [new Map(), [], []] as const
    : await Promise.all([
      loadEventTeamData(ids),
      db.select({ eventId: employeeEventResultsTable.eventId, score: employeeEventResultsTable.finalEventScore })
        .from(employeeEventResultsTable).where(inArray(employeeEventResultsTable.eventId, ids)),
      db.select({
        eventId: eventParticipantsTable.eventId,
        name: employeesTable.name,
        functionName: eventParticipantsTable.functionName,
        employeeFunction: employeesTable.functionName,
        employmentType: employeesTable.employmentType,
      }).from(eventParticipantsTable)
        .leftJoin(employeesTable, eq(eventParticipantsTable.employeeId, employeesTable.id))
        .where(inArray(eventParticipantsTable.eventId, ids))
        .orderBy(asc(employeesTable.name)),
    ]);

  const officialByEvent = new Map<number, number>();
  for (const o of official) if (!officialByEvent.has(o.eventId)) officialByEvent.set(o.eventId, pgNum(o.score));

  const rows: EventReportRow[] = events.map(ev => {
    const team = participants
      .filter(p => p.eventId === ev.id)
      .map(p => ({
        name: p.name ?? "—",
        functionName: p.functionName ?? p.employeeFunction ?? null,
        employmentType: p.employmentType ?? null,
        countsForScore: participantCountsForScore({ employmentType: p.employmentType, functionName: p.functionName, employeeFunction: p.employeeFunction }),
      }));

    if (ev.isHistorical) {
      // Evento importado sem avaliação por critério: a nota vem pronta.
      const imported = ev.importedScore != null ? pgNum(ev.importedScore) : null;
      return {
        id: ev.id, name: ev.name, clientName: ev.clientName, city: ev.city, state: ev.state,
        startDate: ev.startDate, endDate: ev.endDate, status: ev.status, resultsConfirmed: ev.resultsConfirmed, isHistorical: true,
        finalScore: ev.resultsConfirmed ? r2(officialByEvent.get(ev.id) ?? imported) : null,
        projectedScore: r2(imported), performanceScore: r2(imported), conformityPenalty: 0,
        calibratedCriteria: 0, evaluatedCriteria: 0, totalCriteria: 0, criteria: [], team,
      };
    }

    const result = computeEventTeamResultFromData(teamData.get(ev.id) ?? emptyEventTeamData<EventConformity>());
    return {
      id: ev.id, name: ev.name, clientName: ev.clientName, city: ev.city, state: ev.state,
      startDate: ev.startDate, endDate: ev.endDate, status: ev.status, resultsConfirmed: ev.resultsConfirmed, isHistorical: false,
      finalScore: ev.resultsConfirmed ? r2(officialByEvent.get(ev.id) ?? result.conformityScore) : null,
      projectedScore: result.totalCriteria > 0 ? r2(result.conformityScore) : null,
      performanceScore: result.totalCriteria > 0 ? r2(result.eventScore) : null,
      conformityPenalty: r2(result.conformityPenalty) ?? 0,
      calibratedCriteria: result.criteriaDetails.filter(c => c.calibratedScore !== null).length,
      evaluatedCriteria: result.evaluatedCriteria,
      totalCriteria: result.totalCriteria,
      criteria: result.criteriaDetails.map(c => ({
        name: c.criterionName, area: c.responsibleAreaLabel, weight: c.weight,
        evaluatorAvg: r2(c.averageScore), calibrated: r2(c.calibratedScore), used: r2(c.scoreUsed),
        calibrationReason: c.calibrationReason, status: c.status, active: c.active,
      })),
      team,
    };
  });

  return { cycle: { id: cycle.id, name: cycle.name, startDate: cycle.startDate, endDate: cycle.endDate }, events: rows };
}
