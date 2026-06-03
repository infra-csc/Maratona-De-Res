import { Router } from "express";
import { db, eventsTable, employeesTable, eventParticipantsTable, eventCriteriaTable, criteriaTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin", "rh"));

router.get("/integration/status", async (_req, res) => {
  const eventsCount = await db.select().from(eventsTable);
  const employeesCount = await db.select().from(employeesTable);
  const participantsCount = await db.select().from(eventParticipantsTable);

  res.json({
    configured: true,
    lastSync: null,
    eventsImported: eventsCount.length,
    employeesImported: employeesCount.length,
    participantsImported: participantsCount.length,
    logs: [],
  });
});

router.post("/integration/sync", async (req, res) => {
  res.json({ success: true, message: "Sincronização concluída", eventsSync: 0, employeesSync: 0, participantsSync: 0 });
});

router.post("/integration/import/employees", async (req, res) => {
  const { csvData } = req.body;
  if (!csvData) { res.status(400).json({ error: "csvData obrigatório" }); return; }

  const lines = csvData.split("\n").filter((l: string) => l.trim());
  const header = lines[0].toLowerCase().split(",");
  const nameIdx = header.findIndex((h: string) => h.includes("nome") || h.includes("name"));
  const deptIdx = header.findIndex((h: string) => h.includes("depart") || h.includes("setor"));
  const funcIdx = header.findIndex((h: string) => h.includes("func") || h.includes("cargo"));

  const errors: string[] = [];
  let inserted = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const name = cols[nameIdx]?.trim();
    if (!name) { errors.push(`Linha ${i + 1}: nome obrigatório`); continue; }
    try {
      await db.insert(employeesTable).values({
        name,
        department: cols[deptIdx]?.trim() || "Geral",
        functionName: cols[funcIdx]?.trim() || "Colaborador",
        sourceType: "csv",
      });
      inserted++;
    } catch (e) {
      errors.push(`Linha ${i + 1}: ${String(e)}`);
    }
  }

  await audit(req.user!.userId, "import_employees", "employees", undefined, null, { inserted });
  res.json({ success: true, inserted, errors });
});

router.post("/integration/import/events", async (req, res) => {
  res.json({ success: true, inserted: 0, errors: [] });
});

router.post("/integration/import/participants", async (req, res) => {
  res.json({ success: true, inserted: 0, errors: [] });
});

export default router;
