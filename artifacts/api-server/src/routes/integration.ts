import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import {
  db, eventsTable, employeesTable, eventParticipantsTable, criteriaTable, eventCriteriaTable,
  usersTable, absencesTable, quarterlyResultsTable, employeeCycleEligibilityTable, auditLogsTable,
  cyclesTable, areasTable, eventAreaAssignmentsTable, eventConformitiesTable, evaluationsTable,
} from "@workspace/db";
import { isNotNull, inArray, eq, and, ne } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import { getCurrentCycle } from "../lib/cycle.js";
import { recomputeCycleResults } from "./results.js";
import { isSyncableFunction } from "../lib/participation.js";

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
// Apenas estas funções são relevantes para a Maratona: as avaliadas
// (Cenotécnica/Cenotécnico, incluindo variantes como SP/SP1/SP2/Local) e as
// informativas "Sup Ceno *" (ver lib/participation.ts — participam mas nunca
// contam para nota).
function isAllowedFunction(s?: string): boolean {
  return isSyncableFunction(s);
}
function extIdOf(o: { externalId?: string | number; id?: string | number }): string | null {
  return o.externalId != null ? String(o.externalId) : (o.id != null ? String(o.id) : null);
}

type ExtEmployee = {
  externalId?: string | number; id?: string | number; name: string;
  document?: string; email?: string; phone?: string;
  department?: string; functionName?: string; function?: string; active?: boolean;
  // Tipo de vínculo (Freela/Casa) — ainda não exposto pelo Logística Interna hoje;
  // mapeado tolerantemente assim que o campo existir (ver normalizeEmploymentType).
  employmentType?: string; tipo?: string; type?: string;
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
  // Diária prevista (aba Escalação) — ainda não exposta pelo Logística Interna
  // hoje; mapeada tolerantemente assim que os campos existirem.
  diariaCount?: number; diariaStartDate?: string; diariaEndDate?: string;
};

// Normaliza o campo de tipo de vínculo vindo do Logística Interna para o
// domínio interno "freela" | "casa". Retorna undefined quando o campo ainda
// não vem preenchido (o app externo não expõe isso hoje) para nunca
// sobrescrever silenciosamente um valor já corrigido manualmente na Maratona.
function normalizeEmploymentType(raw?: string): "freela" | "casa" | undefined {
  if (!raw) return undefined;
  const s = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  if (!s) return undefined;
  if (s.includes("freela") || s.includes("externo")) return "freela";
  if (s.includes("casa") || s.includes("interno") || s.includes("funcionario") || s.includes("clt")) return "casa";
  return undefined;
}

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

const RESET_CONFIRM_PHRASE = "ZERAR TUDO";

