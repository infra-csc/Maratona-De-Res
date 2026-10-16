// Sincronização com o sistema externo (ERP): situação da conexão, o que já
// está no banco, "Sincronizar agora" com confirmação do que acontece e o
// resultado no mesmo diálogo (inclui eventos de ciclo fechado deixados como
// estavam). Também o registro da última execução.
import { useState } from "react";
import { useTriggerSync, type getGetIntegrationStatusQueryKey, type IntegrationStatus, type SyncResult } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, Lock, PlugZap, RefreshCw, Terminal, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { serverMessage } from "../criteria/helpers";
import {
  ActionDialog, Bone, Chip, ClosedCycleSkipped, ConsequenceList, DoneBox, ErrorBox, NumberStrip, StatCell, btnPrimary, btnSecondary,
  dialogFooterCls, surfaceCls,
} from "./integration-ui";

type ErpSyncCardProps = {
  status: IntegrationStatus | undefined;
  isLoading: boolean;
  statusQueryKey: ReturnType<typeof getGetIntegrationStatusQueryKey>;
};

const fmtWhen = (iso: string | null | undefined) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

/** Estado da sincronização (o botão do topo e o painel usam o mesmo). */
export function useErpSync(statusQueryKey: ErpSyncCardProps["statusQueryKey"]) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<{ message: string; closed: boolean } | null>(null);
  const mutation = useTriggerSync({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: statusQueryKey });
        setResult({ ...data, success: true });
      },
      onError: (e: unknown) => {
        const data = (e as { data?: { cycleClosed?: boolean } } | null)?.data;
        qc.invalidateQueries({ queryKey: statusQueryKey });
        setError({ message: serverMessage(e) || "Não foi possível concluir a sincronização.", closed: data?.cycleClosed === true });
      },
    },
  });
  return {
    open, result, error, pending: mutation.isPending,
    start: () => { setResult(null); setError(null); setOpen(true); },
    run: () => { setError(null); mutation.mutate(); },
    close: () => { if (!mutation.isPending) { setOpen(false); } },
  };
}
export type ErpSyncState = ReturnType<typeof useErpSync>;

/** Botão "Sincronizar agora" (topo da tela e painel). */
export function SyncButton({ sync, status, className, testId = "button-trigger-sync" }: { sync: ErpSyncState; status: IntegrationStatus | undefined; className?: string; testId?: string }) {
  return (
    <button type="button" data-testid={testId} onClick={sync.start} disabled={sync.pending || !status?.configured}
      title={!status?.configured ? "A conexão com o sistema externo não está configurada" : undefined} className={className ?? btnPrimary}>
      <RefreshCw size={15} aria-hidden className={cn(sync.pending && "motion-safe:animate-spin")} />
      {sync.pending ? "Sincronizando…" : "Sincronizar agora"}
    </button>
  );
}

/** Painel: conexão, totais no banco e a última execução. */
export function ErpSyncCard({ status, isLoading, sync }: Omit<ErpSyncCardProps, "statusQueryKey"> & { sync: ErpSyncState }) {
  const last = fmtWhen(status?.lastSync);
  return (
    <section aria-label="Sincronização com o sistema externo" data-testid="erp-panel" className={cn(surfaceCls, "overflow-hidden")}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-border">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-foreground">
            <PlugZap size={16} aria-hidden className="text-muted-foreground" /> Sistema externo (ERP)
            {isLoading ? <Bone className="h-6 w-24" /> : status?.configured
              ? <Chip tone="ok" icon={CheckCircle2} data-testid="erp-status">Conectado</Chip>
              : <Chip tone="danger" icon={XCircle} data-testid="erp-status">Não configurado</Chip>}
          </p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Traz os eventos de 2026 já encerrados e a escalação de Cenotécnica / Cenotécnico / Sup Ceno. O que já existe é atualizado, nunca duplicado.
            {last ? <> Última execução: <span className="font-semibold text-foreground tabular-nums">{last}</span>.</> : " Nenhuma execução desde que o servidor subiu."}
          </p>
        </div>
        <SyncButton sync={sync} status={status} className={cn(btnSecondary, "self-start sm:hidden")} />
      </div>
      <div className="grid grid-cols-3 gap-px bg-border">
        <StatCell label="Eventos no banco" value={isLoading ? "—" : (status?.eventsImported ?? 0).toLocaleString("pt-BR")} />
        <StatCell label="Colaboradores" value={isLoading ? "—" : (status?.employeesImported ?? 0).toLocaleString("pt-BR")} />
        <StatCell label="Participações" value={isLoading ? "—" : (status?.participantsImported ?? 0).toLocaleString("pt-BR")} />
      </div>
    </section>
  );
}

