import { Router } from "express";
import { db, eventsTable, employeesTable, eventParticipantsTable, criteriaTable, eventCriteriaTable } from "@workspace/db";
import { isNotNull, inArray, eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin", "rh"));

const EXTERNAL_API_URL = process.env.EXTERNAL_API_URL;
const EXTERNAL_API_TOKEN = process.env.EXTERNAL_API_TOKEN;

let lastSyncAt: string | null = null;
let lastLogs: string[] = [];
let syncing = false;

function isConfigured() {
  return !!(EXTERNAL_API_URL && EXTERNAL_API_TOKEN);
}

async function extFetch<T>(path: string): Promise<T> {
  const base = (EXTERNAL_API_URL ?? "").replace(/\/+$/, "");
  const r = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${EXTERNAL_API_TOKEN}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ao acessar ${path}`);
  return r.json() as Promise<T>;
}

function normalizeDate(s?: string): string {
  if (s) { const d = new Date(s); if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10); }
  return new Date().toISOString().slice(0, 10);
}

function deriveYearQuarter(dateStr?: string) {
  const parsed = dateStr ? new Date(dateStr) : new Date();
  const d = isNaN(parsed.getTime()) ? new Date() : parsed;
  return { year: d.getUTCFullYear(), quarter: Math.ceil((d.getUTCMonth() + 1) / 3) };
}

// Ano do programa da Maratona: só importamos eventos deste ano.
const TARGET_YEAR = 2026;
// Apenas estas funções são relevantes para a Maratona.
const ALLOWED_FUNCTIONS = new Set(["cenotecnica", "cenotecnica local"]);
function normalizeFunction(s?: string): string {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}
function isAllowedFunction(s?: string): boolean {
  return ALLOWED_FUNCTIONS.has(normalizeFunction(s));
}
function extIdOf(o: { externalId?: string | number; id?: string | number }): string | null {
  return o.externalId != null ? String(o.externalId) : (o.id != null ? String(o.id) : null);
}

type ExtEmployee = {
  externalId?: string | number; id?: string | number; name: string;
  document?: string; email?: string; phone?: string;
  department?: string; functionName?: string; function?: string; active?: boolean;
};
type ExtEvent = {
  externalId?: string | number; id?: string | number; name: string;
  clientName?: string; client?: string; location?: string; city?: string; state?: string;
  startDate?: string; endDate?: string; year?: number; quarter?: number;
};
type ExtParticipation = {
  eventExternalId?: string | number; eventId?: string | number;
  employeeExternalId?: string | number; employeeId?: string | number;
  functionName?: string; function?: string; teamName?: string; team?: string; confirmed?: boolean;
};

router.get("/integration/status", async (_req, res) => {
  const [eventsCount, employeesCount, participantsCount] = await Promise.all([
    db.select().from(eventsTable),
    db.select().from(employeesTable),
    db.select().from(eventParticipantsTable),
  ]);

  res.json({
    configured: isConfigured(),
    lastSync: lastSyncAt,
    eventsImported: eventsCount.length,
    employeesImported: employeesCount.length,
    participantsImported: participantsCount.length,
    logs: lastLogs,
  });
});

router.post("/integration/sync", async (req, res) => {
  if (!isConfigured()) {
    res.status(400).json({
      success: false,
      message: "Integração não configurada. Defina EXTERNAL_API_URL e EXTERNAL_API_TOKEN.",
      eventsSync: 0, employeesSync: 0, participantsSync: 0,
    });
    return;
  }

  if (syncing) {
    res.status(409).json({
      success: false,
      message: "Sincronização já em andamento. Aguarde a conclusão.",
      eventsSync: 0, employeesSync: 0, participantsSync: 0,
    });
    return;
  }

  const logs: string[] = [];
  const log = (m: string) => logs.push(m);
  let employeesSync = 0, eventsSync = 0, participantsSync = 0;
  syncing = true;

  try {
    log(`Conectando em ${EXTERNAL_API_URL} ...`);
    const [rawEmployees, rawEvents, rawParticipations] = await Promise.all([
      extFetch<unknown>("/api/integration/employees"),
      extFetch<unknown>("/api/integration/events"),
      extFetch<unknown>("/api/integration/participations"),
    ]);

    if (!Array.isArray(rawEmployees)) throw new Error("Resposta inválida em /employees (esperado um array).");
    if (!Array.isArray(rawEvents)) throw new Error("Resposta inválida em /events (esperado um array).");
    if (!Array.isArray(rawParticipations)) throw new Error("Resposta inválida em /participations (esperado um array).");

    const extEmployees = rawEmployees as ExtEmployee[];
    const extEvents = rawEvents as ExtEvent[];
    const extParticipations = rawParticipations as ExtParticipation[];
    log(`Recebidos: ${extEmployees.length} colaboradores, ${extEvents.length} eventos, ${extParticipations.length} participações.`);

    // 1) Eventos de TARGET_YEAR que JÁ FINALIZARAM (data de término no passado).
    //    Só importamos eventos encerrados: com o evento concluído, a escalação de
    //    funções não muda mais, então os dados importados são definitivos.
    const today = new Date().toISOString().slice(0, 10);
    const allYearEvents = extEvents.filter(ev => {
      const yq = deriveYearQuarter(ev.startDate);
      return (ev.year ?? yq.year) === TARGET_YEAR;
    });
    const keptEvents = allYearEvents.filter(ev => {
      const end = ev.endDate ? normalizeDate(ev.endDate) : normalizeDate(ev.startDate);
      return end < today;
    });
    const keptEventIds = new Set(keptEvents.map(ev => extIdOf(ev)).filter((v): v is string => !!v));

    // 2) Participações nesses eventos com função Cenotécnica / Cenotécnica Local.
    const keptParticipations = extParticipations.filter(p => {
      if (!isAllowedFunction(p.functionName ?? p.function)) return false;
      const evExt = p.eventExternalId != null ? String(p.eventExternalId) : (p.eventId != null ? String(p.eventId) : null);
      return evExt != null && keptEventIds.has(evExt);
    });

    // 3) Colaboradores que participaram dessas participações.
    const neededEmpIds = new Set(
      keptParticipations
        .map(p => (p.employeeExternalId != null ? String(p.employeeExternalId) : (p.employeeId != null ? String(p.employeeId) : null)))
        .filter((v): v is string => !!v)
    );
    const keptEmployees = extEmployees.filter(e => {
      const id = extIdOf(e);
      return id != null && neededEmpIds.has(id);
    });
    log(`Filtro: eventos ${TARGET_YEAR} finalizados (${keptEvents.length}/${allYearEvents.length} de ${TARGET_YEAR}; demais ainda não terminaram), participações Cenotécnica/Cenotécnica Local (${keptParticipations.length}/${extParticipations.length}), colaboradores participantes (${keptEmployees.length}/${extEmployees.length}).`);

    await db.transaction(async (tx) => {
      // Colaboradores — upsert por externalId
      for (const e of keptEmployees) {
        const externalId = e.externalId != null ? String(e.externalId) : (e.id != null ? String(e.id) : null);
        if (!externalId || !e.name) continue;
        const fields = {
          name: e.name,
          document: e.document ?? null,
          email: e.email ?? null,
          phone: e.phone ?? null,
          department: e.department || "Geral",
          functionName: e.functionName || e.function || "Colaborador",
          active: e.active ?? true,
        };
        await tx.insert(employeesTable)
          .values({ externalId, sourceType: "erp", ...fields })
          .onConflictDoUpdate({ target: employeesTable.externalId, set: fields });
        employeesSync++;
      }

      // Eventos — upsert por externalId
      for (const ev of keptEvents) {
        const externalId = ev.externalId != null ? String(ev.externalId) : (ev.id != null ? String(ev.id) : null);
        if (!externalId || !ev.name) continue;
        const startDate = normalizeDate(ev.startDate);
        const endDate = ev.endDate ? normalizeDate(ev.endDate) : startDate;
        const yq = deriveYearQuarter(ev.startDate);
        const fields = {
          name: ev.name,
          clientName: ev.clientName ?? ev.client ?? null,
          location: ev.location ?? null,
          city: ev.city ?? null,
          state: ev.state ?? null,
          startDate,
          endDate,
          year: ev.year ?? yq.year,
          quarter: ev.quarter ?? yq.quarter,
        };
        await tx.insert(eventsTable)
          .values({ externalId, ...fields })
          .onConflictDoUpdate({ target: eventsTable.externalId, set: fields });
        eventsSync++;
      }

      // Mapas externalId -> id local
      const allEmployees = await tx.select().from(employeesTable).where(isNotNull(employeesTable.externalId));
      const empMap = new Map(allEmployees.map(e => [e.externalId!, e.id]));
      const allEvents = await tx.select().from(eventsTable).where(isNotNull(eventsTable.externalId));
      const evMap = new Map(allEvents.map(e => [e.externalId!, e.id]));

      // Participações — upsert por (eventId, employeeId)
      for (const p of keptParticipations) {
        const evExt = p.eventExternalId != null ? String(p.eventExternalId) : (p.eventId != null ? String(p.eventId) : null);
        const empExt = p.employeeExternalId != null ? String(p.employeeExternalId) : (p.employeeId != null ? String(p.employeeId) : null);
        if (!evExt || !empExt) continue;
        const eventId = evMap.get(evExt);
        const employeeId = empMap.get(empExt);
        if (!eventId || !employeeId) {
          log(`Participação ignorada (evento "${evExt}" ou colaborador "${empExt}" não encontrado).`);
          continue;
        }
        const fields = {
          functionName: p.functionName ?? p.function ?? null,
          teamName: p.teamName ?? p.team ?? null,
          confirmed: p.confirmed ?? true,
        };
        await tx.insert(eventParticipantsTable)
          .values({ eventId, employeeId, ...fields })
          .onConflictDoUpdate({
            target: [eventParticipantsTable.eventId, eventParticipantsTable.employeeId],
            set: fields,
          });
        participantsSync++;
      }

      // Vincular os critérios padrão aos eventos sincronizados (igual à criação
      // manual de evento). Só anexa em eventos que ainda não têm critérios — assim
      // a re-sincronização não sobrescreve a configuração feita pelo RH.
      const syncedEventIds = Array.from(evMap.values());
      if (syncedEventIds.length > 0) {
        const activeCriteria = await tx.select().from(criteriaTable).where(eq(criteriaTable.active, true));
        if (activeCriteria.length > 0) {
          const withCriteria = await tx
            .select({ eventId: eventCriteriaTable.eventId })
            .from(eventCriteriaTable)
            .where(inArray(eventCriteriaTable.eventId, syncedEventIds));
          const alreadyConfigured = new Set(withCriteria.map(r => r.eventId));
          const toSeed = syncedEventIds.filter(id => !alreadyConfigured.has(id));
          if (toSeed.length > 0) {
            await tx.insert(eventCriteriaTable).values(
              toSeed.flatMap(eventId =>
                activeCriteria.map(c => ({ eventId, criterionId: c.id, active: true })),
              ),
            );
            log(`Critérios padrão vinculados a ${toSeed.length} novo(s) evento(s).`);
          }
        }
      }
    });

    const message = `Sincronização concluída: ${employeesSync} colaboradores, ${eventsSync} eventos, ${participantsSync} participações.`;
    log(message);
    lastSyncAt = new Date().toISOString();
    lastLogs = logs;
    await audit(req.user!.userId, "sync_integration", "integration", undefined, null, { employeesSync, eventsSync, participantsSync });
    res.json({ success: true, message, eventsSync, employeesSync, participantsSync });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`ERRO: ${msg}`);
    lastSyncAt = new Date().toISOString();
    lastLogs = logs;
    res.status(502).json({
      success: false,
      message: `Falha na sincronização: ${msg}`,
      eventsSync, employeesSync, participantsSync,
    });
  } finally {
    syncing = false;
  }
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

router.post("/integration/import/events", async (_req, res) => {
  res.json({ success: true, inserted: 0, errors: [] });
});

router.post("/integration/import/participants", async (_req, res) => {
  res.json({ success: true, inserted: 0, errors: [] });
});

export default router;
