import { Router } from "express";
import { db, quarterlyResultsTable, employeesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/ranking", async (req, res) => {
  const { year, quarter, search } = req.query;
  if (!year || !quarter) { res.status(400).json({ error: "year e quarter obrigatórios" }); return; }

  const results = await db
    .select({
      employeeId: quarterlyResultsTable.employeeId,
      employeeName: employeesTable.name,
      finalResult: quarterlyResultsTable.finalResult,
      platoon: quarterlyResultsTable.platoon,
      platoonColor: quarterlyResultsTable.platoonColor,
      bonusValue: quarterlyResultsTable.bonusValue,
      eventsCount: quarterlyResultsTable.eventsCount,
      totalAbsences: quarterlyResultsTable.totalAbsences,
    })
    .from(quarterlyResultsTable)
    .leftJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
    .where(and(
      eq(quarterlyResultsTable.year, parseInt(year as string)),
      eq(quarterlyResultsTable.quarter, parseInt(quarter as string)),
    ))
    .orderBy(sql`${quarterlyResultsTable.finalResult} DESC`);

  let filtered = results;
  if (search) {
    const s = (search as string).toLowerCase();
    filtered = results.filter(r => (r.employeeName ?? "").toLowerCase().includes(s));
  }

  res.json(filtered.map((r, i) => ({
    position: i + 1,
    employeeId: r.employeeId,
    employeeName: r.employeeName ?? "",
    finalResult: parseFloat(r.finalResult),
    platoon: r.platoon,
    platoonColor: r.platoonColor,
    bonusValue: parseFloat(r.bonusValue),
    eventsCount: r.eventsCount,
    absences: r.totalAbsences,
  })));
});

export default router;
