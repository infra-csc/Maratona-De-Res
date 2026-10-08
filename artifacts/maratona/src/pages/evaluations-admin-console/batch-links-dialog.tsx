import { useState, type Dispatch, type SetStateAction } from "react";
import { AlertCircle, CheckCheck, Copy, Link2, ListChecks, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { copyToClipboard, COPY_FAILED_TOAST } from "@/lib/clipboard";
import { cn, plural } from "@/lib/utils";
import { Bone, Chip, DialogHeading, btnPrimary, btnSecondary, btnSmall, dialogCls } from "./console-ui";
import { LinkEventCard } from "./link-bits";
import { AreaEvaluatorSelect } from "./pickers";
import type { ToastFn } from "./use-event-mutations";
import type { AreaBatchPlanRow, BatchLink, EnrichedEvent } from "./types";

// Diálogo alto: cabeçalho e rodapé fixos, só a lista rola.
const Spinner = ({ size }: { size?: number }) => <Loader2 size={size} aria-hidden className="motion-safe:animate-spin" />;
const tallCls = cn(dialogCls, "max-w-[600px] flex flex-col overflow-hidden max-h-[88vh]");

/** "Gerar todos os links": no ciclo por área, primeiro a escolha do avaliador de cada área; depois, a lista pronta. */
export function BatchLinksDialog({ selected, batchRunning, batchLinks, batchAllCopied, setBatchAllCopied, setBatchOpen, batchEventHeader, toast, batchPlan, setBatchPlan, runAreaBatch }: {
  selected: EnrichedEvent | null;
  /** Ciclo por área: áreas à espera da escolha do avaliador (antes de gerar). */
  batchPlan: AreaBatchPlanRow[] | null;
  setBatchPlan: Dispatch<SetStateAction<AreaBatchPlanRow[] | null>>;
  runAreaBatch: () => void;
  batchRunning: boolean;
  batchLinks: BatchLink[];
  batchAllCopied: boolean;
  setBatchAllCopied: Dispatch<SetStateAction<boolean>>;
  setBatchOpen: Dispatch<SetStateAction<boolean>>;
  batchEventHeader: string;
  toast: ToastFn;
}) {
  const planning = !!batchPlan && !batchRunning && batchLinks.length === 0;
  // Enquanto gera, o diálogo não fecha (a geração segue em laço).
  const close = () => { if (batchRunning) return; setBatchOpen(false); setBatchPlan(null); };
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (planning) {
    const chosen = batchPlan.filter(r => r.evaluatorId != null).length;
    return (
      <Dialog open onOpenChange={o => { if (!o) close(); }}>
        <DialogContent className={tallCls} data-testid="dialog-batch-plan">
          <DialogHeading
            icon={ListChecks}
            Title={DialogTitle}
            Description={DialogDescription}
            title="Gerar todos os links"
            description={<>Um link por área com critério aberto ({plural(batchPlan.length, "área", "áreas")}). Cada link sai em nome de um avaliador da área — a resposta conta como a dele. Área sem avaliador escolhido fica de fora.</>}
          />
          <div className="flex-1 min-h-0 overflow-y-auto -mx-5 sm:-mx-6 px-5 sm:px-6 space-y-3">
            <LinkEventCard header={batchEventHeader} />
            <ul className="rounded-xl border border-border divide-y divide-border">
              {batchPlan.map(r => {
                const fieldId = `batch-area-${r.areaId}`;
                return (
                  <li key={r.areaId} className="p-3.5 grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <label htmlFor={fieldId} className="font-condensed text-[16px] font-black uppercase leading-tight text-foreground">{r.areaName}</label>
                        {r.includeConformity && <Chip tone="ok" icon={ShieldCheck}>+ Matriz</Chip>}
                      </div>
                      <p className="text-[12.5px] leading-snug text-muted-foreground mt-0.5">
                        {plural(r.criterionIds.length, "critério aberto", "critérios abertos")}: {r.criterionNames.join(" · ")}
                      </p>
                    </div>
                    <AreaEvaluatorSelect
                      compact
                      id={fieldId}
                      areaId={r.areaId}
                      areaName={r.areaName}
                      value={r.evaluatorId}
                      onChange={(userId, name) => setBatchPlan(plan => (plan ?? []).map(x => x.areaId === r.areaId ? { ...x, evaluatorId: userId, evaluatorName: name } : x))}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
          <DialogFooter className="gap-2 sm:gap-2 sm:space-x-0 sm:items-center">
            <p className="text-[12.5px] text-muted-foreground sm:mr-auto" aria-live="polite">{chosen} de {plural(batchPlan.length, "área pronta", "áreas prontas")}</p>
            <button type="button" onClick={close} className={btnSecondary}>Cancelar</button>
            <button type="button" data-testid="button-run-area-batch" disabled={chosen === 0} onClick={runAreaBatch} className={btnPrimary}
              title={chosen === 0 ? "Escolha o avaliador de ao menos uma área" : undefined}>
              <Link2 size={15} aria-hidden /> {chosen === 0 ? "Gerar links" : `Gerar ${plural(chosen, "link", "links")}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const ready = batchLinks.filter(l => l.url);
  const failed = batchLinks.length - ready.length;
  return (
    <Dialog open onOpenChange={o => { if (!o) close(); }}>
      <DialogContent className={tallCls} data-testid="dialog-batch-links" onEscapeKeyDown={e => { if (batchRunning) e.preventDefault(); }} onPointerDownOutside={e => { if (batchRunning) e.preventDefault(); }}>
        <DialogHeading
          icon={batchRunning ? Spinner : CheckCheck}
          tone={batchRunning ? "neutral" : failed > 0 ? "danger" : "brand"}
          Title={DialogTitle}
          Description={DialogDescription}
          title={batchRunning ? "Gerando links…" : plural(ready.length, "link pronto", "links prontos")}
          description={batchRunning
            ? "Um por área. Links pendentes iguais são reaproveitados em vez de criar outro."
            : failed > 0 ? `${plural(failed, "link não pôde ser gerado", "links não puderam ser gerados")} — veja o motivo na lista.` : "Copie cada um ou todos de uma vez, já com o nome do evento."}
        />
        <div className="flex-1 min-h-0 overflow-y-auto -mx-5 sm:-mx-6 px-5 sm:px-6 space-y-3" aria-busy={batchRunning}>
          <LinkEventCard header={batchEventHeader} />
          {batchRunning && batchLinks.length === 0 ? (
            <div className="space-y-2" role="status" aria-label="Gerando links">
              {[0, 1, 2].map(i => <Bone key={i} className="h-[76px] w-full rounded-xl" />)}
            </div>
          ) : (
            <ul className="rounded-xl border border-border divide-y divide-border">
              {batchLinks.map(l => (
                <li key={l.key} className="p-3.5" data-testid={`batch-link-${l.key}`}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-condensed text-[16px] font-black uppercase leading-tight text-foreground">{l.areaName}</span>
                        {l.includeConformity && <Chip tone="ok" icon={ShieldCheck}>+ Matriz</Chip>}
                        {l.reused && (
                          <Chip tone="warn" icon={RotateCcw} title="Já existia um link pendente com estes mesmos critérios em nome deste avaliador — nenhum link novo foi criado.">Reaproveitado</Chip>
                        )}
                      </div>
                      <p className="text-[13px] text-foreground mt-0.5">Em nome de <b className="font-semibold">{l.evaluatorName}</b></p>
                      <p className="text-[12.5px] leading-snug text-muted-foreground mt-0.5">{l.criterionNames.join(" · ")}</p>
                    </div>
                    {l.url && (
                      <button
                        type="button"
                        aria-label={`Copiar link de ${l.areaName} (${l.evaluatorName})`}
                        onClick={async () => {
                          const text = `${batchEventHeader} — ${l.evaluatorName} (${l.areaName}${l.includeConformity ? " + Matriz" : ""}): ${l.url}`;
                          if (await copyToClipboard(text)) {
                            setCopiedKey(l.key); setTimeout(() => setCopiedKey(k => k === l.key ? null : k), 2000);
                            toast({ title: `Link de ${l.evaluatorName} copiado`, description: batchEventHeader });
                          } else toast(COPY_FAILED_TOAST);
                        }}
                        className={cn(btnSmall, "shrink-0")}
                      >
                        {copiedKey === l.key ? <><CheckCheck size={14} aria-hidden /> Copiado</> : <><Copy size={14} aria-hidden /> Copiar</>}
                      </button>
                    )}
                  </div>
                  {l.url ? (
                    <p className="mt-2 rounded-lg bg-secondary/60 px-3 py-2 font-mono text-[12px] text-muted-foreground break-all select-all">{l.url}</p>
                  ) : (
                    <p className="mt-2 flex items-start gap-1.5 text-[13px] font-semibold text-[var(--status-danger-text)]"><AlertCircle size={14} aria-hidden className="shrink-0 mt-[2px]" />{l.error ?? "Falha ao gerar"}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!batchRunning && (
            <p className="text-[12.5px] leading-snug text-muted-foreground pb-1">
              A Matriz de Conformidade da Cenografia já vai junto no link dessa área (critério + matriz no mesmo questionário). A matriz de Ferramentas (Guarda de Equipamentos) vem com link próprio aqui na lista.
            </p>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2 sm:space-x-0">
          <button type="button" onClick={close} disabled={batchRunning} className={btnSecondary}>Fechar</button>
          {ready.length > 0 && (
            <button
              type="button"
              data-testid="button-copy-all-links"
              onClick={async () => {
                const text = [
                  batchEventHeader,
                  "",
                  ...ready.map(l => `${l.evaluatorName} (${l.areaName}${l.includeConformity ? " + Matriz" : ""}): ${l.url}`),
                ].join("\n");
                if (await copyToClipboard(text)) { setBatchAllCopied(true); setTimeout(() => setBatchAllCopied(false), 2000); }
                else toast(COPY_FAILED_TOAST);
              }}
              className={btnPrimary}
              aria-live="polite"
            >
              {batchAllCopied ? <><CheckCheck size={15} aria-hidden /> Copiado</> : <><Copy size={15} aria-hidden /> Copiar todos</>}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