/** Confirmação → sincronizando → resultado, num diálogo só. */
export function SyncDialog({ sync }: { sync: ErpSyncState }) {
  const r = sync.result;
  const done = !!r;
  return (
    <ActionDialog open={sync.open} onOpenChange={o => { if (!o) sync.close(); }} busy={sync.pending}
      icon={done ? CheckCircle2 : RefreshCw} tone={done ? "brand" : "neutral"}
      title={done ? "Sincronização concluída" : sync.error ? "A sincronização não foi feita" : "Sincronizar com o sistema externo?"}
      description={done || sync.error ? undefined : "Grava direto no banco. Leva alguns segundos."}
      testId={done ? "dialog-sync-result" : "dialog-sync-confirm"}>
      {!done && !sync.error && (
        <ConsequenceList items={[
          <>Importa os <span className="font-semibold text-foreground">eventos de 2026 já encerrados</span> e as participações de Cenotécnica / Cenotécnico / Sup Ceno.</>,
          <>Registros que já existem são <span className="font-semibold text-foreground">atualizados</span>, nunca duplicados.</>,
          <>Eventos de <span className="font-semibold text-foreground">ciclo fechado</span> ficam como estão. Com o ciclo atual fechado, nada é gravado.</>,
          <>No fim, o resultado do ciclo atual é recalculado.</>,
        ]} />
      )}
      {sync.error && (
        sync.error.closed
          ? <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-border bg-secondary/60 px-3.5 py-3 text-[13px] leading-snug">
              <Lock size={15} aria-hidden className="mt-[1px] shrink-0 text-muted-foreground" />
              <span><span className="block font-semibold text-foreground">Ciclo atual fechado</span><span className="block mt-0.5 text-muted-foreground">{sync.error.message}</span></span>
            </div>
          : <ErrorBox message={sync.error.message} title="Falha na sincronização" />
      )}
      {done && r && (
        <>
          <NumberStrip items={[
            { label: "Eventos", value: r.eventsSync ?? 0, testId: "text-result-events" },
            { label: "Colaboradores", value: r.employeesSync ?? 0, testId: "text-result-employees" },
            { label: "Participações", value: r.participantsSync ?? 0, testId: "text-result-participants" },
          ]} />
          <ClosedCycleSkipped items={r.skippedClosedCycle} />
          <DoneBox>O resultado do ciclo atual já foi recalculado com a escalação nova.</DoneBox>
        </>
      )}
      <div className={dialogFooterCls}>
        {done || sync.error ? (
          <button type="button" data-testid="button-close-result" onClick={sync.close} className={btnPrimary}>Fechar</button>
        ) : (
          <>
            <button type="button" onClick={sync.close} disabled={sync.pending} className={btnSecondary}>Cancelar</button>
            <button type="button" data-testid="button-confirm-sync" onClick={sync.run} disabled={sync.pending} aria-busy={sync.pending || undefined} className={btnPrimary}>
              <RefreshCw size={15} aria-hidden className={cn(sync.pending && "motion-safe:animate-spin")} />
              {sync.pending ? "Sincronizando…" : "Sincronizar"}
            </button>
          </>
        )}
      </div>
    </ActionDialog>
  );
}

/** Registro da última execução (o servidor guarda as linhas da última sincronização). */
export function IntegrationLogsCard({ logs }: { logs: string[] }) {
  const [open, setOpen] = useState(false);
  const errors = logs.filter(l => /erro|fail/i.test(l)).length;
  return (
    <section className={cn(surfaceCls, "overflow-hidden")} data-testid="integration-logs">
      <button type="button" aria-expanded={open} aria-controls="integration-logs-body" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 sm:px-5 py-3 text-left transition-colors duration-150 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        <Terminal size={15} aria-hidden className="text-muted-foreground" />
        <span className="flex-1 text-[14px] font-semibold text-foreground">Registro da última sincronização</span>
        <Chip className="h-5 text-[11px]">{logs.length} linhas</Chip>
        {errors > 0 && <Chip tone="danger" className="h-5 text-[11px]">{errors} com erro</Chip>}
        <ChevronDown size={16} aria-hidden className={cn("text-muted-foreground transition-transform duration-150", open && "rotate-180")} />
      </button>
      {open && (
        <ol id="integration-logs-body" className="border-t border-border bg-secondary/40 px-4 sm:px-5 py-3 max-h-[300px] overflow-y-auto font-mono text-[12px] leading-relaxed space-y-1">
          {logs.map((log, i) => (
            <li key={i} className={cn("break-all", /erro|fail/i.test(log) ? "text-[var(--status-danger-text)]" : "text-foreground/85")}>
              <span aria-hidden className="text-muted-foreground mr-2 tabular-nums">{String(i + 1).padStart(2, "0")}</span>{log}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
