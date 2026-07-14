import { useGetIntegrationStatus, useTriggerSync, useImportEmployeesCSV, useImportHistoricalResults, useImportSurvey, useGetEvents, getGetEventsQueryKey, useResetAllData, useDedupeEvaluations, useFixCalibrationCriteria, useMigrateCriteriaCatalog, useFixOrphanedEvaluations, getGetIntegrationStatusQueryKey, type HistoricalImportResult, type SurveyImportResult, type DedupeEvaluationsResult, type FixCalibrationCriteria200, type FixOrphanedEvaluations200 } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Database, RefreshCw, Upload, CheckCircle2, XCircle, FileSpreadsheet, Calendar, Users, Briefcase, AlertTriangle, Trash2, ShieldAlert, History, ClipboardList, KeyRound, Eraser, Wrench, CalendarCheck } from "lucide-react";
import { getAuthToken } from "@/lib/custom-fetch";
import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const RESET_CONFIRM_PHRASE = "ZERAR TUDO";

// -----------------------------------------------------------------------------
// Leitura da planilha da pesquisa de avaliadores (export do MS Forms).
// Em vez de exigir um layout fixo de colunas, localizamos a aba de respostas
// (aquela cujo cabeçalho tem "Evento que está avaliando...") e mapeamos cada
// coluna pelo TEXTO do cabeçalho, remontando as linhas no layout canônico de
// 29 colunas que a API espera. Isso permite subir o arquivo bruto exportado
// do Forms, mesmo com colunas extras (Hora de início/conclusão/Email) ou em
// ordem diferente.
// -----------------------------------------------------------------------------

const SURVEY_CANONICAL_COLS = 29;

function normalizeHeaderText(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ") // inclui espaços não-quebráveis (U+00A0) que o Forms usa
    .toLowerCase()
    .trim();
}

// target = índice no layout canônico (SURVEY_COL do servidor);
// hasComment = a coluna imediatamente à direita é o "Comentários ou Justificativa" dela.
const SURVEY_HEADER_MAP: { target: number; hasComment?: boolean; match: (h: string) => boolean }[] = [
  { target: 2, match: (h) => h.startsWith("seu nome") },
  { target: 3, match: (h) => h.startsWith("evento que esta avaliando") },
  { target: 4, match: (h) => h.startsWith("selecione a area") },
  { target: 5, hasComment: true, match: (h) => h.startsWith("perda de material") },
  { target: 7, hasComment: true, match: (h) => h.startsWith("logistica reversa") },
  { target: 9, hasComment: true, match: (h) => h.startsWith("qualidade da entrega") && !h.includes("(2)") },
  { target: 11, hasComment: true, match: (h) => h.startsWith("qualidade da entrega") && h.includes("(2)") },
  { target: 13, hasComment: true, match: (h) => h.startsWith("prazo de entrega") },
  { target: 15, hasComment: true, match: (h) => h.startsWith("todos os equipamentos") },
  { target: 17, hasComment: true, match: (h) => h.startsWith("carga na saida do galpao") },
  { target: 19, hasComment: true, match: (h) => h.startsWith("todos usaram epi") },
  { target: 21, hasComment: true, match: (h) => h.startsWith("estaiamento") },
  { target: 23, hasComment: true, match: (h) => h.startsWith("conduta e comportamento") },
  { target: 25, match: (h) => h.startsWith("alguem faltou") },
  { target: 26, match: (h) => h.startsWith("algum profissional") },
  { target: 27, match: (h) => h.startsWith("conte quem se destacou") },
  { target: 28, match: (h) => h.startsWith("classifique o nivel") },
];

function extractSurveyRows(workbook: XLSX.WorkBook): (string | number | null)[][] | null {
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const allRows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, raw: false, defval: "" });
    for (let headerIdx = 0; headerIdx < Math.min(3, allRows.length); headerIdx++) {
      const headers = (allRows[headerIdx] ?? []).map(normalizeHeaderText);
      if (!headers.some((h) => h.startsWith("evento que esta avaliando"))) continue;
      const used = new Set<number>();
      const sourceByTarget: { target: number; src: number; hasComment: boolean }[] = [];
      let complete = true;
      for (const spec of SURVEY_HEADER_MAP) {
        const src = headers.findIndex((h, i) => !used.has(i) && h !== "" && spec.match(h));
        if (src === -1) { complete = false; break; }
        used.add(src);
        sourceByTarget.push({ target: spec.target, src, hasComment: !!spec.hasComment });
      }
      if (!complete) continue;
      return allRows
        .slice(headerIdx + 1)
        .filter((r) => Array.isArray(r) && r.some((cell) => String(cell ?? "").trim() !== ""))
        .map((r) => {
          const out: (string | number | null)[] = new Array(SURVEY_CANONICAL_COLS).fill("");
          for (const { target, src, hasComment } of sourceByTarget) {
            out[target] = r[src] ?? "";
            if (hasComment) out[target + 1] = r[src + 1] ?? "";
          }
          return out;
        });
    }
  }
  return null;
}

type SyncResult = {
  success: boolean;
  message: string;
  eventsSync?: number;
  employeesSync?: number;
  participantsSync?: number;
};

