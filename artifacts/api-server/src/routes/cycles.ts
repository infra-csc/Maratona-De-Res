import { Router } from "express";
import { requireAuth, requireRole } from "../lib/auth.js";
import { getCurrentCycle } from "../lib/cycle.js";
import { validateCycleFields } from "../lib/cycle-rules.js";
import {
  db, cyclesTable, eventsTable, quarterlyResultsTable, employeesTable, eventParticipantsTable,
  type Cycle,
} from "@workspace/db";
import { and, desc, eq, exists, inArray, ne, sql, type SQL } from "drizzle-orm";
import { audit } from "../lib/audit.js";

/**
 * Cadastro e histórico de ciclos.
 *
 * Ciclos NUNCA são excluídos (não existe DELETE): cada ciclo guarda seus
 * eventos, resultados (quarterly_results) e bônus por cycleId, e é isso que
 * forma o histórico. Só existe um ciclo atual por vez (isCurrent); é nele que
 * entram eventos novos, avaliações, sincronização e o "Fechar Ciclo".
 */
const router = Router();
router.use(requireAuth);

const MANAGERS = ["admin", "rh", "diretoria"] as const;
// Chave fixa do advisory lock que serializa "quem é o ciclo atual".
const CURRENT_CYCLE_LOCK = 734_120_001;

function toCycle(c: Cycle) {
  return {
    id: c.id,
    name: c.name,
    startDate: c.startDate,
    endDate: c.endDate,
    status: c.status,
    isCurrent: c.isCurrent,
    closedAt: c.closedAt ? c.closedAt.toISOString() : null,
    createdAt: c.createdAt ? c.createdAt.toISOString() : null,
  };
}

const num = (v: string | number | null | undefined) => (v == null ? 0 : typeof v === "number" ? v : parseFloat(v) || 0);
const numOrNull = (v: string | number | null | undefined) => (v == null ? null : Math.round(num(v) * 100) / 100);

/**
 * Mesmo recorte do ranking (routes/ranking.ts): só colaborador da casa, fora
 * "Sup Ceno *" e com participação que conta nota em algum evento do ciclo.
 * Diferença proposital: NÃO filtra employees.active, porque o histórico
 * precisa mostrar quem participou mesmo que já tenha sido desligado.
 */
function rankingScope(): SQL {
  return and(
    eq(employeesTable.employmentType, "casa"),
    sql`(${employeesTable.functionName} IS NULL OR ${employeesTable.functionName} NOT ILIKE 'sup ceno%')`,
    exists(
      db.select({ one: sql`1` })
        .from(eventParticipantsTable)
        .innerJoin(eventsTable, eq(eventParticipantsTable.eventId, eventsTable.id))
        .where(and(
          eq(eventParticipantsTable.employeeId, employeesTable.id),
          eq(eventsTable.cycleId, quarterlyResultsTable.cycleId),
          sql`(${eventParticipantsTable.functionName} IS NULL OR ${eventParticipantsTable.functionName} NOT ILIKE 'sup ceno%')`,
        )),
    ),
  )!;
}

async function loadCycleStats(cycleIds: number[]) {
  const empty = {
    eventsTotal: 0, eventsConfirmed: 0, eventsOpen: 0, firstEventDate: null as string | null, lastEventDate: null as string | null,
    collaborators: 0, eligible: 0, withBonus: 0, bonusTotal: 0, bonusPaid: 0, avgFinalResult: null as number | null,
  };
  const stats = new Map<number, typeof empty>(cycleIds.map(id => [id, { ...empty }]));
  if (cycleIds.length === 0) return stats;

  const [eventRows, resultRows] = await Promise.all([
    db.select({
      cycleId: eventsTable.cycleId,
      total: sql<number>`count(*)::int`,
      confirmed: sql<number>`(count(*) filter (where ${eventsTable.resultsConfirmed}))::int`,
      open: sql<number>`(count(*) filter (where ${eventsTable.status} = 'open'))::int`,
      first: sql<string | null>`min(${eventsTable.startDate})::text`,
      last: sql<string | null>`max(${eventsTable.endDate})::text`,
    }).from(eventsTable)
      .where(inArray(eventsTable.cycleId, cycleIds))
      .groupBy(eventsTable.cycleId),
    db.select({
      cycleId: quarterlyResultsTable.cycleId,
      collaborators: sql<number>`count(*)::int`,
      eligible: sql<number>`(count(*) filter (where ${quarterlyResultsTable.eligible}))::int`,
      withBonus: sql<number>`(count(*) filter (where ${quarterlyResultsTable.eligible} and ${quarterlyResultsTable.bonusValue} > 0))::int`,
      bonusTotal: sql<string>`coalesce(sum(case when ${quarterlyResultsTable.eligible} then ${quarterlyResultsTable.bonusValue} else 0 end), 0)::text`,
      bonusPaid: sql<string>`coalesce(sum(case when ${quarterlyResultsTable.bonusStatus} = 'paid' then ${quarterlyResultsTable.bonusValue} else 0 end), 0)::text`,
      avgFinal: sql<string | null>`(avg(${quarterlyResultsTable.finalResult}) filter (where ${quarterlyResultsTable.eventsCount} > 0))::text`,
    }).from(quarterlyResultsTable)
      .innerJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
      .where(and(inArray(quarterlyResultsTable.cycleId, cycleIds), rankingScope()))
      .groupBy(quarterlyResultsTable.cycleId),
  ]);

  for (const r of eventRows) {
    const s = stats.get(r.cycleId);
    if (!s) continue;
    s.eventsTotal = r.total;
    s.eventsConfirmed = r.confirmed;
    s.eventsOpen = r.open;
    s.firstEventDate = r.first;
    s.lastEventDate = r.last;
  }
  for (const r of resultRows) {
    const s = stats.get(r.cycleId);
    if (!s) continue;
    s.collaborators = r.collaborators;
    s.eligible = r.eligible;
    s.withBonus = r.withBonus;
    s.bonusTotal = num(r.bonusTotal);
    s.bonusPaid = num(r.bonusPaid);
    s.avgFinalResult = numOrNull(r.avgFinal);
  }
  return stats;
}

