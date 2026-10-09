// Um diálogo para as três ações de manutenção: antes de rodar explica a
// consequência; rodando, trava; depois mostra o resultado (ou o erro) ali
// mesmo — sem toast que some antes de a pessoa ler.
import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, Loader2, RefreshCw, RotateCw, Wrench } from "lucide-react";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn, plural } from "@/lib/utils";
import { ConsequenceList, DialogHeading, Eyebrow, Notice, btnPrimary, btnSecondary, dialogCls, dialogFooterCls, useReturnFocus } from "./criteria-ui";
import type { CriteriaMaintenance, MaintenanceKind, MaintenanceState } from "./use-criteria-maintenance";

const CONFIG: Record<MaintenanceKind, {
  icon: typeof RefreshCw;
  title: string;
  description: string;
  consequences: ReactNode[];
  confirm: string;
  running: string;
  doneTitle: string;
}> = {
  labels: {
    icon: Building2,
    title: "Sincronizar rótulos de área?",
    description: "Regrava, em cada critério, o nome atual da área responsável.",
    consequences: [
      "Use depois de renomear uma área: o critério passa a mostrar o nome novo.",
      "Só mexe nos critérios com o nome desatualizado. Notas, pesos e eventos não mudam.",
      "Pode rodar de novo sem problema.",
    ],
    confirm: "Sincronizar rótulos",
    running: "Sincronizando…",
    doneTitle: "Rótulos sincronizados",
  },
  calibrations: {
    icon: Wrench,
    title: "Corrigir calibrações?",
    description: "Leva as calibrações feitas em critérios de nome antigo para o critério atual.",
    consequences: [
      <>Exemplo: o que foi calibrado em “Qualidade e Acabamento da Montagem” passa para “Qualidade da Entrega”.</>,
      "As notas dos avaliadores não mudam — só a calibração troca de critério.",
      "Eventos de ciclo fechado ficam como estão.",
      "Rodar de novo não repete a troca.",
    ],
    confirm: "Corrigir calibrações",
    running: "Corrigindo…",
    doneTitle: "Calibrações corrigidas",
  },
  resync: {
    icon: RefreshCw,
    title: "Sincronizar todos os eventos?",
    description: "Aplica o catálogo ativo aos eventos do ciclo atual.",
    consequences: [
      <><span className="font-semibold text-foreground">Passa por todos os eventos do ciclo atual</span>, inclusive os já confirmados.</>,
      "Inclui em cada evento os critérios ativos que ainda faltam.",
      "Desliga os critérios desativados no catálogo — menos os que já têm nota enviada.",
      "Critério desligado à mão num evento não volta. Ciclo fechado não é tocado.",
    ],
    confirm: "Sincronizar eventos",
    running: "Sincronizando eventos…",
    doneTitle: "Eventos sincronizados",
  },
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card px-3 py-2.5 min-w-0">
      <Eyebrow as="span" className="block truncate">{label}</Eyebrow>
      <span className="mt-1.5 block font-condensed text-[24px] font-black leading-none tabular-nums text-foreground">{value.toLocaleString("pt-BR")}</span>
    </div>
  );
}