// Apaga os dados operacionais de produção — eventos (e tudo que depende deles:
// participantes, critérios do evento, atribuições, avaliações/notas,
// calibrações, conformidade, resultados por evento), colaboradores e usuários
// (menos o próprio admin que disparou a ação, para que ele continue logado e
// possa recomeçar o cadastro do zero). NÃO apaga configuração/catálogo: áreas,
// critérios (quesitos), ciclo atual, regras e pelotões permanecem intactos —
// só o dado operacional/transacional sai. Ação destrutiva e irreversível — por
// isso exige role admin (não admin+rh, mais restrito que o padrão do router) e
// uma frase de confirmação exata digitada pelo usuário.
router.post("/integration/reset", requireRole("admin"), async (req, res) => {
  const { confirm } = req.body ?? {};
  if (confirm !== RESET_CONFIRM_PHRASE) {
    res.status(400).json({
      success: false,
      message: `Confirmação inválida. Digite exatamente "${RESET_CONFIRM_PHRASE}" para prosseguir.`,
    });
    return;
  }

  if (syncing) {
    res.status(409).json({
      success: false,
      message: "Sincronização em andamento. Aguarde a conclusão antes de resetar os dados.",
    });
    return;
  }

  const callerId = req.user!.userId;

  try {
    await db.transaction(async (tx) => {
      // Libera a FK employee_id do próprio admin ANTES de apagar employees
      // (areaId não precisa: areas não são apagadas nesse reset).
      await tx.update(usersTable).set({ employeeId: null }).where(eq(usersTable.id, callerId));

      // Ausências e resultados trimestrais referenciam employeeId sem cascade —
      // precisam sair antes de events/employees.
      await tx.delete(absencesTable);
      await tx.delete(quarterlyResultsTable);
      // Referencia employeeId (cascade) e createdByUserId (sem cascade) — precisa
      // sair explicitamente antes de apagar os usuários não-admin.
      await tx.delete(employeeCycleEligibilityTable);

      // Apagar eventos cascateia: event_participants, event_criteria,
      // event_area_assignments, evaluations, calibrations, event_conformities,
      // employee_event_results (todos com onDelete cascade em event_id).
      await tx.delete(eventsTable);

      // audit_logs.user_id referencia usuários sem cascade — desvincula os
      // registros de quem será removido, mas preserva o histórico de auditoria.
      await tx.update(auditLogsTable).set({ userId: null }).where(ne(auditLogsTable.userId, callerId));

      await tx.delete(usersTable).where(ne(usersTable.id, callerId));
      await tx.delete(employeesTable);
    });

    lastSyncAt = null;
    lastLogs = [];
    await audit(callerId, "reset_operational_data", "system", undefined, null, { resetBy: callerId });

    res.json({
      success: true,
      message: "Eventos, avaliações, colaboradores e usuários (exceto o seu) foram apagados. Áreas, quesitos, ciclo e regras foram preservados.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ success: false, message: `Falha ao resetar dados: ${msg}` });
  }
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

  const cycle = await getCurrentCycle();
  if (!cycle) {
    res.status(400).json({
      success: false,
      message: "Nenhum ciclo ativo",
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

    // 1) Eventos dentro do período do ciclo atual (startDate/endDate do
    //    ciclo). Importamos TODOS os eventos da janela, independente de já
    //    terem terminado ou não — a sincronização pode ser rodada durante o
    //    ciclo para trazer eventos futuros/em andamento. Se o ciclo não tiver
    //    datas definidas, caímos de volta no filtro por TARGET_YEAR
    //    (compatibilidade).
    const cycleStartDate = cycle.startDate;
    const cycleEndDate = cycle.endDate;
    const keptEvents = cycleStartDate && cycleEndDate
      ? extEvents.filter(ev => {
          const end = ev.endDate ? normalizeDate(ev.endDate) : normalizeDate(ev.startDate);
          return end >= cycleStartDate && end <= cycleEndDate;
        })
      : extEvents.filter(ev => {
          const yq = deriveYearQuarter(ev.startDate);
          return (ev.year ?? yq.year) === TARGET_YEAR;
        });
    const keptEventIds = new Set(keptEvents.map(ev => extIdOf(ev)).filter((v): v is string => !!v));

    // 2) Participações nesses eventos com função Cenotécnica/Cenotécnico (e variantes) ou Sup Ceno.
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
    const windowLabel = cycleStartDate && cycleEndDate
      ? `ciclo ${cycleStartDate} a ${cycleEndDate}`
      : `ano ${TARGET_YEAR} (ciclo sem datas definidas)`;
    log(`Filtro: eventos do ${windowLabel} (${keptEvents.length}/${extEvents.length} na janela; demais fora do período do ciclo), participações Cenotécnica/Cenotécnico/Sup Ceno (${keptParticipations.length}/${extParticipations.length}), colaboradores participantes (${keptEmployees.length}/${extEmployees.length}).`);

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
        // employmentType só entra quando o Logística Interna realmente mandar o
        // campo (ainda não manda hoje) — nunca sobrescreve um valor já corrigido
        // manualmente na Maratona com o default "casa".
        const employmentType = normalizeEmploymentType(e.employmentType ?? e.tipo ?? e.type);
        await tx.insert(employeesTable)
          .values({ externalId, sourceType: "erp", ...fields, ...(employmentType && { employmentType }) })
          .onConflictDoUpdate({ target: employeesTable.externalId, set: { ...fields, ...(employmentType && { employmentType }) } });
        employeesSync++;
      }

      // Eventos — upsert por externalId
      for (const ev of keptEvents) {
        const externalId = ev.externalId != null ? String(ev.externalId) : (ev.id != null ? String(ev.id) : null);
        if (!externalId || !ev.name) continue;
        const startDate = normalizeDate(ev.startDate);
        const endDate = ev.endDate ? normalizeDate(ev.endDate) : startDate;
        const fields = {
          name: ev.name,
          clientName: ev.clientName ?? ev.client ?? null,
          location: ev.location ?? null,
          city: ev.city ?? null,
          state: ev.state ?? null,
          startDate,
          endDate,
          cycleId: cycle.id,
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
        // Diária prevista (aba Escalação) — ainda não vem do Logística Interna
        // hoje; quando vier, entra aqui como dado só de sync. actualDiariaCount
        // nunca é tocado pelo sync — é reconciliado manualmente na Maratona.
        const diariaFields = {
          ...(typeof p.diariaCount === "number" && { scheduledDiariaCount: p.diariaCount }),
          ...(p.diariaStartDate && { scheduledDiariaStart: normalizeDate(p.diariaStartDate) }),
          ...(p.diariaEndDate && { scheduledDiariaEnd: normalizeDate(p.diariaEndDate) }),
        };
        await tx.insert(eventParticipantsTable)
          .values({ eventId, employeeId, ...fields, ...diariaFields })
          .onConflictDoUpdate({
            target: [eventParticipantsTable.eventId, eventParticipantsTable.employeeId],
            set: { ...fields, ...diariaFields },
          });
        participantsSync++;
      }

      // Vincular os critérios padrão aos eventos sincronizados (igual à criação
      // manual de evento). Só anexa em eventos que ainda não têm critérios — assim
      // a re-sincronização não sobrescreve a configuração feita pelo RH.
      const syncedEventIds = Array.from(evMap.values());
      if (syncedEventIds.length > 0) {
        const activeCriteria = await tx.select().from(criteriaTable).where(and(eq(criteriaTable.active, true), eq(criteriaTable.eventScoped, false)));
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

// ---------------------------------------------------------------------------
// Importação de resultados históricos (provas anteriores, sem avaliação
// individual por critério — a nota já vem PRONTA/calibrada de uma planilha
// externa e é aplicada diretamente a todos os colaboradores daquela prova).
// Colunas esperadas (com ou sem cabeçalho): nome, nota, evento, data.
// Cria um evento por (nome do evento normalizado + data) já FECHADO e marcado
// isHistorical=true, com importedScore = nota, e vincula os participantes.
// recomputeCycleResults então usa importedScore direto (ver results.ts),
// então esses resultados sobrevivem a qualquer recomputação futura do ciclo.
// SEMPRE roda em modo de pré-visualização (dryRun) por padrão — só grava
// quando dryRun=false E não há nenhum erro (tudo-ou-nada).
// ---------------------------------------------------------------------------

function normalizeImportText(s?: string | null): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parseImportDate(raw: string): string | null {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function parseImportScore(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!s) return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

type HistoricalRow = { line: number; name: string; scoreRaw: string; eventName: string; dateRaw: string };

function parseHistoricalCsv(csvData: string): { rows: HistoricalRow[]; parseErrors: string[] } {
  const rawLines = csvData.split("\n").map(l => l.replace(/\r$/, "")).filter(l => l.trim());
  const parseErrors: string[] = [];
  if (rawLines.length === 0) return { rows: [], parseErrors: ["Arquivo vazio"] };

  const delimiter = rawLines[0].includes("\t") ? "\t" : ",";
  const splitLine = (l: string) => l.split(delimiter).map(c => c.trim());

  const headerCells = splitLine(rawLines[0]).map(c => normalizeImportText(c));
  const headerKeywords = ["nome", "nota", "evento", "prova", "data", "score", "pontuacao", "race", "date", "name"];
  const looksLikeHeader = headerCells.some(c => headerKeywords.includes(c));

  let nameIdx = 0, scoreIdx = 1, eventIdx = 2, dateIdx = 3;
  let dataLines = rawLines;
  if (looksLikeHeader) {
    dataLines = rawLines.slice(1);
    const idxOf = (preds: string[]) => headerCells.findIndex(h => preds.some(p => h.includes(p)));
    const n = idxOf(["nome", "name"]); if (n >= 0) nameIdx = n;
    const s = idxOf(["nota", "score", "pontuacao"]); if (s >= 0) scoreIdx = s;
    const e = idxOf(["evento", "prova", "race"]); if (e >= 0) eventIdx = e;
    const d = idxOf(["data", "date"]); if (d >= 0) dateIdx = d;
  }

  const rows: HistoricalRow[] = [];
  dataLines.forEach((line, i) => {
    const lineNumber = looksLikeHeader ? i + 2 : i + 1;
    const cols = splitLine(line);
    const name = cols[nameIdx]?.trim();
    const scoreRaw = cols[scoreIdx]?.trim();
    const eventName = cols[eventIdx]?.trim();
    const dateRaw = cols[dateIdx]?.trim();
    if (!name && !scoreRaw && !eventName && !dateRaw) return;
    if (!name || !scoreRaw || !eventName || !dateRaw) {
      parseErrors.push(`Linha ${lineNumber}: colunas incompletas (esperado nome, nota, evento, data)`);
      return;
    }
    rows.push({ line: lineNumber, name, scoreRaw, eventName, dateRaw });
  });

  return { rows, parseErrors };
}

router.post("/integration/import/historical-results", async (req, res) => {
  const { csvData, dryRun, linkOverrides } = req.body ?? {};
  const isDryRun = dryRun !== false;
  if (!csvData || typeof csvData !== "string") { res.status(400).json({ error: "csvData obrigatório" }); return; }
  const overrideMap: Record<string, number> =
    linkOverrides && typeof linkOverrides === "object" ? linkOverrides : {};

  const { rows, parseErrors } = parseHistoricalCsv(csvData);
  const errors: string[] = [...parseErrors];
  const unmatched: string[] = [];
  const ambiguous: string[] = [];
  const cycleFallback: string[] = [];

  const allEmployees = await db.select({ id: employeesTable.id, name: employeesTable.name }).from(employeesTable);
  const employeesByName = new Map<string, { id: number; name: string }[]>();
  for (const e of allEmployees) {
    const key = normalizeImportText(e.name);
    if (!employeesByName.has(key)) employeesByName.set(key, []);
    employeesByName.get(key)!.push(e);
  }

  // Colaboradores que não existem ainda serão criados automaticamente no commit
  // (não bloqueiam a importação). Ambíguos (nome bate com mais de um cadastro)
  // continuam bloqueando, pois não dá para adivinhar qual colaborador é o certo.
  const toCreateNames = new Map<string, string>(); // normalizedKey -> nome original (primeira ocorrência)

  type ParsedRow = HistoricalRow & { normalizedEvent: string; date: string | null; score: number | null; employeeId: number | null; toCreateKey: string | null };
  const parsed: ParsedRow[] = rows.map(r => {
    const date = parseImportDate(r.dateRaw);
    if (!date) errors.push(`Linha ${r.line}: data inválida "${r.dateRaw}" (use dd/mm/aaaa ou aaaa-mm-dd)`);
    const score = parseImportScore(r.scoreRaw);
    if (score === null) errors.push(`Linha ${r.line}: nota inválida "${r.scoreRaw}" (esperado número de 0 a 100)`);

    const key = normalizeImportText(r.name);
    const matches = employeesByName.get(key) ?? [];
    let employeeId: number | null = null;
    let toCreateKey: string | null = null;
    if (matches.length === 0) {
      unmatched.push(`Linha ${r.line}: colaborador "${r.name}" será criado automaticamente`);
      if (!toCreateNames.has(key)) toCreateNames.set(key, r.name);
      toCreateKey = key;
    } else if (matches.length > 1) {
      ambiguous.push(`Linha ${r.line}: "${r.name}" corresponde a ${matches.length} colaboradores cadastrados — resolva manualmente`);
    } else {
      employeeId = matches[0].id;
    }

    return { ...r, normalizedEvent: normalizeImportText(r.eventName), date, score, employeeId, toCreateKey };
  });
  errors.push(...ambiguous);

  // Agrupa por (evento normalizado + data) — nota do TIME, igual para todos.
  type Group = {
    eventName: string; normalizedEvent: string; date: string; scores: number[];
    participants: { line: number; name: string; employeeId: number | null; toCreateKey: string | null }[];
  };
  const groups = new Map<string, Group>();
  for (const r of parsed) {
    if (!r.date) continue;
    const key = `${r.normalizedEvent}|${r.date}`;
    if (!groups.has(key)) groups.set(key, { eventName: r.eventName, normalizedEvent: r.normalizedEvent, date: r.date, scores: [], participants: [] });
    const g = groups.get(key)!;
    if (r.score !== null) g.scores.push(r.score);
    g.participants.push({ line: r.line, name: r.name, employeeId: r.employeeId, toCreateKey: r.toCreateKey });
  }

  const distinctDates = Array.from(new Set(Array.from(groups.values()).map(g => g.date)));
  const existingEventsByDate = distinctDates.length > 0
    ? await db.select().from(eventsTable).where(inArray(eventsTable.startDate, distinctDates))
    : [];
  // Busca TODOS os eventos (não só os com startDate exato) para detectar possíveis
  // duplicatas por sobreposição de datas — o nome do evento no CSV muitas vezes não
  // bate exatamente com o nome do evento já cadastrado manualmente (abreviação,
  // apelido, digitação diferente), então o match exato de nome+data não pega tudo.
  const allEventsForOverlap = await db.select({
    id: eventsTable.id, name: eventsTable.name, startDate: eventsTable.startDate,
    endDate: eventsTable.endDate, isHistorical: eventsTable.isHistorical, cycleId: eventsTable.cycleId,
  }).from(eventsTable);
  const allCycles = await db.select().from(cyclesTable);
  const fallbackCycle = await getCurrentCycle();

  type OverlapCandidate = { id: number; name: string; startDate: string; endDate: string; isHistorical: boolean };
  type GroupPlan = {
    eventName: string; date: string; score: number | null; participantsCount: number;
    matchedCount: number; action: "create" | "update" | "conflict"; existingEventId?: number; cycleId?: number; cycleName?: string; cycleFallback?: boolean; newEmployeeNames?: string[];
    groupKey: string; overlapCandidates?: OverlapCandidate[];
  };
  const plans: GroupPlan[] = [];
  const cyclesById = new Map(allCycles.map(c => [c.id, c]));

  for (const g of groups.values()) {
    const uniqueScores = Array.from(new Set(g.scores.map(s => Math.round(s * 100) / 100)));
    let score: number | null = null;
    if (uniqueScores.length === 0) {
      // já reportado como erro de nota inválida acima
    } else if (uniqueScores.length > 1) {
      errors.push(`Evento "${g.eventName}" (${g.date}): notas divergentes entre colaboradores (${uniqueScores.join(", ")}) — nota do time deve ser única`);
    } else {
      score = uniqueScores[0];
    }

    const matchedCount = g.participants.filter(p => p.employeeId !== null || p.toCreateKey !== null).length;
    const existing = existingEventsByDate.filter(e => e.startDate === g.date && normalizeImportText(e.name) === g.normalizedEvent);
    const groupKey = `${g.normalizedEvent}|${g.date}`;

    let action: GroupPlan["action"];
    let existingEventId: number | undefined;
    let cycleId: number | undefined;
    let isCycleFallback = false;
    if (existing.length > 1) {
      errors.push(`Evento "${g.eventName}" (${g.date}): múltiplos eventos existentes com o mesmo nome/data — ambíguo, resolva manualmente`);
      action = "conflict";
    } else if (existing.length === 1) {
      if (!existing[0].isHistorical) {
        errors.push(`Evento "${g.eventName}" (${g.date}) já existe (id ${existing[0].id}) e não é histórico — possível duplicata, importação abortada`);
        action = "conflict";
      } else {
        action = "update";
        existingEventId = existing[0].id;
        cycleId = existing[0].cycleId;
      }
    } else {
      const cycle = allCycles.find(c => c.startDate && c.endDate && g.date >= c.startDate && g.date <= c.endDate);
      if (cycle) {
        action = "create";
        cycleId = cycle.id;
      } else if (fallbackCycle) {
        cycleFallback.push(`Evento "${g.eventName}" (${g.date}): nenhum ciclo cobre esta data — será vinculado ao ciclo atual (${fallbackCycle.name ?? fallbackCycle.id})`);
        action = "create";
        cycleId = fallbackCycle.id;
        isCycleFallback = true;
      } else {
        errors.push(`Evento "${g.eventName}" (${g.date}): nenhum ciclo cobre esta data e não há ciclo cadastrado — configure um ciclo antes de importar`);
        action = "conflict";
      }
    }

    // Quando vai criar um evento novo, verifica se já existe algum evento
    // (de qualquer nome/status) cujo período cobre esta data — pode ser o
    // mesmo evento cadastrado manualmente com um nome diferente. Não bloqueia
    // nem decide sozinho (nomes parecidos podem ser corridas diferentes na
    // mesma semana); só sugere, e o admin escolhe vincular via linkOverrides.
    let overlapCandidates: OverlapCandidate[] | undefined;
    if (action === "create") {
      const candidates = allEventsForOverlap.filter(e => e.startDate <= g.date && e.endDate >= g.date);
      if (candidates.length > 0) {
        overlapCandidates = candidates.map(e => ({
          id: e.id, name: e.name, startDate: e.startDate, endDate: e.endDate, isHistorical: e.isHistorical,
        }));
      }
    }

    const cycleName = cycleId ? cyclesById.get(cycleId)?.name : undefined;
    const newEmployeeNames = Array.from(new Set(
      g.participants.filter(p => p.toCreateKey !== null).map(p => toCreateNames.get(p.toCreateKey!) ?? p.name)
    ));
    const planEntry: GroupPlan = {
      eventName: g.eventName, date: g.date, score, participantsCount: g.participants.length,
      matchedCount, action, existingEventId, cycleId, cycleName, cycleFallback: isCycleFallback,
      newEmployeeNames: newEmployeeNames.length > 0 ? newEmployeeNames : undefined,
      groupKey, overlapCandidates,
    };
    plans.push(planEntry);
    (g as Group & { _plan?: GroupPlan })._plan = planEntry;
  }

  const preview = {
    totalRows: rows.length,
    matched: parsed.filter(r => r.employeeId !== null).length,
    unmatched,
    ambiguous,
    cycleFallback,
    events: plans,
    employeesToCreate: Array.from(toCreateNames.values()),
  };

  if (isDryRun) {
    res.json({ success: errors.length === 0, dryRun: true, errors, ...preview });
    return;
  }

  if (errors.length > 0) {
    res.status(400).json({ success: false, dryRun: false, errors, ...preview });
    return;
  }

  const userId = req.user!.userId;
  let eventsCreated = 0, eventsUpdated = 0, participantsLinked = 0, employeesCreated = 0;
  const affectedCycleIds = new Set<number>();

  await db.transaction(async (tx) => {
    // Cria primeiro os colaboradores que não existiam, para poder vinculá-los aos eventos abaixo.
    const createdEmployeeIdByKey = new Map<string, number>();
    for (const [key, originalName] of toCreateNames) {
      const [created] = await tx.insert(employeesTable).values({
        name: originalName,
        sourceType: "manual",
      }).returning({ id: employeesTable.id });
      createdEmployeeIdByKey.set(key, created.id);
      employeesCreated++;
    }

    for (const g of groups.values()) {
      const plan = (g as Group & { _plan?: GroupPlan })._plan!;
      let eventId: number;
      const overrideEventId = plan.action === "create" ? overrideMap[plan.groupKey] : undefined;
      const overrideTarget = overrideEventId != null
        ? plan.overlapCandidates?.find(c => c.id === overrideEventId)
        : undefined;
      if (overrideTarget) {
        // Admin optou por vincular este grupo a um evento já existente
        // (em vez de criar um novo) — mesmo tratamento do fluxo "update".
        eventId = overrideTarget.id;
        const targetCycleId = allEventsForOverlap.find(e => e.id === overrideTarget.id)?.cycleId ?? plan.cycleId!;
        await tx.update(eventsTable).set({
          importedScore: String(plan.score),
          status: "closed",
          isHistorical: true,
        }).where(eq(eventsTable.id, eventId));
        eventsUpdated++;
        affectedCycleIds.add(targetCycleId);
      } else if (plan.action === "create") {
        const [created] = await tx.insert(eventsTable).values({
          name: g.eventName,
          startDate: g.date,
          endDate: g.date,
          cycleId: plan.cycleId!,
          status: "closed",
          isHistorical: true,
          importedScore: String(plan.score),
          forcedClosed: false,
          feedbackReleased: false,
        }).returning();
        eventId = created.id;
        eventsCreated++;
        affectedCycleIds.add(plan.cycleId!);
      } else {
        eventId = plan.existingEventId!;
        await tx.update(eventsTable).set({
          importedScore: String(plan.score),
          status: "closed",
          isHistorical: true,
        }).where(eq(eventsTable.id, eventId));
        eventsUpdated++;
        affectedCycleIds.add(plan.cycleId!);
      }

      const employeeIds = Array.from(new Set(g.participants
        .map(p => p.employeeId ?? (p.toCreateKey ? createdEmployeeIdByKey.get(p.toCreateKey) ?? null : null))
        .filter((id): id is number => id !== null)));
      for (const employeeId of employeeIds) {
        await tx.insert(eventParticipantsTable)
          .values({ eventId, employeeId })
          .onConflictDoNothing({ target: [eventParticipantsTable.eventId, eventParticipantsTable.employeeId] });
        participantsLinked++;
      }
    }
  });

  const warnings: string[] = [];
  for (const cycleId of affectedCycleIds) {
    const { warnings: w } = await recomputeCycleResults(cycleId, userId);
    warnings.push(...w);
  }

  await audit(userId, "import_historical_results", "events", undefined, null, {
    eventsCreated, eventsUpdated, participantsLinked, employeesCreated, matched: preview.matched,
  });

  res.json({ success: true, dryRun: false, eventsCreated, eventsUpdated, participantsLinked, employeesCreated, warnings, errors: [], ...preview });
});

// ---------------------------------------------------------------------------
// Importação da pesquisa de avaliadores (planilha xlsx, 1 linha = 1 resposta
// de 1 avaliador sobre 1 evento). Diferente da importação histórica: aqui a
// nota é POR CRITÉRIO (escala 0-10, mesma escala usada nas avaliações
// normais — NÃO multiplicar por 10) e vira uma avaliação de verdade
// (evaluations), não uma nota pronta de time. Também:
//  - cria usuários avaliadores (role="avaliador"), com deduplicação por nome
//    normalizado — nunca cria duplicata para o mesmo avaliador;
//  - NUNCA cria eventos: cada "evento da planilha" (texto livre da coluna
//    Evento+cidade+data) precisa ser explicitamente vinculado pelo admin a um
//    evento já existente via linkOverrides (revisão manual, sem fallback de
//    auto-criação — evita duplicar eventos por causa de nomes divergentes);
//  - se o evento vinculado é histórico (isHistorical=true, nota pronta vinda
//    de outra fonte), NÃO grava avaliação nem conformidade — só concatena os
//    comentários da planilha em importedNotes, como referência;
//  - as 4 perguntas Sim/Não viram itens da Matriz de Conformidade
//    (event_conformities), com "pior caso vence": se qualquer resposta para
//    aquele item for "Não" para o evento, o item fica reprovado, mesmo que
//    outro avaliador tenha respondido "Sim";
//  - embutida aqui está a migração completa do catálogo de critérios para o
//    catálogo novo da Matriz de Performance (mesmo já adotado no ambiente de
//    dev por outra frente de trabalho, mas ainda não replicado em produção):
//    desativa os 7 quesitos antigos e cria/reativa os 5 novos (mesmos nomes,
//    pesos e áreas responsáveis já usados em dev), pois a pesquisa só faz
//    sentido pontuada contra o catálogo novo. Resolvida por NOME normalizado
//    (não por id) para não depender da ordem de inserção do seed. Só roda de
//    fato no commit (dryRun=false); a pré-visualização apenas mostra o que
//    vai mudar.
// SEMPRE roda em modo de pré-visualização (dryRun) por padrão — só grava
// quando dryRun=false, todos os grupos estão vinculados e não há erros.
// ---------------------------------------------------------------------------

const SURVEY_COL = {
  NAME: 2,
  EVENT_LABEL: 3,
  AREA: 4,
  PERDA_MATERIAL: 5, PERDA_MATERIAL_COMMENT: 6,
  LOGISTICA_REVERSA: 7, LOGISTICA_REVERSA_COMMENT: 8,
  QUALIDADE_ATENDIMENTO: 9, QUALIDADE_ATENDIMENTO_COMMENT: 10,
  QUALIDADE_ATIVACAO: 11, QUALIDADE_ATIVACAO_COMMENT: 12,
  PRAZO_ENTREGA: 13, PRAZO_ENTREGA_COMMENT: 14,
  GUARDA_EQUIPAMENTOS: 15, GUARDA_EQUIPAMENTOS_COMMENT: 16,
  CARGA_GALPAO: 17, CARGA_GALPAO_COMMENT: 18,
  EPI: 19, EPI_COMMENT: 20,
  ESTAIAMENTOS: 21, ESTAIAMENTOS_COMMENT: 22,
  CONDUTA: 23, CONDUTA_COMMENT: 24,
  FALTOU_ATRASOU: 25,
  DESTAQUE: 26,
  QUEM_DESTACOU: 27,
  NIVEL_DESEMPENHO: 28,
} as const;

// Critérios antigos (catálogo pré-Matriz de Performance) — devem ser
// desativados e substituídos pelos 5 novos da Matriz de Performance.
const SURVEY_CRITERIA_RETIRED = [
  "Qualidade e Acabamento da Montagem",
  "Logística Reversa/Carga da Desmontagem",
  "Prazo de Entrega/Arena Pronta no Horário",
  "Retorno de Material/Perdas ou Avarias",
  "Ferramentas & Case", "Obrigações Estruturais", "Conduta e Comportamento",
];

// Catálogo novo (Matriz de Performance) — os 5 quesitos ativos que devem
// estar em TODOS os eventos. Nomes, pesos e áreas conforme o cadastro atual.
const SURVEY_TARGET_CRITERIA: { name: string; description: string; areaName: string; weight: string }[] = [
  { name: "Perda de Material/Estrutura", description: "Todo material enviado deve retornar à base sem perda de mercadorias, materiais ou avarias.", areaName: "Logística", weight: "3" },
  { name: "Logística Reversa", description: "Avalia se a carga de retorno foi feita adequadamente e conforme o alinhamento combinado.", areaName: "Logística", weight: "3" },
  { name: "Qualidade da Entrega", description: "Avalia acabamento, materiais em bom estado, qualidade visual e satisfação na ativação/atendimento.", areaName: "Atendimento", weight: "3" },
  { name: "Prazo de Entrega", description: "Avalia se as entregas ocorreram dentro do cronograma, sem atrasos e sem custos adicionais de mão de obra.", areaName: "Produção", weight: "3" },
  { name: "Carga na Saída do Galpão", description: "Avalia a conferência, organização e integridade da carga no momento da saída do galpão, antes do embarque para o evento.", areaName: "Cenografia", weight: "3" },
];

// Mapeamento de critérios antigos → novos equivalentes para remapeamento
// de avaliações já submetidas com o catálogo antigo.
const SURVEY_CRITERIA_REMAP: { oldName: string; newName: string }[] = [
  { oldName: "Qualidade e Acabamento da Montagem", newName: "Qualidade da Entrega" },
  { oldName: "Logística Reversa/Carga da Desmontagem", newName: "Logística Reversa" },
  { oldName: "Prazo de Entrega/Arena Pronta no Horário", newName: "Prazo de Entrega" },
  { oldName: "Retorno de Material/Perdas ou Avarias", newName: "Perda de Material/Estrutura" },
];

const SURVEY_SCORE_COLUMNS: { col: number; commentCol: number; criterionName: string }[] = [
  { col: SURVEY_COL.PERDA_MATERIAL, commentCol: SURVEY_COL.PERDA_MATERIAL_COMMENT, criterionName: "Perda de Material/Estrutura" },
  { col: SURVEY_COL.LOGISTICA_REVERSA, commentCol: SURVEY_COL.LOGISTICA_REVERSA_COMMENT, criterionName: "Logística Reversa" },
  { col: SURVEY_COL.QUALIDADE_ATENDIMENTO, commentCol: SURVEY_COL.QUALIDADE_ATENDIMENTO_COMMENT, criterionName: "Qualidade da Entrega" },
  { col: SURVEY_COL.QUALIDADE_ATIVACAO, commentCol: SURVEY_COL.QUALIDADE_ATIVACAO_COMMENT, criterionName: "Qualidade da Entrega" },
  { col: SURVEY_COL.PRAZO_ENTREGA, commentCol: SURVEY_COL.PRAZO_ENTREGA_COMMENT, criterionName: "Prazo de Entrega" },
  { col: SURVEY_COL.CARGA_GALPAO, commentCol: SURVEY_COL.CARGA_GALPAO_COMMENT, criterionName: "Carga na Saída do Galpão" },
];

type ConformityField = "epi" | "estaiamentos" | "guardaEquipamentos" | "conduta";
const SURVEY_CONFORMITY_COLUMNS: { col: number; field: ConformityField }[] = [
  { col: SURVEY_COL.GUARDA_EQUIPAMENTOS, field: "guardaEquipamentos" },
  { col: SURVEY_COL.EPI, field: "epi" },
  { col: SURVEY_COL.ESTAIAMENTOS, field: "estaiamentos" },
  { col: SURVEY_COL.CONDUTA, field: "conduta" },
];

const SURVEY_NOTE_COLUMNS = [
  SURVEY_COL.PERDA_MATERIAL_COMMENT, SURVEY_COL.LOGISTICA_REVERSA_COMMENT,
  SURVEY_COL.QUALIDADE_ATENDIMENTO_COMMENT, SURVEY_COL.QUALIDADE_ATIVACAO_COMMENT,
  SURVEY_COL.PRAZO_ENTREGA_COMMENT, SURVEY_COL.CARGA_GALPAO_COMMENT,
  SURVEY_COL.FALTOU_ATRASOU, SURVEY_COL.QUEM_DESTACOU, SURVEY_COL.NIVEL_DESEMPENHO,
];

// Rótulo de área declarado pelo avaliador na planilha -> nome da área no
// cadastro, usado só para dar um perfil (areaId) padrão ao usuário avaliador
// criado. Não decide a qual área o avaliador fica ATRIBUÍDO no evento (isso é
// feito pela área RESPONSÁVEL do critério que ele efetivamente pontuou).
const SURVEY_AREA_LABEL_TO_AREA_NAME: Record<string, string> = {
  [normalizeImportText("Logística")]: "Logística",
  [normalizeImportText("Produção")]: "Produção",
  [normalizeImportText("Atendimento")]: "Atendimento",
  [normalizeImportText("Ativação")]: "Ativação",
  [normalizeImportText("Cenografia")]: "Cenografia",
  [normalizeImportText("Ferramentas e Case (Cenografia)")]: "Ferramentas e case",
};

type SurveyRawRow = (string | number | null | undefined)[];

interface ParsedSurveyRow {
  line: number;
  evaluatorName: string;
  eventLabel: string;
  normalizedEventLabel: string;
  areaLabelNormalized: string;
  scores: { criterionName: string; score: number; comment: string | null }[];
  conformity: Partial<Record<ConformityField, boolean>>;
  noteText: string | null;
}

function surveyCell(row: SurveyRawRow, idx: number): string {
  const v = row[idx];
  return v == null ? "" : String(v).trim();
}

function parseScore10(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!s) return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n < 0 || n > 10) return null;
  return Math.round(n * 100) / 100;
}

function parseSimNao(raw: string): boolean | null {
  const n = normalizeImportText(raw);
  if (!n) return null;
  if (n.startsWith("sim")) return true;
  if (n.startsWith("nao")) return false;
  return null;
}

function parseSurveyRow(raw: SurveyRawRow, line: number): ParsedSurveyRow | null {
  const evaluatorName = surveyCell(raw, SURVEY_COL.NAME);
  const eventLabel = surveyCell(raw, SURVEY_COL.EVENT_LABEL);
  if (!evaluatorName && !eventLabel) return null;

  const areaLabelNormalized = normalizeImportText(surveyCell(raw, SURVEY_COL.AREA));

  const scores: ParsedSurveyRow["scores"] = [];
  for (const map of SURVEY_SCORE_COLUMNS) {
    const rawScore = surveyCell(raw, map.col);
    if (!rawScore) continue;
    const score = parseScore10(rawScore);
    if (score === null) continue;
    scores.push({ criterionName: map.criterionName, score, comment: surveyCell(raw, map.commentCol) || null });
  }

  const conformity: ParsedSurveyRow["conformity"] = {};
  for (const c of SURVEY_CONFORMITY_COLUMNS) {
    const rawAnswer = surveyCell(raw, c.col);
    if (!rawAnswer) continue;
    const v = parseSimNao(rawAnswer);
    if (v !== null) conformity[c.field] = v;
  }

  const noteParts = SURVEY_NOTE_COLUMNS.map(idx => surveyCell(raw, idx)).filter(Boolean);
  const noteText = noteParts.length > 0 ? Array.from(new Set(noteParts)).join(" | ") : null;

  return { line, evaluatorName, eventLabel, normalizedEventLabel: normalizeImportText(eventLabel), areaLabelNormalized, scores, conformity, noteText };
}

function slugifyForEmail(name: string): string {
  return normalizeImportText(name).replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "avaliador";
}

function generateTempPassword(): string {
  return crypto.randomBytes(6).toString("hex");
}

function buildUniqueEmail(name: string, used: Set<string>): string {
  const base = slugifyForEmail(name);
  let candidate = `${base}@avaliador.importado`;
  let n = 2;
  while (used.has(candidate)) {
    candidate = `${base}${n}@avaliador.importado`;
    n++;
  }
  return candidate;
}

type SurveyEventCandidate = { id: number; name: string; startDate: string; endDate: string; isHistorical: boolean; status: string; cycleId: number; city: string | null };

function suggestSurveyEventMatches(label: string, events: SurveyEventCandidate[]): SurveyEventCandidate[] {
  const normLabel = normalizeImportText(label);
  if (!normLabel) return [];
  return events
    .filter(e => {
      const normName = normalizeImportText(e.name);
      if (!normName) return false;
      return normLabel.includes(normName) || normName.includes(normLabel) || (!!e.city && normLabel.includes(normalizeImportText(e.city)));
    })
    .slice(0, 5);
}

router.post("/integration/import/survey", requireRole("admin"), async (req, res) => {
  const { rows: rawRows, dryRun, linkOverrides } = req.body ?? {};
  const isDryRun = dryRun !== false;
  if (!Array.isArray(rawRows)) { res.status(400).json({ error: "rows obrigatório (array de linhas da planilha)" }); return; }
  const overrideMap: Record<string, number> = linkOverrides && typeof linkOverrides === "object" ? linkOverrides : {};

  const errors: string[] = [];
  const parsedRows: ParsedSurveyRow[] = [];
  rawRows.forEach((raw: unknown, i: number) => {
    const line = i + 2;
    if (!Array.isArray(raw)) return;
    const parsed = parseSurveyRow(raw as SurveyRawRow, line);
    if (!parsed) return;
    if (!parsed.evaluatorName) { errors.push(`Linha ${line}: nome do avaliador ausente`); return; }
    if (!parsed.eventLabel) { errors.push(`Linha ${line}: evento ausente`); return; }
    parsedRows.push(parsed);
  });

  type SurveyGroup = { eventLabel: string; normalizedEventLabel: string; rows: ParsedSurveyRow[] };
  const groups = new Map<string, SurveyGroup>();
  for (const r of parsedRows) {
    if (!groups.has(r.normalizedEventLabel)) groups.set(r.normalizedEventLabel, { eventLabel: r.eventLabel, normalizedEventLabel: r.normalizedEventLabel, rows: [] });
    groups.get(r.normalizedEventLabel)!.rows.push(r);
  }

  const allEvents: SurveyEventCandidate[] = await db.select({
    id: eventsTable.id, name: eventsTable.name, startDate: eventsTable.startDate, endDate: eventsTable.endDate,
    isHistorical: eventsTable.isHistorical, status: eventsTable.status, cycleId: eventsTable.cycleId, city: eventsTable.city,
  }).from(eventsTable);
  const eventsById = new Map(allEvents.map(e => [e.id, e]));

  // linkOverrides[groupKey] === -1 significa "ignorar este grupo": as linhas
  // não são importadas (útil p.ex. para respostas de provas históricas que o
  // admin decidiu não trazer para o app).
  const SURVEY_IGNORE_GROUP = -1;

  type SurveyGroupPlan = {
    groupKey: string; eventLabel: string; rowCount: number; distinctEvaluators: number;
    linkedEventId?: number; linkedEvent?: { id: number; name: string; startDate: string; isHistorical: boolean; status: string; cycleId: number };
    suggestions: { id: number; name: string; startDate: string; isHistorical: boolean }[];
    resolved: boolean;
    ignored: boolean;
  };
  const groupPlans: SurveyGroupPlan[] = [];
  for (const g of groups.values()) {
    const distinctEvaluators = new Set(g.rows.map(r => normalizeImportText(r.evaluatorName))).size;
    const overrideId = overrideMap[g.normalizedEventLabel];
    const ignored = overrideId === SURVEY_IGNORE_GROUP;
    const linkedEvent = overrideId != null && !ignored ? eventsById.get(overrideId) : undefined;
    if (overrideId != null && !ignored && !linkedEvent) errors.push(`Evento "${g.eventLabel}": vínculo informado (id ${overrideId}) não existe`);
    groupPlans.push({
      groupKey: g.normalizedEventLabel, eventLabel: g.eventLabel, rowCount: g.rows.length, distinctEvaluators,
      linkedEventId: linkedEvent?.id,
      linkedEvent: linkedEvent ? { id: linkedEvent.id, name: linkedEvent.name, startDate: linkedEvent.startDate, isHistorical: linkedEvent.isHistorical, status: linkedEvent.status, cycleId: linkedEvent.cycleId } : undefined,
      suggestions: suggestSurveyEventMatches(g.eventLabel, allEvents).map(e => ({ id: e.id, name: e.name, startDate: e.startDate, isHistorical: e.isHistorical })),
      resolved: !!linkedEvent || ignored,
      ignored,
    });
  }

  const allUsers = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role }).from(usersTable);
  const usersByName = new Map<string, typeof allUsers>();
  for (const u of allUsers) {
    const key = normalizeImportText(u.name);
    if (!usersByName.has(key)) usersByName.set(key, []);
    usersByName.get(key)!.push(u);
  }
  const usedEmails = new Set(allUsers.map(u => u.email.toLowerCase()));

  const ignoredGroupKeys = new Set(groupPlans.filter(gp => gp.ignored).map(gp => gp.groupKey));

  const evaluatorResolution = new Map<string, number>();
  const toCreateAvaliadorNames = new Map<string, { originalName: string; areaLabel: string | null }>();
  for (const r of parsedRows) {
    if (ignoredGroupKeys.has(r.normalizedEventLabel)) continue;
    const key = normalizeImportText(r.evaluatorName);
    if (evaluatorResolution.has(key) || toCreateAvaliadorNames.has(key)) continue;
    const matches = usersByName.get(key) ?? [];
    if (matches.length === 1) {
      evaluatorResolution.set(key, matches[0].id);
    } else if (matches.length > 1) {
      errors.push(`Avaliador "${r.evaluatorName}": corresponde a ${matches.length} usuários já cadastrados — resolva manualmente antes de importar`);
    } else {
      toCreateAvaliadorNames.set(key, { originalName: r.evaluatorName, areaLabel: r.areaLabelNormalized || null });
    }
  }

  const allCriteria = await db.select().from(criteriaTable);
  const criteriaByName = new Map(allCriteria.map(c => [normalizeImportText(c.name), c]));
  const allAreas = await db.select().from(areasTable);
  const areaByName = new Map(allAreas.map(a => [normalizeImportText(a.name), a]));
  for (const tc of SURVEY_TARGET_CRITERIA) {
    if (!areaByName.has(normalizeImportText(tc.areaName))) errors.push(`Área "${tc.areaName}" não encontrada — necessária para o critério "${tc.name}"`);
  }

  const catalogChanges = {
    toDeactivate: SURVEY_CRITERIA_RETIRED.filter(name => criteriaByName.get(normalizeImportText(name))?.active),
    toCreateOrActivate: SURVEY_TARGET_CRITERIA
      .map(tc => tc.name)
      .filter(name => {
        const existing = criteriaByName.get(normalizeImportText(name));
        return !existing || !existing.active;
      }),
  };

  // Linhas efetivamente importáveis, agrupadas pelo evento vinculado (grupos
  // ignorados ficam de fora). Deduplicação: se o MESMO avaliador respondeu o
  // MESMO evento mais de uma vez (reenvio do Forms, ou dois rótulos distintos
  // vinculados ao mesmo evento), só a resposta mais recente (última linha da
  // planilha) é considerada — nunca importamos a mesma avaliação duas vezes.
  const rowsByEventId = new Map<number, ParsedSurveyRow[]>();
  for (const gp of groupPlans) {
    if (gp.ignored || !gp.linkedEventId) continue;
    const g = groups.get(gp.groupKey)!;
    if (!rowsByEventId.has(gp.linkedEventId)) rowsByEventId.set(gp.linkedEventId, []);
    rowsByEventId.get(gp.linkedEventId)!.push(...g.rows);
  }
  let duplicateRowsIgnored = 0;
  const duplicateWarnings: string[] = [];
  for (const [eventId, eventRows] of rowsByEventId) {
    const byEvaluator = new Map<string, ParsedSurveyRow>();
    for (const r of [...eventRows].sort((a, b) => a.line - b.line)) {
      byEvaluator.set(normalizeImportText(r.evaluatorName), r);
    }
    const dropped = eventRows.length - byEvaluator.size;
    if (dropped > 0) {
      duplicateRowsIgnored += dropped;
      const eventName = eventsById.get(eventId)?.name ?? String(eventId);
      duplicateWarnings.push(`Evento "${eventName}": ${dropped} resposta(s) repetida(s) do mesmo avaliador — apenas a mais recente será importada.`);
    }
    rowsByEventId.set(eventId, Array.from(byEvaluator.values()));
  }

  const retiredCriteriaIdsForWarnings = SURVEY_CRITERIA_RETIRED
    .map(n => criteriaByName.get(normalizeImportText(n))?.id)
    .filter((id): id is number => id != null);
  const warnings: string[] = [...duplicateWarnings];
  for (const gp of groupPlans) {
    if (!gp.resolved || !gp.linkedEvent || gp.linkedEvent.isHistorical) continue;
    if (retiredCriteriaIdsForWarnings.length > 0) {
      const existingEvals = await db.select({ id: evaluationsTable.id }).from(evaluationsTable)
        .where(and(eq(evaluationsTable.eventId, gp.linkedEvent.id), inArray(evaluationsTable.criterionId, retiredCriteriaIdsForWarnings), eq(evaluationsTable.status, "submitted")));
      if (existingEvals.length > 0) {
        warnings.push(`Evento "${gp.linkedEvent.name}": ${existingEvals.length} avaliação(ões) já enviada(s) em critérios que serão retirados do catálogo — essas notas deixarão de contar no cálculo após esta importação.`);
      }
    }
    if (gp.linkedEvent.status === "closed") {
      warnings.push(`Evento "${gp.linkedEvent.name}" já está fechado — a nota final será recalculada após esta importação.`);
    }
  }

  // Notas que já existem no app para o mesmo (evento, quesito, avaliador):
  // serão PULADAS no commit para não contar em dobro — o que foi lançado
  // dentro do app prevalece sobre a planilha.
  let evaluationsAlreadyInApp = 0;
  for (const [eventId, eventRows] of rowsByEventId) {
    const targetEvent = eventsById.get(eventId);
    if (!targetEvent || targetEvent.isHistorical) continue;
    const existing = await db.select({ criterionId: evaluationsTable.criterionId, evaluatorUserId: evaluationsTable.evaluatorUserId })
      .from(evaluationsTable).where(eq(evaluationsTable.eventId, eventId));
    if (existing.length === 0) continue;
    const existingPairs = new Set(existing.map(e => `${e.criterionId}:${e.evaluatorUserId}`));
    let skippedHere = 0;
    for (const r of eventRows) {
      const evaluatorUserId = evaluatorResolution.get(normalizeImportText(r.evaluatorName));
      if (!evaluatorUserId) continue;
      for (const s of r.scores) {
        const criterion = criteriaByName.get(normalizeImportText(s.criterionName));
        if (!criterion) continue;
        if (existingPairs.has(`${criterion.id}:${evaluatorUserId}`)) skippedHere++;
      }
    }
    if (skippedHere > 0) {
      evaluationsAlreadyInApp += skippedHere;
      warnings.push(`Evento "${targetEvent.name}": ${skippedHere} nota(s) da planilha já existem no app (mesmo avaliador e quesito) e serão puladas — as notas lançadas no app prevalecem.`);
    }
  }

  const preview = {
    totalRows: parsedRows.length,
    groups: groupPlans,
    unresolvedGroups: groupPlans.filter(g => !g.resolved).map(g => g.groupKey),
    avaliadoresToCreate: Array.from(toCreateAvaliadorNames.values()).map(v => v.originalName),
    catalogChanges,
    warnings,
    duplicateRowsIgnored,
    evaluationsAlreadyInApp,
  };

  if (isDryRun) {
    res.json({ success: errors.length === 0, dryRun: true, errors, ...preview });
    return;
  }

  if (errors.length > 0) {
    res.status(400).json({ success: false, dryRun: false, errors, ...preview });
    return;
  }
  const unresolved = groupPlans.filter(g => !g.resolved);
  if (unresolved.length > 0) {
    res.status(400).json({ success: false, dryRun: false, errors: [`Vincule todos os eventos da planilha a um evento existente antes de confirmar (${unresolved.length} pendente(s)).`], ...preview });
    return;
  }

  const userId = req.user!.userId;
  const createdAvaliadores: { name: string; email: string; tempPassword: string }[] = [];
  let usersCreated = 0, evaluationsCreated = 0, evaluationsSkipped = 0, assignmentsCreated = 0, conformitiesUpserted = 0, eventsUpdated = 0;
  const affectedCycleIds = new Set<number>();

  await db.transaction(async (tx) => {
    const txCriteria = await tx.select().from(criteriaTable);
    const txCriteriaByName = new Map(txCriteria.map(c => [normalizeImportText(c.name), c]));

    for (const name of SURVEY_CRITERIA_RETIRED) {
      const c = txCriteriaByName.get(normalizeImportText(name));
      if (c && c.active) await tx.update(criteriaTable).set({ active: false }).where(eq(criteriaTable.id, c.id));
    }

    let nextDisplayOrder = Math.max(0, ...txCriteria.map(c => c.displayOrder)) + 1;
    const targetCriteriaByName = new Map<string, typeof txCriteria[number]>();
    for (const tc of SURVEY_TARGET_CRITERIA) {
      const key = normalizeImportText(tc.name);
      let criterion = txCriteriaByName.get(key);
      if (!criterion) {
        const area = areaByName.get(normalizeImportText(tc.areaName))!;
        const [created] = await tx.insert(criteriaTable).values({
          name: tc.name,
          description: tc.description,
          responsibleAreaId: area.id,
          responsibleAreaLabel: tc.areaName,
          defaultWeight: tc.weight,
          displayOrder: nextDisplayOrder++,
          active: true,
        }).returning();
        criterion = created;
      } else if (!criterion.active) {
        const area = areaByName.get(normalizeImportText(tc.areaName))!;
        await tx.update(criteriaTable).set({
          active: true,
          defaultWeight: tc.weight,
          description: tc.description,
          responsibleAreaId: area.id,
          responsibleAreaLabel: tc.areaName,
        }).where(eq(criteriaTable.id, criterion.id));
        criterion = { ...criterion, active: true, defaultWeight: tc.weight };
      }
      targetCriteriaByName.set(key, criterion);
    }

    const retiredCriteriaIds = SURVEY_CRITERIA_RETIRED
      .map(n => txCriteriaByName.get(normalizeImportText(n))?.id)
      .filter((id): id is number => id != null);

    const evaluatorIdByNormalizedName = new Map<string, number>(evaluatorResolution);
    for (const [key, info] of toCreateAvaliadorNames) {
      const areaName = info.areaLabel ? SURVEY_AREA_LABEL_TO_AREA_NAME[info.areaLabel] : undefined;
      const profileAreaId = areaName ? areaByName.get(normalizeImportText(areaName))?.id ?? null : null;
      const email = buildUniqueEmail(info.originalName, usedEmails);
      usedEmails.add(email);
      const tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      const [createdUser] = await tx.insert(usersTable).values({
        name: info.originalName, email, passwordHash, role: "avaliador", areaId: profileAreaId ?? null,
      }).returning();
      evaluatorIdByNormalizedName.set(key, createdUser.id);
      createdAvaliadores.push({ name: info.originalName, email, tempPassword });
      usersCreated++;
    }

    for (const [eventId, eventRows] of rowsByEventId) {
      const targetEvent = eventsById.get(eventId)!;

      if (targetEvent.isHistorical) {
        const noteTexts = eventRows.map(r => r.noteText).filter((t): t is string => !!t);
        if (noteTexts.length > 0) {
          const combined = Array.from(new Set(noteTexts)).join(" / ");
          const [current] = await tx.select({ importedNotes: eventsTable.importedNotes }).from(eventsTable).where(eq(eventsTable.id, eventId));
          const merged = current?.importedNotes ? `${current.importedNotes} / ${combined}` : combined;
          await tx.update(eventsTable).set({ importedNotes: merged }).where(eq(eventsTable.id, eventId));
          eventsUpdated++;
        }
        continue;
      }

      const existingEventCriteria = await tx.select().from(eventCriteriaTable).where(eq(eventCriteriaTable.eventId, eventId));
      const existingByCriterionId = new Map(existingEventCriteria.map(ec => [ec.criterionId, ec]));
      for (const c of targetCriteriaByName.values()) {
        const existing = existingByCriterionId.get(c.id);
        if (!existing) {
          await tx.insert(eventCriteriaTable).values({ eventId, criterionId: c.id, active: true });
        } else if (!existing.active) {
          // Critério existia mas estava inativo — reativa para que as avaliações importadas sejam visíveis
          await tx.update(eventCriteriaTable).set({ active: true }).where(eq(eventCriteriaTable.id, existing.id));
        }
      }
      if (retiredCriteriaIds.length > 0) {
        await tx.delete(eventCriteriaTable).where(and(eq(eventCriteriaTable.eventId, eventId), inArray(eventCriteriaTable.criterionId, retiredCriteriaIds)));
      }

      // Notas que já existem no app para (evento, quesito, avaliador) NÃO são
      // regravadas — evita contagem dupla quando o avaliador já lançou a
      // avaliação dentro do app ou quando a planilha é reimportada.
      const existingEvalRows = await tx.select({ criterionId: evaluationsTable.criterionId, evaluatorUserId: evaluationsTable.evaluatorUserId })
        .from(evaluationsTable).where(eq(evaluationsTable.eventId, eventId));
      const existingEvalPairs = new Set(existingEvalRows.map(e => `${e.criterionId}:${e.evaluatorUserId}`));
      // Rastreia pares inseridos neste run para evitar duplicatas quando duas
      // colunas da planilha mapeiam para o mesmo critério (ex.: col 9 e col 11
      // ambas → "Qualidade e Acabamento da Montagem").
      const insertedThisRun = new Set<string>();

      const areaAssignmentPairs = new Set<string>();
      for (const r of eventRows) {
        const evaluatorUserId = evaluatorIdByNormalizedName.get(normalizeImportText(r.evaluatorName));
        if (!evaluatorUserId) continue;

        for (const s of r.scores) {
          const criterion = targetCriteriaByName.get(normalizeImportText(s.criterionName));
          if (!criterion) continue;
          const pairKey = `${criterion.id}:${evaluatorUserId}`;
          if (existingEvalPairs.has(pairKey) || insertedThisRun.has(pairKey)) {
            evaluationsSkipped++;
            continue;
          }
          await tx.insert(evaluationsTable).values({
            eventId, criterionId: criterion.id, evaluatorUserId,
            score: String(s.score), comments: s.comment, commentVisibility: "internal",
            status: "submitted", submittedAt: new Date(),
          });
          evaluationsCreated++;
          insertedThisRun.add(pairKey);
          if (criterion.responsibleAreaId) areaAssignmentPairs.add(`${criterion.responsibleAreaId}:${evaluatorUserId}`);
        }
      }

      for (const pair of areaAssignmentPairs) {
        const [areaIdStr, userIdStr] = pair.split(":");
        await tx.insert(eventAreaAssignmentsTable).values({
          eventId, areaId: Number(areaIdStr), evaluatorUserId: Number(userIdStr),
        }).onConflictDoNothing({ target: [eventAreaAssignmentsTable.eventId, eventAreaAssignmentsTable.areaId, eventAreaAssignmentsTable.evaluatorUserId] });
        assignmentsCreated++;
      }

      const conformityAnswers: Partial<Record<ConformityField, boolean>> = {};
      for (const r of eventRows) {
        for (const field of ["epi", "estaiamentos", "guardaEquipamentos", "conduta"] as const) {
          const v = r.conformity[field];
          if (v === undefined) continue;
          conformityAnswers[field] = conformityAnswers[field] === false ? false : v;
        }
      }
      if (Object.keys(conformityAnswers).length > 0) {
        const [existingConformity] = await tx.select().from(eventConformitiesTable).where(eq(eventConformitiesTable.eventId, eventId));
        if (existingConformity) {
          const mergedAnswers: Partial<Record<ConformityField, boolean>> = { ...conformityAnswers };
          for (const field of ["epi", "estaiamentos", "guardaEquipamentos", "conduta"] as const) {
            const existingValue = existingConformity[field];
            if (existingValue === false) {
              mergedAnswers[field] = false;
            } else if (existingValue === true && mergedAnswers[field] === undefined) {
              mergedAnswers[field] = true;
            }
          }
          await tx.update(eventConformitiesTable).set({ ...mergedAnswers, updatedAt: new Date() }).where(eq(eventConformitiesTable.eventId, eventId));
        } else {
          await tx.insert(eventConformitiesTable).values({ eventId, createdByUserId: userId, ...conformityAnswers });
        }
        conformitiesUpserted++;
      }

      affectedCycleIds.add(targetEvent.cycleId);
      eventsUpdated++;
    }

    // Migração global de event_criteria: todos os eventos não-históricos cujos
    // resultados ainda NÃO foram confirmados devem ter os critérios antigos
    // removidos e os novos ativados — independente de aparecerem na planilha.
    // Eventos já processados no loop acima são ignorados (já migrados).
    // Eventos com results_confirmed=true são preservados intactos.
    if (retiredCriteriaIds.length > 0 || targetCriteriaByName.size > 0) {
      const allMigratableEvents = await tx
        .select({ id: eventsTable.id, cycleId: eventsTable.cycleId })
        .from(eventsTable)
        .where(and(eq(eventsTable.isHistorical, false), eq(eventsTable.resultsConfirmed, false)));

      for (const ev of allMigratableEvents) {
        if (rowsByEventId.has(ev.id)) continue; // já processado no loop principal

        if (retiredCriteriaIds.length > 0) {
          await tx.delete(eventCriteriaTable).where(
            and(eq(eventCriteriaTable.eventId, ev.id), inArray(eventCriteriaTable.criterionId, retiredCriteriaIds)),
          );
        }

        const existingECs = await tx.select().from(eventCriteriaTable).where(eq(eventCriteriaTable.eventId, ev.id));
        const existingByCritId = new Map(existingECs.map(ec => [ec.criterionId, ec]));
        for (const c of targetCriteriaByName.values()) {
          const existing = existingByCritId.get(c.id);
          if (!existing) {
            await tx.insert(eventCriteriaTable).values({ eventId: ev.id, criterionId: c.id, active: true });
          } else if (!existing.active) {
            await tx.update(eventCriteriaTable).set({ active: true }).where(eq(eventCriteriaTable.id, existing.id));
          }
        }

        affectedCycleIds.add(ev.cycleId);
      }
    }
  });

  const cycleWarnings: string[] = [];
  for (const cycleId of affectedCycleIds) {
    const { warnings: w } = await recomputeCycleResults(cycleId, userId);
    cycleWarnings.push(...w);
  }

  await audit(userId, "import_survey", "events", undefined, null, {
    usersCreated, evaluationsCreated, evaluationsSkipped, assignmentsCreated, conformitiesUpserted, eventsUpdated,
  });

  res.json({
    success: true, dryRun: false, usersCreated, evaluationsCreated, evaluationsSkipped, assignmentsCreated, conformitiesUpserted, eventsUpdated,
    createdAvaliadores, errors: [], ...preview, warnings: [...warnings, ...cycleWarnings],
  });
});

// Migração standalone do catálogo de critérios — mesma lógica do commit do
// survey import, mas sem precisar de uma planilha. Pode ser executada sempre
// que o catálogo global precisar ser atualizado (idempotente).
// Também migra event_criteria de TODOS os eventos (incluindo históricos e
// com results_confirmed=true), ao contrário do resync-all que só toca os
// não-confirmados.
router.post("/integration/migrate-criteria-catalog", requireRole("admin"), async (req, res) => {
  const userId = req.user!.userId;

  const criteriaByName = new Map<string, { id: number; active: boolean }>();
  const allCriteria = await db.select({ id: criteriaTable.id, name: criteriaTable.name, active: criteriaTable.active }).from(criteriaTable);
  for (const c of allCriteria) criteriaByName.set(normalizeImportText(c.name), { id: c.id, active: c.active });

  let catalogDeactivated = 0;
  let catalogActivated = 0;
  let catalogCreated = 0;
  let eventCriteriaFixed = 0;
  let evaluationsRemapped = 0;

  // Build target criteria map (after upsert)
  const targetCriteriaByName = new Map<string, { id: number }>();

  await db.transaction(async (tx) => {
    // 1. Deactivate retired criteria globally
    for (const name of SURVEY_CRITERIA_RETIRED) {
      const c = criteriaByName.get(normalizeImportText(name));
      if (c?.active) {
        await tx.update(criteriaTable).set({ active: false }).where(eq(criteriaTable.id, c.id));
        catalogDeactivated++;
      }
    }

    // 2. Activate / create target criteria with correct weights
    for (const tc of SURVEY_TARGET_CRITERIA) {
      const existing = criteriaByName.get(normalizeImportText(tc.name));
      const area = await tx.select({ id: areasTable.id }).from(areasTable).where(eq(areasTable.name, tc.areaName)).limit(1);
      const areaId = area[0]?.id ?? null;

      if (existing) {
        await tx.update(criteriaTable).set({
          active: true, defaultWeight: tc.weight, description: tc.description,
          ...(areaId ? { responsibleAreaId: areaId } : {}),
        }).where(eq(criteriaTable.id, existing.id));
        if (!existing.active) catalogActivated++;
        targetCriteriaByName.set(normalizeImportText(tc.name), { id: existing.id });
      } else {
        const [created] = await tx.insert(criteriaTable).values({
          name: tc.name, description: tc.description, defaultWeight: tc.weight,
          active: true, responsibleAreaId: areaId,
        }).returning({ id: criteriaTable.id });
        catalogCreated++;
        targetCriteriaByName.set(normalizeImportText(tc.name), { id: created.id });
      }
    }

    const retiredCriteriaIds = SURVEY_CRITERIA_RETIRED
      .map(name => criteriaByName.get(normalizeImportText(name))?.id)
      .filter((id): id is number => id !== undefined);

    // 3. Migrate event_criteria for ALL events (including historical/confirmed)
    const allEvents = await tx.select({ id: eventsTable.id }).from(eventsTable);
    for (const ev of allEvents) {
      let changed = false;
      // 3a. Deactivate old retired criteria in event_criteria (mark inactive, don't delete,
      //     so we preserve history but they stop counting for scoring)
      if (retiredCriteriaIds.length > 0) {
        const deactivated = await tx.update(eventCriteriaTable)
          .set({ active: false })
          .where(and(eq(eventCriteriaTable.eventId, ev.id), inArray(eventCriteriaTable.criterionId, retiredCriteriaIds), eq(eventCriteriaTable.active, true)));
        if ((deactivated as unknown as { rowCount: number }).rowCount > 0) changed = true;
      }
      // 3b. Add or reactivate new target criteria
      const existingECs = await tx.select().from(eventCriteriaTable).where(eq(eventCriteriaTable.eventId, ev.id));
      const existingByCritId = new Map(existingECs.map(ec => [ec.criterionId, ec]));
      for (const c of targetCriteriaByName.values()) {
        const existing = existingByCritId.get(c.id);
        if (!existing) {
          await tx.insert(eventCriteriaTable).values({ eventId: ev.id, criterionId: c.id, active: true });
          changed = true;
        } else if (!existing.active) {
          await tx.update(eventCriteriaTable).set({ active: true }).where(eq(eventCriteriaTable.id, existing.id));
          changed = true;
        }
      }
      if (changed) eventCriteriaFixed++;
    }

    // 4. Remap evaluations that still reference old criteria → new equivalents
    //    (happens when survey was imported before the catalog was corrected)
    for (const { oldName, newName } of SURVEY_CRITERIA_REMAP) {
      const oldCrit = criteriaByName.get(normalizeImportText(oldName));
      const newCrit = targetCriteriaByName.get(normalizeImportText(newName));
      if (!oldCrit || !newCrit) continue;
      const result = await tx.update(evaluationsTable)
        .set({ criterionId: newCrit.id })
        .where(eq(evaluationsTable.criterionId, oldCrit.id));
      evaluationsRemapped += (result as unknown as { rowCount: number }).rowCount ?? 0;
    }
  });

  await audit(userId, "migrate_criteria_catalog", "criteria", undefined, null, {
    catalogDeactivated, catalogActivated, catalogCreated, eventCriteriaFixed,
  });

  res.json({ success: true, catalogDeactivated, catalogActivated, catalogCreated, eventCriteriaFixed, evaluationsRemapped });
});

// Remove avaliações duplicadas: cópias EXATAS (mesmo evento, quesito, avaliador,
// nota e comentário) mantendo a primeira gravada. Duplicatas com conteúdo
// diferente (ex.: duas perguntas do Forms que mapeiam para o mesmo quesito)
// NÃO são tocadas. Após a limpeza, os resultados dos ciclos afetados são
// recalculados.
router.post("/integration/evaluations/dedupe", requireRole("admin"), async (req, res) => {
  const userId = req.user!.userId;
  const { dryRun } = req.body ?? {};
  const isDryRun = dryRun !== false;

  const all = await db.select({
    id: evaluationsTable.id,
    eventId: evaluationsTable.eventId,
    criterionId: evaluationsTable.criterionId,
    evaluatorUserId: evaluationsTable.evaluatorUserId,
    score: evaluationsTable.score,
    comments: evaluationsTable.comments,
    status: evaluationsTable.status,
    audioUrl: evaluationsTable.audioUrl,
  }).from(evaluationsTable);

  const byContent = new Map<string, number[]>();
  for (const e of all) {
    const key = `${e.eventId}|${e.criterionId}|${e.evaluatorUserId}|${e.score}|${e.comments ?? ""}|${e.status}|${e.audioUrl ?? ""}`;
    if (!byContent.has(key)) byContent.set(key, []);
    byContent.get(key)!.push(e.id);
  }

  const idsToDelete: number[] = [];
  const affectedEventIds = new Set<number>();
  let groupsAffected = 0;
  const idToEventId = new Map(all.map(e => [e.id, e.eventId]));
  for (const ids of byContent.values()) {
    if (ids.length <= 1) continue;
    groupsAffected++;
    const sorted = [...ids].sort((a, b) => a - b);
    for (const id of sorted.slice(1)) {
      idsToDelete.push(id);
      const evId = idToEventId.get(id);
      if (evId != null) affectedEventIds.add(evId);
    }
  }

  if (isDryRun || idsToDelete.length === 0) {
    res.json({
      success: true, dryRun: true,
      duplicatesFound: idsToDelete.length, groupsAffected, eventsAffected: affectedEventIds.size,
      duplicatesRemoved: 0, warnings: [],
    });
    return;
  }

  const affectedEvents = await db.select({ id: eventsTable.id, cycleId: eventsTable.cycleId })
    .from(eventsTable).where(inArray(eventsTable.id, Array.from(affectedEventIds)));
  const affectedCycleIds = new Set(affectedEvents.map(e => e.cycleId));

  await db.delete(evaluationsTable).where(inArray(evaluationsTable.id, idsToDelete));

  const cycleWarnings: string[] = [];
  for (const cycleId of affectedCycleIds) {
    const { warnings: w } = await recomputeCycleResults(cycleId, userId);
    cycleWarnings.push(...w);
  }

  await audit(userId, "dedupe_evaluations", "evaluations", undefined, null, {
    duplicatesRemoved: idsToDelete.length, groupsAffected, eventsAffected: affectedEventIds.size,
  });

  res.json({
    success: true, dryRun: false,
    duplicatesFound: idsToDelete.length, groupsAffected, eventsAffected: affectedEventIds.size,
    duplicatesRemoved: idsToDelete.length, warnings: cycleWarnings,
  });
});

// Reativa event_criteria que estão inativos mas têm avaliações submetidas.
// Isso acontece quando o catálogo de quesitos é migrado DEPOIS que avaliadores
// já submeteram respostas para os quesitos antigos — as avaliações ficam
// "órfãs" (criterio inativo, avaliação existe). Operação idempotente e segura.
router.post("/integration/fix-orphaned-evaluations", requireRole("admin"), async (req, res) => {
  const userId = req.user!.userId;

  // Encontra event_criteria inativos que têm pelo menos uma avaliação submetida
  const orphaned = await db
    .selectDistinct({
      eventCriteriaId: eventCriteriaTable.id,
      eventId: eventCriteriaTable.eventId,
      criterionId: eventCriteriaTable.criterionId,
    })
    .from(eventCriteriaTable)
    .innerJoin(
      evaluationsTable,
      and(
        eq(evaluationsTable.eventId, eventCriteriaTable.eventId),
        eq(evaluationsTable.criterionId, eventCriteriaTable.criterionId),
        eq(evaluationsTable.status, "submitted"),
      ),
    )
    .where(eq(eventCriteriaTable.active, false));

  if (orphaned.length === 0) {
    res.json({ fixed: 0, eventsAffected: 0, criteriaReactivated: [] });
    return;
  }

  const ids = orphaned.map(r => r.eventCriteriaId);
  await db.update(eventCriteriaTable).set({ active: true }).where(inArray(eventCriteriaTable.id, ids));

  const affectedEventIds = [...new Set(orphaned.map(r => r.eventId))];
  const criteriaReactivated = orphaned.map(r => ({ eventId: r.eventId, criterionId: r.criterionId }));

  await audit(userId, "fix_orphaned_evaluations", "event_criteria", undefined, null, {
    fixed: ids.length,
    eventsAffected: affectedEventIds.length,
  });

  res.json({ fixed: ids.length, eventsAffected: affectedEventIds.length, criteriaReactivated });
});

export default router;