function parseCycleId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Ciclo atual (período de referência). Usado em qualquer tela que mostra
// informação do ciclo, para exibir as datas que o ciclo está considerando.
router.get("/cycles/current", async (_req, res) => {
  const cycle = await getCurrentCycle();
  if (!cycle) { res.status(404).json({ error: "Nenhum ciclo ativo" }); return; }
  res.json(toCycle(cycle));
});

// Todos os ciclos, do mais recente ao mais antigo, com os números de cada um.
router.get("/cycles", requireRole(...MANAGERS), async (_req, res) => {
  const cycles = await db.select().from(cyclesTable).orderBy(desc(cyclesTable.isCurrent), sql`${cyclesTable.startDate} DESC NULLS LAST`, desc(cyclesTable.id));
  const stats = await loadCycleStats(cycles.map(c => c.id));
  res.json(cycles.map(c => ({ ...toCycle(c), stats: stats.get(c.id)! })));
});

// Histórico de um ciclo: números, ranking final (snapshot de quarterly_results)
// e eventos. Somente leitura; vale para o ciclo atual e para os anteriores.
router.get("/cycles/:id/history", requireRole(...MANAGERS), async (req, res) => {
  const id = parseCycleId(req.params.id);
  if (!id) { res.status(400).json({ error: "Ciclo inválido" }); return; }
  const [cycle] = await db.select().from(cyclesTable).where(eq(cyclesTable.id, id)).limit(1);
  if (!cycle) { res.status(404).json({ error: "Ciclo não encontrado" }); return; }

  const [stats, rows, events] = await Promise.all([
    loadCycleStats([id]),
    db.select({
      employeeId: quarterlyResultsTable.employeeId,
      employeeName: employeesTable.name,
      employeeActive: employeesTable.active,
      finalResult: quarterlyResultsTable.finalResult,
      platoon: quarterlyResultsTable.platoon,
      platoonColor: quarterlyResultsTable.platoonColor,
      bonusValue: quarterlyResultsTable.bonusValue,
      extraBonusValue: quarterlyResultsTable.extraBonusValue,
      eligible: quarterlyResultsTable.eligible,
      eligibilityReason: quarterlyResultsTable.eligibilityReason,
      eventsCount: quarterlyResultsTable.eventsCount,
      participatedEventsCount: quarterlyResultsTable.participatedEventsCount,
      totalAbsences: quarterlyResultsTable.totalAbsences,
      bonusStatus: quarterlyResultsTable.bonusStatus,
      paidAt: quarterlyResultsTable.paidAt,
    }).from(quarterlyResultsTable)
      .innerJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
      .where(and(eq(quarterlyResultsTable.cycleId, id), rankingScope()))
      .orderBy(sql`${quarterlyResultsTable.finalResult} DESC`, employeesTable.name),
    db.select({
      id: eventsTable.id,
      name: eventsTable.name,
      clientName: eventsTable.clientName,
      city: eventsTable.city,
      state: eventsTable.state,
      startDate: eventsTable.startDate,
      endDate: eventsTable.endDate,
      status: eventsTable.status,
      resultsConfirmed: eventsTable.resultsConfirmed,
      isHistorical: eventsTable.isHistorical,
    }).from(eventsTable)
      .where(eq(eventsTable.cycleId, id))
      .orderBy(desc(eventsTable.startDate), eventsTable.name),
  ]);

  res.json({
    cycle: { ...toCycle(cycle), stats: stats.get(id)! },
    ranking: rows.map((r, i) => {
      const eligible = r.eligible;
      return {
        position: i + 1,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        employeeActive: r.employeeActive,
        finalResult: num(r.finalResult),
        platoon: r.platoon,
        platoonColor: r.platoonColor,
        bonusValue: eligible ? num(r.bonusValue) : 0,
        extraBonusValue: eligible ? num(r.extraBonusValue) : 0,
        eligible,
        eligibilityReason: r.eligibilityReason,
        eventsCount: r.eventsCount,
        participatedEventsCount: r.participatedEventsCount,
        totalAbsences: r.totalAbsences,
        bonusStatus: r.bonusStatus,
        paidAt: r.paidAt ? r.paidAt.toISOString() : null,
      };
    }),
    events,
  });
});

