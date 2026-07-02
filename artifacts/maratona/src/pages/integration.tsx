import { useGetIntegrationStatus, useTriggerSync, useImportEmployeesCSV, useResetAllData, getGetIntegrationStatusQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Database, RefreshCw, Upload, CheckCircle2, XCircle, FileSpreadsheet, Calendar, Users, Briefcase, AlertTriangle, Trash2, ShieldAlert } from "lucide-react";
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
  const [result, setResult] = useState<SyncResult | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");

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
    </div>
  );
}