function Result({ state }: { state: MaintenanceState }) {
  if (state.kind === "labels") {
    const n = state.labels ?? 0;
    return <p className="text-[14px] text-foreground" data-testid="maintenance-result">{n === 0 ? "Tudo já estava em dia: nenhum critério precisou mudar." : `${plural(n, "critério atualizado", "critérios atualizados")} com o nome atual da área.`}</p>;
  }
  if (state.kind === "calibrations") {
    const r = state.calibrations;
    if (!r) return null;
    const moved = r.results.filter(x => x.updated > 0);
    return (
      <div className="space-y-3" data-testid="maintenance-result">
        <p className="text-[14px] text-foreground">{r.totalUpdated === 0 ? "Nada a corrigir: nenhuma calibração estava em critério de nome antigo." : `${plural(r.totalUpdated, "calibração passou", "calibrações passaram")} para o critério atual.`}</p>
        {moved.length > 0 && (
          <ul className="rounded-xl border border-border divide-y divide-border">
            {moved.map(x => (
              <li key={x.from} className="px-3.5 py-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                <span className="text-muted-foreground">{x.from}</span>
                <ArrowRight size={13} aria-label="para" className="text-muted-foreground" />
                <span className="font-semibold text-foreground">{x.to}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">{x.updated.toLocaleString("pt-BR")}</span>
              </li>
            ))}
          </ul>
        )}
        {(r.skippedClosedCycle?.length ?? 0) > 0 && (
          <p className="text-[12.5px] text-muted-foreground">{plural(r.skippedClosedCycle!.length, "evento de ciclo fechado ficou", "eventos de ciclo fechado ficaram")} como estava.</p>
        )}
      </div>
    );
  }
  const s = state.resync;
  if (!s) return null;
  return (
    <div className="space-y-3" data-testid="maintenance-result">
      <div className="rounded-xl border border-border overflow-hidden grid grid-cols-2 sm:grid-cols-4 gap-px bg-border">
        <Stat label="Eventos" value={s.processed} />
        <Stat label="Incluídos" value={s.totalAdded} />
        <Stat label="Reativados" value={s.totalActivated} />
        <Stat label="Desligados" value={s.totalDeactivated} />
      </div>
      {s.processed === 0 && s.failures.length === 0 && (
        <p className="text-[14px] text-foreground">Todos os eventos já estavam de acordo com o catálogo ativo.</p>
      )}
      {s.skipped > 0 && (
        <p className="text-[12.5px] text-muted-foreground">
          {plural(s.skipped, "evento ficou de fora", "eventos ficaram de fora")}{s.skippedClosedCycle > 0 ? ` — ${s.skippedClosedCycle.toLocaleString("pt-BR")} de ciclo fechado` : ""}.
        </p>
      )}
      {s.failures.length > 0 && (
        <Notice icon={AlertTriangle} tone="warn" testId="resync-failures">
          <p className="font-semibold text-foreground">{plural(s.failures.length, "evento não sincronizou", "eventos não sincronizaram")}</p>
          <p className="mt-0.5">{s.failures.map(f => f.name).join(", ")}. Os outros seguiram normalmente; tente de novo mais tarde.</p>
        </Notice>
      )}
      {s.events.length > 0 && (
        <ul className="max-h-56 overflow-y-auto rounded-xl border border-border divide-y divide-border" aria-label="Eventos atualizados">
          {s.events.map(ev => (
            <li key={ev.id} className="px-3.5 py-2.5 flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-[13.5px] font-semibold text-foreground">{ev.name}</span>
              <span className="shrink-0 text-[12.5px] tabular-nums text-muted-foreground">
                {[
                  ev.added > 0 && `+${plural(ev.added, "incluído", "incluídos")}`,
                  ev.activated > 0 && plural(ev.activated, "reativado", "reativados"),
                  ev.deactivated > 0 && `−${plural(ev.deactivated, "desligado", "desligados")}`,
                ].filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MaintenanceDialog({ maintenance }: { maintenance: CriteriaMaintenance }) {
  const { state, close, confirm } = maintenance;
  const open = state != null;
  const running = state?.status === "running";
  const onCloseAutoFocus = useReturnFocus(open);
  const cfg = state ? CONFIG[state.kind] : null;
  const done = state?.status === "done";
  return (
    <AlertDialog open={open} onOpenChange={o => { if (!o) close(); }}>
      <AlertDialogContent className={cn(dialogCls, "max-w-[540px] max-h-[92dvh] overflow-y-auto")} data-testid="maintenance-dialog" onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={e => { if (running) e.preventDefault(); }}>
        {state && cfg && (
          <>
            <DialogHeading
              icon={done ? CheckCircle2 : cfg.icon}
              tone={done ? "brand" : "neutral"}
              Title={AlertDialogTitle}
              Description={AlertDialogDescription}
              title={done ? cfg.doneTitle : cfg.title}
              description={cfg.description}
            />
            {done ? <Result state={state} /> : <ConsequenceList items={cfg.consequences} />}
            {state.status === "error" && (
              <Notice icon={AlertTriangle} tone="danger" testId="maintenance-error">
                <p className="font-semibold text-foreground">Não deu certo</p>
                <p className="mt-0.5">{state.error}</p>
              </Notice>
            )}
            <div className={dialogFooterCls}>
              {done ? (
                <button type="button" onClick={close} className={btnPrimary} data-testid="button-maintenance-close">Fechar</button>
              ) : (
                <>
                  <button type="button" onClick={close} disabled={running} className={btnSecondary}>Cancelar</button>
                  <button type="button" onClick={confirm} disabled={running} aria-busy={running || undefined} className={btnPrimary} data-testid="button-maintenance-confirm">
                    {running ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : state.status === "error" ? <RotateCw size={15} aria-hidden /> : <cfg.icon size={15} aria-hidden />}
                    {running ? cfg.running : state.status === "error" ? "Tentar de novo" : cfg.confirm}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
