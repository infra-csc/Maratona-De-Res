import { Router } from "express";
import {
  db, eventsTable, employeesTable, eventParticipantsTable, criteriaTable, eventCriteriaTable,
  usersTable, absencesTable, quarterlyResultsTable, employeeCycleEligibilityTable, auditLogsTable,
  cyclesTable,
} from "@workspace/db";
import { isNotNull, inArray, eq, and, ne } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import { getCurrentCycle } from "../lib/cycle.js";
import { recomputeCycleResults } from "./results.js";

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
    const windowLabel = cycleStartDate && cycleEndDate
      ? `ciclo ${cycleStartDate} a ${cycleEndDate}`
      : `ano ${TARGET_YEAR} (ciclo sem datas definidas)`;
    log(`Filtro: eventos do ${windowLabel} (${keptEvents.length}/${extEvents.length} na janela; demais fora do período do ciclo), participações Cenotécnica/Cenotécnica Local (${keptParticipations.length}/${extParticipations.length}), colaboradores participantes (${keptEmployees.length}/${extEmployees.length}).`);

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
  const { csvData, dryRun } = req.body ?? {};
  const isDryRun = dryRun !== false;
  if (!csvData || typeof csvData !== "string") { res.status(400).json({ error: "csvData obrigatório" }); return; }

  const { rows, parseErrors } = parseHistoricalCsv(csvData);
  const errors: string[] = [...parseErrors];
  const unmatched: string[] = [];
  const ambiguous: string[] = [];

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
  const allCycles = await db.select().from(cyclesTable);

  type GroupPlan = {
    eventName: string; date: string; score: number | null; participantsCount: number;
    matchedCount: number; action: "create" | "update" | "conflict"; existingEventId?: number; cycleId?: number;
  };
  const plans: GroupPlan[] = [];

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

    let action: GroupPlan["action"];
    let existingEventId: number | undefined;
    let cycleId: number | undefined;
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
      if (!cycle) {
        errors.push(`Evento "${g.eventName}" (${g.date}): nenhum ciclo cobre esta data — configure o ciclo antes de importar`);
        action = "conflict";
      } else {
        action = "create";
        cycleId = cycle.id;
      }
    }

    plans.push({ eventName: g.eventName, date: g.date, score, participantsCount: g.participants.length, matchedCount, action, existingEventId, cycleId });
    (g as Group & { _plan?: GroupPlan })._plan = { eventName: g.eventName, date: g.date, score, participantsCount: g.participants.length, matchedCount, action, existingEventId, cycleId };
  }

  const preview = {
    totalRows: rows.length,
    matched: parsed.filter(r => r.employeeId !== null).length,
    unmatched,
    ambiguous,
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
      if (plan.action === "create") {
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

export default router;
