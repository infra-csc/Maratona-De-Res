import { useGetIntegrationStatus, useTriggerSync, useImportEmployeesCSV, getGetIntegrationStatusQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Database, RefreshCw, Upload, CheckCircle2, XCircle, FileSpreadsheet, Calendar, Users, Briefcase } from "lucide-react";
import { useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function IntegrationPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const qKey = getGetIntegrationStatusQueryKey();
  const { data: status, isLoading } = useGetIntegrationStatus({ query: { queryKey: qKey } });

  const syncMutation = useTriggerSync({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: data.message });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro na sincronização", description: e.message, variant: "destructive" }),
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
    </div>
  );
}
