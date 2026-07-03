import { useGetIntegrationStatus, useTriggerSync, useImportEmployeesCSV, useImportHistoricalResults, useResetAllData, getGetIntegrationStatusQueryKey, type HistoricalImportResult } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Database, RefreshCw, Upload, CheckCircle2, XCircle, FileSpreadsheet, Calendar, Users, Briefcase, AlertTriangle, Trash2, ShieldAlert, History } from "lucide-react";
import { useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const RESET_CONFIRM_PHRASE = "ZERAR TUDO";

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

  const qKey = getGetIntegrationStatusQueryKey();
  const { data: status, isLoading } = useGetIntegrationStatus({ query: { queryKey: qKey } });

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
              Áreas, quesitos, ciclo atual e regras de bonificação/pelotão <strong>são preservados</strong>.
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
                ? "Apenas eventos de 2026 já finalizados e participações de Cenotécnica / Cenotécnica Local foram importados. Registros existentes são atualizados, nunca duplicados."
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
    </div>
  );
}
