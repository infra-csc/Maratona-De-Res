import { useTriggerSync, type getGetIntegrationStatusQueryKey, type IntegrationStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RefreshCw, CheckCircle2, XCircle, Calendar, Users, Briefcase, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CONDENSED } from "@/lib/premium-theme";
import { DIALOG_STYLE } from "./shared";

type SyncResult = {
  success: boolean;
  message: string;
  eventsSync?: number;
  employeesSync?: number;
  participantsSync?: number;
};

type ErpSyncCardProps = {
  status: IntegrationStatus | undefined;
  isLoading: boolean;
  statusQueryKey: ReturnType<typeof getGetIntegrationStatusQueryKey>;
};

/**
 * Card "API Externa (ERP)": status da conexão, contadores e o botão de
 * sincronização forçada, mais o diálogo com o resultado da sincronização
 * (renderizado em portal, então a posição no JSX não afeta o layout).
 */
export function ErpSyncCard({ status, isLoading, statusQueryKey }: ErpSyncCardProps) {
  const qc = useQueryClient();
  const [result, setResult] = useState<SyncResult | null>(null);

  const syncMutation = useTriggerSync({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: statusQueryKey });
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

  return (
    <>
      <Card className="bg-card border border-border shadow-none overflow-hidden">
        <CardHeader className="bg-secondary border-b border-border pb-4">
          <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}>
            <RefreshCw size={18} className="text-primary" /> API Externa (ERP)
          </CardTitle>
          <CardDescription>Sincronização automática de eventos e participações.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6 p-3 rounded-lg border bg-secondary">
            <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Status da Conexão</span>
            {isLoading ? (
              <div className="h-5 w-24 bg-secondary animate-pulse rounded"></div>
            ) : status?.configured ? (
              <span className="flex items-center gap-1.5 text-sm font-bold text-accent-text bg-accent/10 px-2 py-0.5 rounded-full border border-accent/40">
                <CheckCircle2 size={14} /> Operante
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/30">
                <XCircle size={14} /> Não Configurada
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="text-center p-4 bg-secondary rounded-xl border border-border">
              <Calendar size={18} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-2xl font-black text-foreground" style={{ fontFamily: CONDENSED }}>{status?.eventsImported ?? "0"}</p>
              <p className="text-[11px] uppercase font-bold text-muted-foreground mt-1">Eventos</p>
            </div>
            <div className="text-center p-4 bg-secondary rounded-xl border border-border">
              <Users size={18} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-2xl font-black text-foreground" style={{ fontFamily: CONDENSED }}>{status?.employeesImported ?? "0"}</p>
              <p className="text-[11px] uppercase font-bold text-muted-foreground mt-1">Colaboradores</p>
            </div>
            <div className="text-center p-4 bg-secondary rounded-xl border border-border">
              <Briefcase size={18} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-2xl font-black text-foreground" style={{ fontFamily: CONDENSED }}>{status?.participantsImported ?? "0"}</p>
              <p className="text-[11px] uppercase font-bold text-muted-foreground mt-1">Participações</p>
            </div>
          </div>

          <Button
            data-testid="button-trigger-sync"
            className="w-full"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || !status?.configured}
          >
            <RefreshCw size={16} className={`mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            {syncMutation.isPending ? "Buscando dados..." : "Forçar Sincronização Agora"}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={!!result} onOpenChange={(open) => { if (!open) setResult(null); }}>
        <DialogContent className="sm:max-w-md rounded-xl border-border" style={DIALOG_STYLE} data-testid="dialog-sync-result">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {result?.success ? (
                <>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15">
                    <CheckCircle2 className="text-accent-text" size={20} />
                  </span>
                  Sincronização concluída
                </>
              ) : (
                <>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10">
                    <AlertTriangle className="text-destructive" size={20} />
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
              <div className="text-center p-4 bg-secondary rounded-xl border border-border">
                <Calendar size={18} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-2xl font-black text-foreground" style={{ fontFamily: CONDENSED }} data-testid="text-result-events">{result.eventsSync ?? 0}</p>
                <p className="text-[11px] uppercase font-bold text-muted-foreground mt-1">Eventos</p>
              </div>
              <div className="text-center p-4 bg-secondary rounded-xl border border-border">
                <Users size={18} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-2xl font-black text-foreground" style={{ fontFamily: CONDENSED }} data-testid="text-result-employees">{result.employeesSync ?? 0}</p>
                <p className="text-[11px] uppercase font-bold text-muted-foreground mt-1">Colaboradores</p>
              </div>
              <div className="text-center p-4 bg-secondary rounded-xl border border-border">
                <Briefcase size={18} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-2xl font-black text-foreground" style={{ fontFamily: CONDENSED }} data-testid="text-result-participants">{result.participantsSync ?? 0}</p>
                <p className="text-[11px] uppercase font-bold text-muted-foreground mt-1">Participações</p>
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
    </>
  );
}

/** "Terminal de Execução": últimos logs da integração devolvidos pelo status. */
export function IntegrationLogsCard({ logs }: { logs: string[] }) {
  return (
    <Card className="bg-secondary text-foreground border border-border shadow-none font-mono text-xs overflow-hidden">
      <CardHeader className="border-b border-border pb-3 py-3 px-4 bg-card">
        <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
          Terminal de Execução
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 max-h-[300px] overflow-y-auto">
        <div className="space-y-1.5">
          {logs.map((log, i) => {
            const isError = log.toLowerCase().includes("erro") || log.toLowerCase().includes("fail");
            return (
              <p key={i} className={`flex items-start gap-2 ${isError ? 'text-destructive' : ''}`}>
                <span className="text-muted-foreground shrink-0">{format(new Date(), "HH:mm:ss", { locale: ptBR })}</span>
                <span className="break-all">{log}</span>
              </p>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
