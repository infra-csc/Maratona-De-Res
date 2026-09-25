import { Router } from "express";
import { db, auditLogsTable, usersTable, eventsTable, employeesTable, criteriaTable, cyclesTable, areasTable } from "@workspace/db";
import { eq, and, gte, lte, inArray, sql, aliasedTable, type SQL } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { redact, parseAuditJson, collectRefs, emptyRefSets, refKindForEntity, type RefKind } from "../lib/audit-view.js";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin", "rh"));

const DAY = /^\d{4}-\d{2}-\d{2}$/;

router.get("/audit-logs", async (req, res) => {
  const { userId, entity, action, from, to, page = "1", limit = "50" } = req.query;
  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(Math.max(1, parseInt(limit as string) || 50), 100);
  const offset = (pageNum - 1) * limitNum;

  const conditions: SQL[] = [];
  if (userId) conditions.push(eq(auditLogsTable.userId, parseInt(userId as string)));
  // `entity` aceita lista separada por vírgula (os grupos da tela: "Eventos"
  // cobre events, event_criteria, atribuições e links públicos).
  if (entity) {
    const list = String(entity).split(",").map(s => s.trim()).filter(Boolean);
    if (list.length === 1) conditions.push(eq(auditLogsTable.entity, list[0]));
    else if (list.length > 1) conditions.push(inArray(auditLogsTable.entity, list));
  }
  if (action) conditions.push(eq(auditLogsTable.action, action as string));
  // Datas puras (AAAA-MM-DD) valem o dia inteiro em horário de Brasília; o
  // banco guarda UTC.
  if (from) conditions.push(gte(auditLogsTable.createdAt, new Date(DAY.test(String(from)) ? `${from}T00:00:00-03:00` : String(from))));
  if (to) conditions.push(lte(auditLogsTable.createdAt, new Date(DAY.test(String(to)) ? `${to}T23:59:59.999-03:00` : String(to))));
  const whereClause = conditions.length ? and(...conditions) : undefined;

  const impersonator = aliasedTable(usersTable, "impersonator");
  const logs = await db
    .select({
      id: auditLogsTable.id,
      userId: auditLogsTable.userId,
      userName: usersTable.name,
      impersonatorName: impersonator.name,
      action: auditLogsTable.action,
      entity: auditLogsTable.entity,
      entityId: auditLogsTable.entityId,
      beforeJson: auditLogsTable.beforeJson,
      afterJson: auditLogsTable.afterJson,
      createdAt: auditLogsTable.createdAt,
    })
    .from(auditLogsTable)
    .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
    .leftJoin(impersonator, eq(auditLogsTable.impersonatorUserId, impersonator.id))
    .where(whereClause)
    .orderBy(sql`${auditLogsTable.createdAt} DESC, ${auditLogsTable.id} DESC`)
    .limit(limitNum)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogsTable)
    .where(whereClause);
  const total = Number(countResult[0]?.count ?? 0);

  // Segredos saem antes de qualquer coisa; depois, os IDs citados (no registro
  // e dentro do antes/depois) viram nomes numa consulta por tipo.
  const rows = logs.map(l => {
    const before = redact(parseAuditJson(l.beforeJson));
    const after = redact(parseAuditJson(l.afterJson));
    return { ...l, before, after };
  });
  const ids = emptyRefSets();
  collectRefs(rows.flatMap(r => [r.before, r.after]), ids);
  for (const r of rows) {
    const kind = refKindForEntity(r.entity);
    const n = r.entityId != null && /^\d+$/.test(r.entityId) ? Number(r.entityId) : NaN;
    if (kind && Number.isInteger(n) && n > 0) ids[kind].add(n);
  }
  const refs = await resolveRefs(ids);

  res.json({
    data: rows.map(({ before, after, ...r }) => {
      const kind = refKindForEntity(r.entity);
      return {
        ...r,
        beforeJson: before == null ? null : JSON.stringify(before),
        afterJson: after == null ? null : JSON.stringify(after),
        entityLabel: kind && r.entityId ? (refs[kind][r.entityId] ?? null) : null,
      };
    }),
    total,
    page: pageNum,
    limit: limitNum,
    refs,
  });
});

async function resolveRefs(ids: Record<RefKind, Set<number>>): Promise<Record<RefKind, Record<string, string>>> {
  const load = async (kind: RefKind, table: typeof usersTable | typeof eventsTable | typeof employeesTable | typeof criteriaTable | typeof cyclesTable | typeof areasTable) => {
    const list = [...ids[kind]];
    if (list.length === 0) return {} as Record<string, string>;
    const rows = await db.select({ id: table.id, name: table.name }).from(table).where(inArray(table.id, list));
    return Object.fromEntries(rows.map(r => [String(r.id), r.name ?? `#${r.id}`]));
  };
  const [users, events, employees, criteria, cycles, areas] = await Promise.all([
    load("users", usersTable), load("events", eventsTable), load("employees", employeesTable),
    load("criteria", criteriaTable), load("cycles", cyclesTable), load("areas", areasTable),
  ]);
  return { users, events, employees, criteria, cycles, areas };
}

export default router;