// Cria um novo ciclo e o marca como atual (só existe um ciclo corrente por vez).
// O ciclo atual precisa estar fechado antes (se tiver eventos): depois que
// outro ciclo vira o atual, o "Fechar Ciclo" não alcança mais o anterior e os
// resultados dele ficariam sem o fechamento oficial no histórico.
router.post("/cycles", requireRole("admin"), async (req, res) => {
  const { name, startDate, endDate } = req.body ?? {};
  const fields = { name: String(name ?? ""), startDate: String(startDate ?? ""), endDate: String(endDate ?? "") };

  const all = await db.select().from(cyclesTable);
  const error = validateCycleFields(fields, all);
  if (error) { res.status(400).json({ error }); return; }

  const current = await getCurrentCycle();
  if (current && current.status !== "closed") {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(eventsTable).where(eq(eventsTable.cycleId, current.id));
    if (count > 0) {
      res.status(409).json({
        error: `O ciclo atual "${current.name}" ainda está aberto, com ${count} evento(s). Feche-o em Resultados & Ranking (botão "Fechar Ciclo") antes de criar o próximo, para os resultados dele ficarem guardados no histórico.`,
        requiresClose: true,
      });
      return;
    }
  }

  const cycle = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${CURRENT_CYCLE_LOCK})`);
    await tx.update(cyclesTable).set({ isCurrent: false }).where(eq(cyclesTable.isCurrent, true));
    const [created] = await tx.insert(cyclesTable).values({
      name: fields.name.trim(), startDate: fields.startDate, endDate: fields.endDate, status: "open", isCurrent: true,
    }).returning();
    return created;
  });

  await audit(req.user!.userId, "create", "cycles", cycle.id, current ? { previousCurrentId: current.id } : null, cycle);
  res.status(201).json(toCycle(cycle));
});

// Edita nome e período. Ciclo fechado só troca o nome: o período dele já
// gerou resultados oficiais e é referência do histórico.
router.patch("/cycles/:id", requireRole("admin"), async (req, res) => {
  const id = parseCycleId(req.params.id);
  if (!id) { res.status(400).json({ error: "Ciclo inválido" }); return; }
  const [cycle] = await db.select().from(cyclesTable).where(eq(cyclesTable.id, id)).limit(1);
  if (!cycle) { res.status(404).json({ error: "Ciclo não encontrado" }); return; }

  const body = req.body ?? {};
  const next = {
    name: body.name !== undefined ? String(body.name) : cycle.name,
    startDate: body.startDate !== undefined ? String(body.startDate) : (cycle.startDate ?? ""),
    endDate: body.endDate !== undefined ? String(body.endDate) : (cycle.endDate ?? ""),
  };
  const datesChanged = next.startDate !== (cycle.startDate ?? "") || next.endDate !== (cycle.endDate ?? "");
  if (cycle.status === "closed" && datesChanged) {
    res.status(409).json({ error: "Ciclo fechado: o período não pode mais ser alterado, só o nome." });
    return;
  }

  const others = await db.select().from(cyclesTable).where(ne(cyclesTable.id, id));
  const error = validateCycleFields(next, others);
  if (error) { res.status(400).json({ error }); return; }

  const [updated] = await db.update(cyclesTable)
    .set({ name: next.name.trim(), startDate: next.startDate, endDate: next.endDate })
    .where(eq(cyclesTable.id, id))
    .returning();
  await audit(req.user!.userId, "update", "cycles", id, cycle, updated);
  res.json(toCycle(updated));
});

// Torna um ciclo ABERTO o atual (ex.: criaram o próximo por engano, ou é
// preciso voltar a um ciclo anterior para fechá-lo). Ciclo fechado não volta
// a ser atual: isso reabriria resultados oficiais já fechados.
router.post("/cycles/:id/set-current", requireRole("admin"), async (req, res) => {
  const id = parseCycleId(req.params.id);
  if (!id) { res.status(400).json({ error: "Ciclo inválido" }); return; }
  const [cycle] = await db.select().from(cyclesTable).where(eq(cyclesTable.id, id)).limit(1);
  if (!cycle) { res.status(404).json({ error: "Ciclo não encontrado" }); return; }
  if (cycle.status === "closed") {
    res.status(409).json({ error: "Ciclo fechado não pode voltar a ser o atual. O histórico dele continua disponível para consulta." });
    return;
  }
  if (cycle.isCurrent) { res.json(toCycle(cycle)); return; }

  const previous = await getCurrentCycle();
  const updated = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${CURRENT_CYCLE_LOCK})`);
    await tx.update(cyclesTable).set({ isCurrent: false }).where(eq(cyclesTable.isCurrent, true));
    const [row] = await tx.update(cyclesTable).set({ isCurrent: true }).where(eq(cyclesTable.id, id)).returning();
    return row;
  });
  await audit(req.user!.userId, "set_current", "cycles", id, previous ? { previousCurrentId: previous.id } : null, updated);
  res.json(toCycle(updated));
});

export default router;
