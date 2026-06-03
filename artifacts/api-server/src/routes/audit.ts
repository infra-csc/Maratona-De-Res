import { Router } from "express";
import { db, auditLogsTable, usersTable } from "@workspace/db";
import { eq, and, gte, lte, sql, type SQL } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin", "rh", "diretoria"));

router.get("/audit-logs", async (req, res) => {
  const { userId, entity, action, from, to, page = "1", limit = "50" } = req.query;
  const pageNum = parseInt(page as string);
  const limitNum = Math.min(parseInt(limit as string), 100);
  const offset = (pageNum - 1) * limitNum;

  const conditions: SQL[] = [];
  if (userId) conditions.push(eq(auditLogsTable.userId, parseInt(userId as string)));
  if (entity) conditions.push(eq(auditLogsTable.entity, entity as string));
  if (action) conditions.push(eq(auditLogsTable.action, action as string));
  if (from) conditions.push(gte(auditLogsTable.createdAt, new Date(from as string)));
  if (to) conditions.push(lte(auditLogsTable.createdAt, new Date(to as string)));
  const whereClause = conditions.length ? and(...conditions) : undefined;

  const logs = await db
    .select({
      id: auditLogsTable.id,
      userId: auditLogsTable.userId,
      userName: usersTable.name,
      action: auditLogsTable.action,
      entity: auditLogsTable.entity,
      entityId: auditLogsTable.entityId,
      beforeJson: auditLogsTable.beforeJson,
      afterJson: auditLogsTable.afterJson,
      createdAt: auditLogsTable.createdAt,
    })
    .from(auditLogsTable)
    .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
    .where(whereClause)
    .orderBy(sql`${auditLogsTable.createdAt} DESC`)
    .limit(limitNum)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogsTable)
    .where(whereClause);
  const total = Number(countResult[0]?.count ?? 0);

  res.json({ data: logs, total, page: pageNum, limit: limitNum });
});

export default router;
