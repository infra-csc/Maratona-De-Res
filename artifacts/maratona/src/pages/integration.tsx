import { useGetIntegrationStatus, useTriggerSync, useImportEmployeesCSV, getGetIntegrationStatusQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Database, RefreshCw, Upload, CheckCircle2, XCircle } from "lucide-react";
import { useRef } from "react";

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
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 data-testid="text-page-title" className="text-2xl font-bold flex items-center gap-2">
          <Database size={22} className="text-primary" /> Integração e Importação
        </h1>
        <p className="text-muted-foreground text-sm">Gerencie dados externos e importações CSV</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Status da Integração
            {isLoading ? null : status?.configured ? (
              <CheckCircle2 size={15} className="text-green-500" />
            ) : (
              <XCircle size={15} className="text-destructive" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-primary">{status?.eventsImported ?? "—"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Eventos</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-primary">{status?.employeesImported ?? "—"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Colaboradores</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-primary">{status?.participantsImported ?? "—"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Participações</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              data-testid="button-trigger-sync"
              variant="outline" size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <RefreshCw size={14} className={`mr-1.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              {syncMutation.isPending ? "Sincronizando..." : "Sincronizar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Importar Colaboradores via CSV</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            O arquivo CSV deve conter as colunas: <code className="text-xs bg-muted px-1 py-0.5 rounded">nome, departamento, funcao</code>
          </p>
          <div className="flex gap-2">
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
              variant="outline" size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={importMutation.isPending}
            >
              <Upload size={14} className="mr-1.5" />
              {importMutation.isPending ? "Importando..." : "Selecionar CSV"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {status?.logs && status.logs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Logs Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {status.logs.map((log, i) => (
                <p key={i} className="text-xs text-muted-foreground font-mono">{log}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