export default function IntegrationPage() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const historicalFileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [historicalCsvData, setHistoricalCsvData] = useState<string | null>(null);
  const [historicalPreview, setHistoricalPreview] = useState<HistoricalImportResult | null>(null);
  const [historicalDialogOpen, setHistoricalDialogOpen] = useState(false);
  const [linkOverrides, setLinkOverrides] = useState<Record<string, number>>({});
  const surveyFileRef = useRef<HTMLInputElement>(null);
  const [surveyRows, setSurveyRows] = useState<(string | number | null)[][] | null>(null);
  const [surveyPreview, setSurveyPreview] = useState<SurveyImportResult | null>(null);
  const [surveyDialogOpen, setSurveyDialogOpen] = useState(false);
  const [surveyLinkOverrides, setSurveyLinkOverrides] = useState<Record<string, number>>({});
  const [surveyCommitResult, setSurveyCommitResult] = useState<SurveyImportResult | null>(null);
  const [dedupePreview, setDedupePreview] = useState<DedupeEvaluationsResult | null>(null);
  const [dedupeDialogOpen, setDedupeDialogOpen] = useState(false);

  const qKey = getGetIntegrationStatusQueryKey();
  const { data: status, isLoading } = useGetIntegrationStatus({ query: { queryKey: qKey } });
  const eventsQueryKey = getGetEventsQueryKey();
  const { data: allEventsForLink } = useGetEvents(undefined, { query: { queryKey: eventsQueryKey, enabled: surveyDialogOpen } });
  const eventLinkOptions = useMemo(
    () => [...(allEventsForLink ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [allEventsForLink],
  );

  const resetMutation = useResetAllData({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Dados apagados", description: data.message });
        setResetDialogOpen(false);
        setResetConfirmText("");
        qc.invalidateQueries();
      },
      onError: (e: { message?: string }) => {
        toast({ title: "Falha ao resetar dados", description: e.message ?? "Tente novamente.", variant: "destructive" });
      },
    },
  });

  const dedupePreviewMutation = useDedupeEvaluations({
    mutation: {
      onSuccess: (data) => {
        setDedupePreview(data);
        setDedupeDialogOpen(true);
      },
      onError: (e: { message?: string }) => {
        toast({ title: "Falha ao verificar duplicatas", description: e.message ?? "Tente novamente.", variant: "destructive" });
      },
    },
  });

  const dedupeCommitMutation = useDedupeEvaluations({
    mutation: {
      onSuccess: (data) => {
        toast({
          title: "Duplicatas removidas",
          description: `${data.duplicatesRemoved} avaliação(ões) duplicada(s) apagada(s) em ${data.eventsAffected} evento(s). Resultados recalculados.`,
        });
        if (data.warnings && data.warnings.length > 0) {
          toast({ title: "Avisos", description: data.warnings.slice(0, 3).join(", "), variant: "destructive" });
        }
        setDedupeDialogOpen(false);
        setDedupePreview(null);
        qc.invalidateQueries();
      },
      onError: (e: { message?: string }) => {
        toast({ title: "Falha ao remover duplicatas", description: e.message ?? "Tente novamente.", variant: "destructive" });
      },
    },
  });

  const migrateCriteriaMutation = useMigrateCriteriaCatalog({
    mutation: {
      onSuccess: (data) => {
        toast({
          title: "Migração concluída",
          description: `${data.catalogActivated} quesito(s) ativado(s), ${data.catalogDeactivated} desativado(s), ${data.catalogCreated} criado(s). ${data.eventCriteriaFixed} evento(s) atualizados. ${(data as { evaluationsRemapped?: number }).evaluationsRemapped ?? 0} avaliação(ões) remapeadas para o catálogo novo.`,
        });
        qc.invalidateQueries();
      },
      onError: (e: { message?: string }) => {
        toast({ title: "Falha na migração", description: e.message ?? "Tente novamente.", variant: "destructive" });
      },
    },
  });

  const [fixOrphanedResult, setFixOrphanedResult] = useState<FixOrphanedEvaluations200 | null>(null);
  const [fixOrphanedDialogOpen, setFixOrphanedDialogOpen] = useState(false);
  const fixOrphanedMutation = useFixOrphanedEvaluations({
    mutation: {
      onSuccess: (data) => {
        setFixOrphanedResult(data);
        setFixOrphanedDialogOpen(true);
        qc.invalidateQueries();
      },
      onError: (e: { message?: string }) => {
        toast({ title: "Falha na correção", description: e.message ?? "Tente novamente.", variant: "destructive" });
      },
    },
  });

  const [dateSyncPreview, setDateSyncPreview] = useState<{ externalId: string; name: string; date: string }[] | null>(null);
  const [dateSyncPending, setDateSyncPending] = useState(false);
  const [dateSyncResult, setDateSyncResult] = useState<{ updated: number; notFound: number; notFoundIds: string[] } | null>(null);
  const dateSyncFileRef = useRef<HTMLInputElement>(null);

  const [fixCalResult, setFixCalResult] = useState<FixCalibrationCriteria200 | null>(null);
  const [fixCalDialogOpen, setFixCalDialogOpen] = useState(false);
  const fixCalMutation = useFixCalibrationCriteria({
    mutation: {
      onSuccess: (data) => {
        setFixCalResult(data);
        setFixCalDialogOpen(true);
        qc.invalidateQueries();
      },
      onError: (e: { message?: string }) => {
        toast({ title: "Falha na correção de calibrações", description: e.message ?? "Tente novamente.", variant: "destructive" });
      },
    },
  });

  const syncMutation = useTriggerSync({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: qKey });
        setResult({ ...data, success: true });
      },
      onError: (e: { message?: string }) => {
        setResult({
          success: false,
          message: e.message ?? "Não foi possível concluir a sincronização.",
          eventsSync: 0,
          employeesSync: 0,
          participantsSync: 0,
        });
      },
    },
  });

  const importMutation = useImportEmployeesCSV({
    mutation: {
      onSuccess: (data) => {
        toast({ title: `${data.inserted} colaborador(es) importado(s)` });
        if (data.errors.length > 0) {
          toast({ title: "Avisos de importação", description: data.errors.slice(0, 3).join(", "), variant: "destructive" });
        }
      },
    },
  });

  const historicalPreviewMutation = useImportHistoricalResults({
    mutation: {
      onSuccess: (data) => {
        setHistoricalPreview(data);
        setHistoricalDialogOpen(true);
      },
      onError: (e: { message?: string }) => {
        toast({ title: "Falha ao ler arquivo", description: e.message ?? "Tente novamente.", variant: "destructive" });
      },
    },
  });

  const historicalCommitMutation = useImportHistoricalResults({
    mutation: {
      onSuccess: (data) => {
        const employeesCreatedMsg = data.employeesCreated ? `, ${data.employeesCreated} colaborador(es) novo(s) cadastrado(s)` : "";
        toast({
          title: "Resultados históricos importados",
          description: `${data.eventsCreated ?? 0} evento(s) criado(s), ${data.eventsUpdated ?? 0} atualizado(s), ${data.participantsLinked ?? 0} participação(ões) vinculada(s)${employeesCreatedMsg}.`,
        });
        if (data.warnings && data.warnings.length > 0) {
          toast({ title: "Avisos", description: data.warnings.slice(0, 3).join(", "), variant: "destructive" });
        }
        setHistoricalDialogOpen(false);
        setHistoricalPreview(null);
        setHistoricalCsvData(null);
        qc.invalidateQueries();
      },
      onError: (e: { message?: string }) => {
        toast({ title: "Falha ao importar", description: e.message ?? "Tente novamente.", variant: "destructive" });
      },
    },
  });

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const csvData = ev.target?.result as string;
      importMutation.mutate({ data: { csvData } });
    };
    reader.readAsText(file);
  }

  function handleHistoricalFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const csvData = ev.target?.result as string;
      setHistoricalCsvData(csvData);
      setLinkOverrides({});
      historicalPreviewMutation.mutate({ data: { csvData, dryRun: true } });
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleHistoricalConfirm() {
    if (!historicalCsvData) return;
    historicalCommitMutation.mutate({ data: { csvData: historicalCsvData, dryRun: false, linkOverrides } });
  }

  const surveyPreviewMutation = useImportSurvey({
    mutation: {
      onSuccess: (data) => {
        setSurveyPreview(data);
        setSurveyDialogOpen(true);
      },
      onError: (e: { message?: string }) => {
        toast({ title: "Falha ao ler arquivo", description: e.message ?? "Tente novamente.", variant: "destructive" });
      },
    },
  });

  const surveyCommitMutation = useImportSurvey({
    mutation: {
      onSuccess: (data) => {
        toast({
          title: "Pesquisa de avaliadores importada",
          description: `${data.usersCreated ?? 0} avaliador(es) criado(s), ${data.evaluationsCreated ?? 0} avaliação(ões) gravada(s), ${data.conformitiesUpserted ?? 0} conformidade(s) atualizada(s), ${data.eventsUpdated ?? 0} evento(s) atualizado(s).`,
        });
        if (data.warnings && data.warnings.length > 0) {
          toast({ title: "Avisos", description: data.warnings.slice(0, 3).join(", "), variant: "destructive" });
        }
        setSurveyDialogOpen(false);
        setSurveyPreview(null);
        setSurveyRows(null);
        setSurveyLinkOverrides({});
        if (data.createdAvaliadores && data.createdAvaliadores.length > 0) {
          setSurveyCommitResult(data);
        }
        qc.invalidateQueries();
      },
      onError: (e: { message?: string }) => {
        toast({ title: "Falha ao importar", description: e.message ?? "Tente novamente.", variant: "destructive" });
      },
    },
  });

  async function handleSurveyFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const rows = extractSurveyRows(workbook);
      if (!rows || rows.length === 0) {
        toast({
          title: "Planilha não reconhecida",
          description: 'Não encontrei a aba de respostas do Forms (cabeçalho "Evento que está avaliando..."). Verifique se o arquivo é o export correto.',
          variant: "destructive",
        });
        e.target.value = "";
        return;
      }
      setSurveyRows(rows);
      setSurveyLinkOverrides({});
      surveyPreviewMutation.mutate({ data: { rows, dryRun: true } });
    } catch {
      toast({ title: "Falha ao ler arquivo", description: "Verifique se o arquivo é uma planilha .xlsx válida.", variant: "destructive" });
    }
    e.target.value = "";
  }

  function handleSurveyConfirm() {
    if (!surveyRows) return;
    surveyCommitMutation.mutate({ data: { rows: surveyRows, dryRun: false, linkOverrides: surveyLinkOverrides } });
  }

  const surveyAllResolved = !!surveyPreview && surveyPreview.groups.every((g) => !!surveyLinkOverrides[g.groupKey]);

  function handleDateSyncFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.arrayBuffer().then(buffer => {
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false }) as string[][];
      const parsed = rows.slice(1)
        .filter(r => r[1] && r[3])
        .map(r => {
          const parts = String(r[3]).split("/");
          if (parts.length !== 3) return null;
          const [m, d, y] = parts;
          const year = parseInt(y) < 100 ? 2000 + parseInt(y) : parseInt(y);
          const date = `${year}-${String(parseInt(m)).padStart(2,"0")}-${String(parseInt(d)).padStart(2,"0")}`;
          return { externalId: String(r[1]).trim(), name: String(r[2]).trim(), date };
        })
        .filter((x): x is { externalId: string; name: string; date: string } => x !== null);
      setDateSyncPreview(parsed);
      setDateSyncResult(null);
    }).catch(() => toast({ title: "Erro ao ler arquivo", variant: "destructive" }));
    e.target.value = "";
  }

  async function handleDateSyncApply() {
    if (!dateSyncPreview) return;
    setDateSyncPending(true);
    try {
      const token = getAuthToken();
      const res = await fetch("/api/events/bulk-date-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ updates: dateSyncPreview.map(e => ({ externalId: e.externalId, name: e.name, date: e.date })) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Erro desconhecido");
      const data = await res.json() as { updated: number; notFound: number; notFoundIds: string[] };
      setDateSyncResult(data);
      setDateSyncPreview(null);
      toast({ title: `${data.updated} evento(s) atualizado(s)${data.notFound > 0 ? `, ${data.notFound} não encontrado(s)` : ""}` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Tente novamente.";
      toast({ title: "Falha ao atualizar datas", description: msg, variant: "destructive" });
    } finally {
      setDateSyncPending(false);
    }
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto bg-slate-50/30 min-h-full">
      <div>
        <h1 data-testid="text-page-title" className="text-3xl font-bold flex items-center gap-3 tracking-tight text-foreground">
          <Database size={28} className="text-primary" /> Integração & Dados
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Conexão com sistemas externos e importação em lote.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <RefreshCw size={18} className="text-primary" /> API Externa (ERP)
            </CardTitle>
            <CardDescription>Sincronização automática de eventos e participações.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-6 p-3 rounded-lg border bg-slate-50">
              <span className="text-sm font-bold uppercase tracking-wider text-slate-500">Status da Conexão</span>
              {isLoading ? (
                <div className="h-5 w-24 bg-slate-200 animate-pulse rounded"></div>
              ) : status?.configured ? (
                <span className="flex items-center gap-1.5 text-sm font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                  <CheckCircle2 size={14} /> Operante
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-sm font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                  <XCircle size={14} /> Não Configurada
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                <Calendar size={18} className="mx-auto text-slate-400 mb-2" />
                <p className="text-2xl font-black text-slate-800">{status?.eventsImported ?? "0"}</p>
                <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Eventos</p>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                <Users size={18} className="mx-auto text-slate-400 mb-2" />
                <p className="text-2xl font-black text-slate-800">{status?.employeesImported ?? "0"}</p>
                <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Colaboradores</p>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                <Briefcase size={18} className="mx-auto text-slate-400 mb-2" />
                <p className="text-2xl font-black text-slate-800">{status?.participantsImported ?? "0"}</p>
                <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Participações</p>
              </div>
            </div>

            <Button
              data-testid="button-trigger-sync"
              className="w-full shadow-sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || !status?.configured}
            >
              <RefreshCw size={16} className={`mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              {syncMutation.isPending ? "Buscando dados..." : "Forçar Sincronização Agora"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-green-600" /> Importação Manual
            </CardTitle>
            <CardDescription>Carga em lote via arquivo CSV.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 flex flex-col h-full">
            <div className="flex-1">
              <h4 className="font-bold text-slate-800 mb-2">Colaboradores</h4>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                Faça upload de uma planilha contendo a base de funcionários para popular o sistema rapidamente.
              </p>
              
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-xs text-slate-600 mb-6">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 font-sans tracking-widest">Colunas Obrigatórias (Header)</p>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-white px-2 py-1 rounded border shadow-sm">nome</span>
                  <span className="bg-white px-2 py-1 rounded border shadow-sm">departamento</span>
                  <span className="bg-white px-2 py-1 rounded border shadow-sm">funcao</span>
                </div>
              </div>
            </div>

            <div className="mt-auto">
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
                data-testid="input-csv-file"
              />
              <Button
                data-testid="button-import-employees"
                variant="outline" 
                className="w-full bg-white shadow-sm border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-colors"
                onClick={() => fileRef.current?.click()}
                disabled={importMutation.isPending}
              >
                <Upload size={16} className="mr-2 text-primary" />
                {importMutation.isPending ? "Processando arquivo..." : "Selecionar arquivo CSV"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <History size={18} className="text-amber-600" /> Resultados Históricos
          </CardTitle>
          <CardDescription>
            Importa provas antigas cuja nota final já veio pronta/calibrada de fora (sem avaliação por critério).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-sm text-slate-600 leading-relaxed mb-4">
            Cria eventos já <strong>fechados</strong> com a nota informada aplicada diretamente ao time.
            Sempre mostra uma <strong>pré-visualização</strong> antes de gravar qualquer coisa.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-xs text-slate-600 mb-6">
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 font-sans tracking-widest">Colunas (Header opcional)</p>
            <div className="flex flex-wrap gap-2">
              <span className="bg-white px-2 py-1 rounded border shadow-sm">nome</span>
              <span className="bg-white px-2 py-1 rounded border shadow-sm">nota</span>
              <span className="bg-white px-2 py-1 rounded border shadow-sm">evento</span>
              <span className="bg-white px-2 py-1 rounded border shadow-sm">data</span>
            </div>
          </div>

          <input
            ref={historicalFileRef}
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={handleHistoricalFileUpload}
            data-testid="input-historical-csv-file"
          />
          <Button
            data-testid="button-import-historical"
            variant="outline"
            className="w-full bg-white shadow-sm border-dashed border-2 border-amber-300 hover:border-amber-500 hover:bg-amber-50 transition-colors"
            onClick={() => historicalFileRef.current?.click()}
            disabled={historicalPreviewMutation.isPending}
          >
            <Upload size={16} className="mr-2 text-amber-600" />
            {historicalPreviewMutation.isPending ? "Lendo arquivo..." : "Selecionar arquivo (pré-visualizar)"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <ClipboardList size={18} className="text-blue-600" /> Pesquisa de Avaliadores
          </CardTitle>
          <CardDescription>
            Importa a planilha de respostas da pesquisa (uma linha por avaliador/evento) — cria avaliadores, vincula a eventos já cadastrados e grava notas por critério e conformidade.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-sm text-slate-600 leading-relaxed mb-4">
            Cada evento da planilha precisa ser <strong>vinculado manualmente</strong> a um evento já existente no sistema — esta importação nunca cria eventos novos.
            Também atualiza o catálogo de critérios (ativa "Carga na Saída do Galpão" e desativa 3 critérios antigos). Sempre mostra uma <strong>pré-visualização</strong> antes de gravar qualquer coisa.
          </p>

          <input
            ref={surveyFileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleSurveyFileUpload}
            data-testid="input-survey-xlsx-file"
          />
          <Button
            data-testid="button-import-survey"
            variant="outline"
            className="w-full bg-white shadow-sm border-dashed border-2 border-blue-300 hover:border-blue-500 hover:bg-blue-50 transition-colors"
            onClick={() => surveyFileRef.current?.click()}
            disabled={surveyPreviewMutation.isPending}
          >
            <Upload size={16} className="mr-2 text-blue-600" />
            {surveyPreviewMutation.isPending ? "Lendo planilha..." : "Selecionar planilha (pré-visualizar)"}
          </Button>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Eraser size={18} className="text-violet-600" /> Limpar Avaliações Duplicadas
            </CardTitle>
            <CardDescription>
              Remove cópias exatas de avaliações (mesmo evento, quesito, avaliador, nota e comentário), mantendo a primeira gravada. Útil após uma importação repetida.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Avaliações com <strong>conteúdo diferente</strong> nunca são tocadas. Após a limpeza, os resultados dos ciclos afetados são <strong>recalculados automaticamente</strong>.
              Sempre mostra uma <strong>pré-visualização</strong> antes de apagar qualquer coisa.
            </p>
            <Button
              data-testid="button-dedupe-evaluations"
              variant="outline"
              className="w-full bg-white shadow-sm border-dashed border-2 border-violet-300 hover:border-violet-500 hover:bg-violet-50 transition-colors"
              onClick={() => dedupePreviewMutation.mutate({ data: { dryRun: true } })}
              disabled={dedupePreviewMutation.isPending}
            >
              <Eraser size={16} className="mr-2 text-violet-600" />
              {dedupePreviewMutation.isPending ? "Verificando..." : "Verificar duplicatas (pré-visualizar)"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card className="border-none shadow-sm bg-white overflow-hidden border-l-4 border-l-amber-500">
          <CardHeader className="bg-amber-50 border-b border-amber-100 pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-amber-800">
              <Wrench size={18} /> Corrigir Calibrações (Migração de Quesitos)
            </CardTitle>
            <CardDescription className="text-amber-800/80">
              Recupera calibrações feitas com os quesitos antigos (nomes longos) e remapeia para os equivalentes atuais.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Quando o catálogo de quesitos foi migrado (nomes longos → curtos), as calibrações gravadas ficaram referenciando os IDs antigos e deixaram de aparecer na tela.
              Este botão corrige os IDs de todas as calibrações afetadas de uma vez. <strong>Operação segura e idempotente</strong> — pode ser executada mais de uma vez sem problema.
            </p>
            <Button
              data-testid="button-fix-calibration-criteria"
              variant="outline"
              className="w-full bg-white shadow-sm border-dashed border-2 border-amber-400 hover:border-amber-600 hover:bg-amber-50 transition-colors"
              onClick={() => fixCalMutation.mutate()}
              disabled={fixCalMutation.isPending}
            >
              <Wrench size={16} className="mr-2 text-amber-600" />
              {fixCalMutation.isPending ? "Corrigindo..." : "Corrigir calibrações agora"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card className="border-none shadow-sm bg-white overflow-hidden border-l-4 border-l-purple-500">
          <CardHeader className="bg-purple-50 border-b border-purple-100 pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-purple-800">
              <Wrench size={18} /> Migrar Catálogo de Quesitos
            </CardTitle>
            <CardDescription className="text-purple-800/80">
              Relaciona os 5 quesitos ativos da Matriz de Performance com todos os eventos e remapeia avaliações que ainda referenciam quesitos antigos — incluindo históricos e confirmados.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Aplica a migração do catálogo de critérios sem precisar importar uma planilha.
              Desfaz a vinculação com quesitos antigos e ativa os novos em <strong>todos os eventos</strong>.
              <strong> Operação idempotente</strong> — segura de executar mais de uma vez.
            </p>
            <Button
              data-testid="button-migrate-criteria-catalog"
              variant="outline"
              className="w-full bg-white shadow-sm border-dashed border-2 border-purple-400 hover:border-purple-600 hover:bg-purple-50 transition-colors"
              onClick={() => migrateCriteriaMutation.mutate()}
              disabled={migrateCriteriaMutation.isPending}
            >
              <Wrench size={16} className="mr-2 text-purple-600" />
              {migrateCriteriaMutation.isPending ? "Migrando..." : "Executar migração de quesitos"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card className="border-none shadow-sm bg-white overflow-hidden border-l-4 border-l-teal-500">
          <CardHeader className="bg-teal-50 border-b border-teal-100 pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-teal-800">
              <Wrench size={18} /> Corrigir Avaliações Órfãs
            </CardTitle>
            <CardDescription className="text-teal-800/80">
              Reativa quesitos desativados que ainda têm avaliações submetidas — evitando que notas desapareçam do evento.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Quando o catálogo de quesitos é migrado <strong>depois</strong> que avaliadores já submeteram respostas, as avaliações ficam vinculadas a quesitos inativos e somem da visualização do evento.
              Este botão detecta e reativa automaticamente esses vínculos. <strong>Operação segura e idempotente.</strong>
            </p>
            <Button
              data-testid="button-fix-orphaned-evaluations"
              variant="outline"
              className="w-full bg-white shadow-sm border-dashed border-2 border-teal-400 hover:border-teal-600 hover:bg-teal-50 transition-colors"
              onClick={() => fixOrphanedMutation.mutate()}
              disabled={fixOrphanedMutation.isPending}
            >
              <Wrench size={16} className="mr-2 text-teal-600" />
              {fixOrphanedMutation.isPending ? "Corrigindo..." : "Reativar quesitos com avaliações"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card className="border-none shadow-sm bg-white overflow-hidden border-l-4 border-l-blue-500">
          <CardHeader className="bg-blue-50 border-b border-blue-100 pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-blue-800">
              <CalendarCheck size={18} /> Atualizar Datas dos Eventos
            </CardTitle>
            <CardDescription className="text-blue-800/80">
              Importa a planilha de eventos (colunas: SKU, ID Evento, Evento, Data Evento) e define a data de cada evento usando o ID externo como chave.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              Útil quando os eventos têm data única (não período). O sistema iguala <strong>início = fim = data da planilha</strong> para cada evento localizado pelo ID externo.
            </p>

            <input ref={dateSyncFileRef} type="file" accept=".xlsx" className="hidden" onChange={handleDateSyncFileUpload} />
            <Button
              variant="outline"
              className="w-full bg-white shadow-sm border-dashed border-2 border-blue-400 hover:border-blue-600 hover:bg-blue-50 transition-colors"
              onClick={() => { setDateSyncPreview(null); setDateSyncResult(null); dateSyncFileRef.current?.click(); }}
            >
              <Upload size={16} className="mr-2 text-blue-600" />
              Selecionar planilha .xlsx
            </Button>

            {dateSyncPreview && (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-bold text-blue-800">{dateSyncPreview.length} evento(s) encontrado(s) na planilha</span>
                  <span className="text-xs text-blue-600">{dateSyncPreview[0]?.date} → {dateSyncPreview[dateSyncPreview.length - 1]?.date}</span>
                </div>
                <div className="max-h-40 overflow-y-auto border rounded-lg divide-y text-xs">
                  {dateSyncPreview.slice(0, 10).map(e => (
                    <div key={e.externalId} className="px-3 py-1.5 flex items-center justify-between gap-2 bg-white">
                      <span className="text-slate-600 truncate">{e.name}</span>
                      <span className="font-mono font-bold text-blue-700 shrink-0">{e.date}</span>
                    </div>
                  ))}
                  {dateSyncPreview.length > 10 && (
                    <div className="px-3 py-1.5 text-slate-400 text-center">+{dateSyncPreview.length - 10} mais…</div>
                  )}
                </div>
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={dateSyncPending}
                  onClick={handleDateSyncApply}
                >
                  <CalendarCheck size={16} className="mr-2" />
                  {dateSyncPending ? "Atualizando…" : `Aplicar ${dateSyncPreview.length} datas em produção`}
                </Button>
              </div>
            )}

            {dateSyncResult && (
              <div className={`rounded-lg px-4 py-3 border text-sm font-medium flex items-start gap-2 ${dateSyncResult.notFound > 0 ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-green-50 border-green-200 text-green-800"}`}>
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p>{dateSyncResult.updated} evento(s) atualizado(s){dateSyncResult.notFound > 0 ? `, ${dateSyncResult.notFound} ID(s) não encontrado(s) no banco` : " com sucesso."}.</p>
                  {dateSyncResult.notFoundIds.length > 0 && (
                    <p className="text-xs mt-1 opacity-70">IDs não encontrados: {dateSyncResult.notFoundIds.join(", ")}</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card className="border-none shadow-sm bg-white overflow-hidden border-l-4 border-l-red-500">
          <CardHeader className="bg-red-50 border-b border-red-100 pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-red-700">
              <ShieldAlert size={18} /> Zona de Risco
            </CardTitle>
            <CardDescription className="text-red-700/80">
              Reset de dados operacionais de produção. Ação irreversível.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Apaga <strong>eventos, avaliações/notas, colaboradores e usuários</strong> (exceto o seu próprio login).
              Áreas, quesitos, ciclo atual e faixas de bônus <strong>são preservados</strong>.
              Use para reiniciar o cadastro de produção do zero.
            </p>
            <Button
              data-testid="button-open-reset-dialog"
              variant="destructive"
              className="w-full"
              onClick={() => setResetDialogOpen(true)}
            >
              <Trash2 size={16} className="mr-2" /> Resetar Dados Operacionais
            </Button>
          </CardContent>
        </Card>
      )}

      {status?.logs && status.logs.length > 0 && (
        <Card className="border-none shadow-sm bg-black text-slate-300 font-mono text-xs overflow-hidden">
          <CardHeader className="border-b border-white/10 pb-3 py-3 px-4 bg-white/5">
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              Terminal de Execução
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 max-h-[300px] overflow-y-auto">
            <div className="space-y-1.5">
              {status.logs.map((log, i) => {
                const isError = log.toLowerCase().includes("erro") || log.toLowerCase().includes("fail");
                return (
                  <p key={i} className={`flex items-start gap-2 ${isError ? 'text-red-400' : ''}`}>
                    <span className="text-slate-600 shrink-0">{format(new Date(), "HH:mm:ss", { locale: ptBR })}</span>
                    <span className="break-all">{log}</span>
                  </p>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!result} onOpenChange={(open) => { if (!open) setResult(null); }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-sync-result">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {result?.success ? (
                <>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle2 className="text-green-600" size={20} />
                  </span>
                  Sincronização concluída
                </>
              ) : (
                <>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100">
                    <AlertTriangle className="text-red-600" size={20} />
                  </span>
                  Falha na sincronização
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {result?.success
                ? "Apenas eventos de 2026 já finalizados e participações de Cenotécnica / Cenotécnico (e variantes) / Sup Ceno foram importados. Registros existentes são atualizados, nunca duplicados."
                : result?.message}
            </DialogDescription>
          </DialogHeader>

          {result?.success && (
            <div className="grid grid-cols-3 gap-3 py-2">
              <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                <Calendar size={18} className="mx-auto text-slate-400 mb-2" />
                <p className="text-2xl font-black text-slate-800" data-testid="text-result-events">{result.eventsSync ?? 0}</p>
                <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Eventos</p>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                <Users size={18} className="mx-auto text-slate-400 mb-2" />
                <p className="text-2xl font-black text-slate-800" data-testid="text-result-employees">{result.employeesSync ?? 0}</p>
                <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Colaboradores</p>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                <Briefcase size={18} className="mx-auto text-slate-400 mb-2" />
                <p className="text-2xl font-black text-slate-800" data-testid="text-result-participants">{result.participantsSync ?? 0}</p>
                <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Participações</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setResult(null)} className="w-full" data-testid="button-close-result">
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetDialogOpen} onOpenChange={(open) => { setResetDialogOpen(open); if (!open) setResetConfirmText(""); }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-reset-confirm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <ShieldAlert className="text-red-600" size={20} />
              Confirmar reset de dados
            </DialogTitle>
            <DialogDescription>
              Isso vai apagar permanentemente <strong>todos os eventos, avaliações/notas, colaboradores e usuários</strong> (menos o seu login).
              Áreas, quesitos, ciclo e regras não serão afetados. Não é possível desfazer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-sm font-medium text-slate-700">
              Digite <span className="font-mono font-bold">{RESET_CONFIRM_PHRASE}</span> para confirmar
            </label>
            <Input
              data-testid="input-reset-confirm"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder={RESET_CONFIRM_PHRASE}
              autoComplete="off"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setResetDialogOpen(false)}
              disabled={resetMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              data-testid="button-confirm-reset"
              variant="destructive"
              disabled={resetConfirmText !== RESET_CONFIRM_PHRASE || resetMutation.isPending}
              onClick={() => resetMutation.mutate({ data: { confirm: resetConfirmText } })}
            >
              <Trash2 size={16} className="mr-2" />
              {resetMutation.isPending ? "Apagando..." : "Apagar dados"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fixOrphanedDialogOpen} onOpenChange={(open) => { setFixOrphanedDialogOpen(open); if (!open) setFixOrphanedResult(null); }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-fix-orphaned-result">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench size={20} className="text-teal-600" />
              Avaliações órfãs corrigidas
            </DialogTitle>
            <DialogDescription>
              {(fixOrphanedResult?.fixed ?? 0) === 0
                ? "Nenhum quesito órfão encontrado — tudo já está correto."
                : `${fixOrphanedResult?.fixed} quesito(s) reativados em ${fixOrphanedResult?.eventsAffected} evento(s).`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFixOrphanedDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fixCalDialogOpen} onOpenChange={(open) => { setFixCalDialogOpen(open); if (!open) setFixCalResult(null); }}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-fix-cal-result">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench size={20} className="text-amber-600" />
              Calibrações corrigidas
            </DialogTitle>
            <DialogDescription>
              {(fixCalResult?.totalUpdated ?? 0) === 0
                ? "Nenhuma calibração precisou ser atualizada — já estão com os IDs corretos."
                : `${fixCalResult?.totalUpdated} calibração(ões) atualizadas com sucesso.`}
            </DialogDescription>
          </DialogHeader>
          {fixCalResult && (fixCalResult.results?.length ?? 0) > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="text-left p-2">De (quesito antigo)</th>
                    <th className="text-left p-2">Para (quesito atual)</th>
                    <th className="text-right p-2">Qtd</th>
                  </tr>
                </thead>
                <tbody>
                  {fixCalResult.results?.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="p-2 text-slate-600">{r.from}</td>
                      <td className="p-2 font-medium text-slate-800">{r.to}</td>
                      <td className="p-2 text-right font-bold">{r.updated}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <DialogFooter>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => setFixCalDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dedupeDialogOpen} onOpenChange={(open) => { setDedupeDialogOpen(open); if (!open) setDedupePreview(null); }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-dedupe-confirm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eraser size={20} className="text-violet-600" />
              Avaliações duplicadas encontradas
            </DialogTitle>
            <DialogDescription>
              Nada foi apagado ainda. Confira os números antes de confirmar a limpeza.
            </DialogDescription>
          </DialogHeader>

          {dedupePreview && (
            dedupePreview.duplicatesFound === 0 ? (
              <div className="py-4 text-center">
                <CheckCircle2 size={32} className="mx-auto text-green-600 mb-2" />
                <p className="text-sm font-medium text-slate-700" data-testid="text-dedupe-none">Nenhuma avaliação duplicada encontrada. Está tudo limpo!</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 py-2">
                <div className="bg-violet-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-black text-violet-700" data-testid="text-dedupe-found">{dedupePreview.duplicatesFound}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Cópias a apagar</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-black text-slate-800" data-testid="text-dedupe-groups">{dedupePreview.groupsAffected}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Notas afetadas</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-black text-slate-800" data-testid="text-dedupe-events">{dedupePreview.eventsAffected}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Eventos</p>
                </div>
              </div>
            )
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {dedupePreview && dedupePreview.duplicatesFound === 0 ? (
              <Button className="w-full" onClick={() => setDedupeDialogOpen(false)} data-testid="button-close-dedupe">
                Entendi
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setDedupeDialogOpen(false)}
                  disabled={dedupeCommitMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  data-testid="button-confirm-dedupe"
                  disabled={dedupeCommitMutation.isPending}
                  onClick={() => dedupeCommitMutation.mutate({ data: { dryRun: false } })}
                >
                  <Eraser size={16} className="mr-2" />
                  {dedupeCommitMutation.isPending ? "Limpando..." : "Confirmar limpeza"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historicalDialogOpen} onOpenChange={(open) => { setHistoricalDialogOpen(open); if (!open) { setHistoricalPreview(null); setHistoricalCsvData(null); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-historical-preview">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History size={20} className="text-amber-600" />
              Pré-visualização da importação
            </DialogTitle>
            <DialogDescription>
              Nada foi gravado no banco ainda. Confira com atenção tudo o que vai acontecer — evento por evento — antes de confirmar. Depois de confirmar, os eventos entram como resultados históricos (nota já fechada, sem avaliação por critério).
            </DialogDescription>
          </DialogHeader>

          {historicalPreview && (() => {
            const eventsToCreate = historicalPreview.events.filter(ev => ev.action === "create").length;
            const eventsToUpdate = historicalPreview.events.filter(ev => ev.action === "update").length;
            const eventsBlocked = historicalPreview.events.filter(ev => ev.action === "conflict").length;
            const participantsToLink = historicalPreview.events.reduce((sum, ev) => sum + ev.matchedCount, 0);
            return (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xl font-black text-slate-800" data-testid="text-preview-total-rows">{historicalPreview.totalRows}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Linhas na planilha</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xl font-black text-slate-800" data-testid="text-preview-matched">{historicalPreview.matched}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Colaboradores já cadastrados</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xl font-black text-blue-700">{historicalPreview.employeesToCreate?.length ?? 0}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Colaboradores novos</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-xl border border-green-100">
                  <p className="text-xl font-black text-green-700">{eventsToCreate}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Eventos a criar</p>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-xl font-black text-amber-700">{eventsToUpdate}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Eventos a atualizar</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xl font-black text-slate-800">{participantsToLink}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Participações a vincular</p>
                </div>
              </div>

              {eventsBlocked > 0 && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <strong>{eventsBlocked} evento(s) não serão importados</strong> por causa dos erros listados abaixo — corrija a planilha e reenvie.
                </p>
              )}

              {historicalPreview.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs font-bold text-red-700 uppercase mb-1 flex items-center gap-1.5">
                    <AlertTriangle size={14} /> Erros ({historicalPreview.errors.length}) — bloqueiam a importação
                  </p>
                  <p className="text-[11px] text-red-600 mb-2">Enquanto houver erros abaixo, o botão de confirmar fica desabilitado. Corrija a planilha (ou os cadastros) e envie novamente.</p>
                  <ul className="text-xs text-red-700 space-y-1 max-h-40 overflow-y-auto">
                    {historicalPreview.errors.map((err, i) => <li key={i}>• {err}</li>)}
                  </ul>
                </div>
              )}

              {historicalPreview.employeesToCreate && historicalPreview.employeesToCreate.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs font-bold text-blue-700 uppercase mb-1 flex items-center gap-1.5">
                    <Users size={14} /> {historicalPreview.employeesToCreate.length} colaborador(es) novo(s) serão cadastrados
                  </p>
                  <p className="text-[11px] text-blue-600 mb-2">Esses nomes não bateram com nenhum colaborador já cadastrado. Ao confirmar, eles serão criados automaticamente (cadastro básico, sem área/função definida) e já entram participando do evento correspondente na tabela abaixo. Se algum nome estiver digitado errado, cancele e corrija a planilha antes de confirmar.</p>
                  <ul className="text-xs text-blue-700 space-y-1 max-h-32 overflow-y-auto">
                    {historicalPreview.employeesToCreate.map((name, i) => <li key={i}>• {name}</li>)}
                  </ul>
                </div>
              )}

              {historicalPreview.cycleFallback && historicalPreview.cycleFallback.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs font-bold text-blue-700 uppercase mb-1 flex items-center gap-1.5">
                    <Calendar size={14} /> {historicalPreview.cycleFallback.length} evento(s) fora do período do ciclo cadastrado
                  </p>
                  <p className="text-[11px] text-blue-600 mb-2">A data desses eventos não cai dentro do período de nenhum ciclo configurado. Em vez de bloquear, eles serão vinculados ao ciclo atual (indicado na tabela abaixo) para que os resultados entrem normalmente nos relatórios.</p>
                  <ul className="text-xs text-blue-700 space-y-1 max-h-32 overflow-y-auto">
                    {historicalPreview.cycleFallback.map((msg, i) => <li key={i}>• {msg}</li>)}
                  </ul>
                </div>
              )}

              {historicalPreview.events.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Detalhe evento por evento</p>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                        <tr>
                          <th className="text-left p-2">Evento</th>
                          <th className="text-left p-2">Data</th>
                          <th className="text-left p-2">Nota</th>
                          <th className="text-left p-2">Participantes</th>
                          <th className="text-left p-2">Ciclo</th>
                          <th className="text-left p-2">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historicalPreview.events.map((ev, i) => (
                          <tr key={i} className="border-t border-slate-100 align-top" data-testid={`row-preview-event-${i}`}>
                            <td className="p-2 font-medium text-slate-800">{ev.eventName}</td>
                            <td className="p-2 text-slate-600">{ev.date}</td>
                            <td className="p-2 text-slate-600">{ev.score ?? "—"}</td>
                            <td className="p-2 text-slate-600">
                              {ev.matchedCount}/{ev.participantsCount}
                              {ev.newEmployeeNames && ev.newEmployeeNames.length > 0 && (
                                <div className="text-[10px] text-blue-600 mt-0.5">
                                  {ev.newEmployeeNames.length} novo(s): {ev.newEmployeeNames.join(", ")}
                                </div>
                              )}
                            </td>
                            <td className="p-2 text-slate-600">
                              {ev.cycleName ?? "—"}
                              {ev.cycleFallback && (
                                <div className="text-[10px] text-blue-600 mt-0.5">fora do período (ciclo atual)</div>
                              )}
                            </td>
                            <td className="p-2">
                              {ev.action === "create" && !linkOverrides[ev.groupKey] && <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Criar</Badge>}
                              {ev.action === "create" && linkOverrides[ev.groupKey] && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Vincular</Badge>}
                              {ev.action === "update" && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Atualizar</Badge>}
                              {ev.action === "conflict" && <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Conflito</Badge>}
                              {ev.action === "create" && ev.overlapCandidates && ev.overlapCandidates.length > 0 && (
                                <div className="mt-1.5 min-w-[220px]" data-testid={`select-link-override-${i}`}>
                                  <p className="text-[10px] text-orange-700 bg-orange-50 border border-orange-200 rounded px-1.5 py-1 mb-1 flex items-start gap-1">
                                    <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                                    Já existe {ev.overlapCandidates.length === 1 ? "1 evento" : `${ev.overlapCandidates.length} eventos`} nessa data — pode ser a mesma corrida com nome diferente.
                                  </p>
                                  <Select
                                    value={linkOverrides[ev.groupKey] ? String(linkOverrides[ev.groupKey]) : "none"}
                                    onValueChange={(val) => {
                                      setLinkOverrides(prev => {
                                        const next = { ...prev };
                                        if (val === "none") delete next[ev.groupKey];
                                        else next[ev.groupKey] = Number(val);
                                        return next;
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="h-7 text-[11px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Criar evento novo</SelectItem>
                                      {ev.overlapCandidates.map(c => (
                                        <SelectItem key={c.id} value={String(c.id)}>
                                          Vincular a "{c.name}" ({c.isHistorical ? "histórico" : "manual"})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 space-y-0.5">
                    <span className="block"><Badge className="bg-green-100 text-green-700 hover:bg-green-100 mr-1">Criar</Badge>evento novo, ainda não existe no sistema.</span>
                    <span className="block"><Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 mr-1">Atualizar</Badge>já existe um evento histórico com este nome/data — a nota será substituída pela da planilha.</span>
                    <span className="block"><Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 mr-1">Vincular</Badge>você escolheu ligar esse evento a um já existente (veja o alerta laranja e o seletor na linha) em vez de criar um novo.</span>
                    <span className="block"><Badge className="bg-red-100 text-red-700 hover:bg-red-100 mr-1">Conflito</Badge>não será importado (veja o motivo nos erros acima).</span>
                  </p>
                </div>
              )}
            </div>
            );
          })()}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setHistoricalDialogOpen(false)} disabled={historicalCommitMutation.isPending}>
              Cancelar
            </Button>
            <Button
              data-testid="button-confirm-historical-import"
              className="bg-amber-600 hover:bg-amber-700"
              disabled={!historicalPreview?.success || historicalPreview.errors.length > 0 || historicalCommitMutation.isPending}
              onClick={handleHistoricalConfirm}
            >
              <CheckCircle2 size={16} className="mr-2" />
              {historicalCommitMutation.isPending ? "Importando..." : "Confirmar e importar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={surveyDialogOpen} onOpenChange={(open) => { setSurveyDialogOpen(open); if (!open) { setSurveyPreview(null); setSurveyRows(null); setSurveyLinkOverrides({}); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList size={20} className="text-blue-600" />
              Pré-visualização da pesquisa de avaliadores
            </DialogTitle>
            <DialogDescription>
              Nada foi gravado no banco ainda. Vincule <strong>cada evento</strong> da planilha a um evento já existente no sistema antes de confirmar. Nenhum evento novo será criado.
            </DialogDescription>
          </DialogHeader>

          {surveyPreview && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xl font-black text-slate-800" data-testid="text-survey-total-rows">{surveyPreview.totalRows}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Linhas na planilha</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xl font-black text-slate-800">{surveyPreview.groups.length}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Eventos na planilha</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-xl font-black text-blue-700">{surveyPreview.avaliadoresToCreate.length}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Avaliadores novos</p>
                </div>
              </div>

              {surveyPreview.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs font-bold text-red-700 uppercase mb-1 flex items-center gap-1.5">
                    <AlertTriangle size={14} /> Erros ({surveyPreview.errors.length}) — bloqueiam a importação
                  </p>
                  <ul className="text-xs text-red-700 space-y-1 max-h-40 overflow-y-auto">
                    {surveyPreview.errors.map((err, i) => <li key={i}>• {err}</li>)}
                  </ul>
                </div>
              )}

              {(surveyPreview.catalogChanges.toDeactivate.length > 0 || surveyPreview.catalogChanges.toCreateOrActivate.length > 0) && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <p className="text-xs font-bold text-purple-700 uppercase mb-1 flex items-center gap-1.5">
                    <Briefcase size={14} /> Mudanças no catálogo de critérios
                  </p>
                  {surveyPreview.catalogChanges.toCreateOrActivate.length > 0 && (
                    <p className="text-[11px] text-purple-700 mb-1">
                      <strong>Ativar/criar:</strong> {surveyPreview.catalogChanges.toCreateOrActivate.join(", ")}
                    </p>
                  )}
                  {surveyPreview.catalogChanges.toDeactivate.length > 0 && (
                    <p className="text-[11px] text-purple-700">
                      <strong>Desativar:</strong> {surveyPreview.catalogChanges.toDeactivate.join(", ")}
                    </p>
                  )}
                </div>
              )}

              {surveyPreview.avaliadoresToCreate.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs font-bold text-blue-700 uppercase mb-1 flex items-center gap-1.5">
                    <Users size={14} /> {surveyPreview.avaliadoresToCreate.length} avaliador(es) novo(s) serão cadastrados
                  </p>
                  <p className="text-[11px] text-blue-600 mb-2">Ao confirmar, cada um recebe um usuário com senha provisória (mostrada uma única vez logo após a importação).</p>
                  <ul className="text-xs text-blue-700 space-y-1 max-h-32 overflow-y-auto">
                    {surveyPreview.avaliadoresToCreate.map((name, i) => <li key={i}>• {name}</li>)}
                  </ul>
                </div>
              )}

              {surveyPreview.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-bold text-amber-700 uppercase mb-1 flex items-center gap-1.5">
                    <AlertTriangle size={14} /> Avisos ({surveyPreview.warnings.length})
                  </p>
                  <ul className="text-xs text-amber-700 space-y-1 max-h-32 overflow-y-auto">
                    {surveyPreview.warnings.map((w, i) => <li key={i}>• {w}</li>)}
                  </ul>
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Vincular cada evento da planilha</p>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                      <tr>
                        <th className="text-left p-2">Evento (planilha)</th>
                        <th className="text-left p-2">Linhas</th>
                        <th className="text-left p-2">Avaliadores</th>
                        <th className="text-left p-2 min-w-[240px]">Vincular a evento existente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {surveyPreview.groups.map((g, i) => {
                        const selectedId = surveyLinkOverrides[g.groupKey];
                        const isIgnored = selectedId === -1;
                        const selectedEvent = selectedId && !isIgnored
                          ? (g.suggestions.find(s => s.id === selectedId) ?? eventLinkOptions.find(e => e.id === selectedId))
                          : undefined;
                        return (
                          <tr key={g.groupKey} className="border-t border-slate-100 align-top" data-testid={`row-survey-group-${i}`}>
                            <td className="p-2 font-medium text-slate-800">{g.eventLabel}</td>
                            <td className="p-2 text-slate-600">{g.rowCount}</td>
                            <td className="p-2 text-slate-600">{g.distinctEvaluators}</td>
                            <td className="p-2">
                              <Select
                                value={selectedId ? String(selectedId) : "none"}
                                onValueChange={(val) => {
                                  setSurveyLinkOverrides(prev => {
                                    const next = { ...prev };
                                    if (val === "none") delete next[g.groupKey];
                                    else next[g.groupKey] = Number(val);
                                    return next;
                                  });
                                }}
                              >
                                <SelectTrigger className="h-7 text-[11px] w-full" data-testid={`select-survey-link-${i}`}>
                                  <SelectValue placeholder="Selecione um evento..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-64">
                                  <SelectItem value="none">— nenhum vínculo —</SelectItem>
                                  <SelectItem value="-1">✕ Ignorar estas respostas (não importar)</SelectItem>
                                  {g.suggestions.length > 0 && g.suggestions.map(s => (
                                    <SelectItem key={`sug-${s.id}`} value={String(s.id)}>
                                      ★ {s.name}{s.isHistorical ? " (histórico)" : ""}
                                    </SelectItem>
                                  ))}
                                  {eventLinkOptions.filter(e => !g.suggestions.some(s => s.id === e.id)).map(e => (
                                    <SelectItem key={e.id} value={String(e.id)}>
                                      {e.name}{e.isHistorical ? " (histórico)" : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {!selectedId && (
                                <p className="text-[10px] text-red-600 mt-1">Obrigatório — selecione um evento ou "Ignorar".</p>
                              )}
                              {isIgnored && (
                                <p className="text-[10px] text-slate-500 mt-1">Estas respostas serão ignoradas na importação.</p>
                              )}
                              {selectedEvent?.isHistorical && (
                                <p className="text-[10px] text-amber-700 mt-1">Evento histórico: só os comentários serão salvos como referência, sem notas.</p>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">★ = sugestão por semelhança de nome/cidade/data.</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSurveyDialogOpen(false)} disabled={surveyCommitMutation.isPending}>
              Cancelar
            </Button>
            <Button
              data-testid="button-confirm-survey-import"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!surveyPreview?.success || surveyPreview.errors.length > 0 || !surveyAllResolved || surveyCommitMutation.isPending}
              onClick={handleSurveyConfirm}
            >
              <CheckCircle2 size={16} className="mr-2" />
              {surveyCommitMutation.isPending ? "Importando..." : "Confirmar e importar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!surveyCommitResult} onOpenChange={(open) => { if (!open) setSurveyCommitResult(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound size={20} className="text-blue-600" />
              Credenciais dos avaliadores criados
            </DialogTitle>
            <DialogDescription>
              Estas senhas provisórias são exibidas <strong>apenas uma vez</strong>. Copie e distribua para cada avaliador antes de fechar esta janela.
            </DialogDescription>
          </DialogHeader>
          {surveyCommitResult?.createdAvaliadores && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="text-left p-2">Nome</th>
                    <th className="text-left p-2">E-mail</th>
                    <th className="text-left p-2">Senha provisória</th>
                  </tr>
                </thead>
                <tbody>
                  {surveyCommitResult.createdAvaliadores.map((a, i) => (
                    <tr key={i} className="border-t border-slate-100" data-testid={`row-created-avaliador-${i}`}>
                      <td className="p-2 font-medium text-slate-800">{a.name}</td>
                      <td className="p-2 text-slate-600 font-mono">{a.email}</td>
                      <td className="p-2 text-slate-600 font-mono">{a.tempPassword}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <DialogFooter>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setSurveyCommitResult(null)}>
              Já distribuí as senhas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
