// "Tornar atual": confirmação com o antes → depois e o que muda no app.
import { useEffect, useRef } from "react";
import type { CycleSummary } from "@workspace/api-client-react";
import { ArrowDown, Loader2, Star } from "lucide-react";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { CycleStatusChip, DialogHeading, Eyebrow, btnPrimary, btnSecondary, cyclePeriod, dialogCls } from "./cycles-ui";

function CycleLine({ label, cycle }: { label: string; cycle: CycleSummary }) {
  return (
    <div className="px-4 py-3">
      <Eyebrow as="span" className="block">{label}</Eyebrow>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <span className="font-condensed text-[18px] font-black uppercase leading-tight">{cycle.name}</span>
        <CycleStatusChip cycle={cycle} />
      </div>
      <span className="mt-0.5 block text-[12.5px] text-muted-foreground tabular-nums">{cyclePeriod(cycle)}</span>
    </div>
  );
}

export function MakeCurrentDialog({ target, current, pending, onConfirm, onOpenChange }: {
  target: CycleSummary | null;
  current: CycleSummary | null;
  pending: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  // Aberto sem Trigger do Radix: o foco volta à mão para quem abriu.
  const returnTo = useRef<HTMLElement | null>(null);
  // Guardado no render (antes de o Radix mover o foco para dentro do diálogo).
  if (target && !returnTo.current) returnTo.current = document.activeElement as HTMLElement | null;
  useEffect(() => { if (!target) { const t = window.setTimeout(() => { returnTo.current = null; }, 300); return () => window.clearTimeout(t); } return undefined; }, [target]);
  return (
    <AlertDialog open={!!target} onOpenChange={o => { if (!pending) onOpenChange(o); }}>
      <AlertDialogContent className={cn(dialogCls, "max-w-[520px] max-h-[90dvh] overflow-y-auto")} data-testid="make-current-dialog"
        onCloseAutoFocus={e => { const el = returnTo.current; if (el?.isConnected) { e.preventDefault(); el.focus(); } }}>
        {target && (
          <>
            <DialogHeading
              icon={Star}
              tone="brand"
              Title={AlertDialogTitle}
              Description={AlertDialogDescription}
              title={`Tornar “${target.name}” o ciclo atual?`}
              description="Todas as telas — eventos, avaliações, resultados, ranking e análises — passam a mostrar este ciclo, e os eventos novos e a sincronização entram nele."
            />
            <div className="rounded-xl border border-border overflow-hidden">
              {current && <CycleLine label="Hoje é o atual" cycle={current} />}
              {current && (
                <div className="flex items-center gap-3 px-4 -my-3 relative z-10" aria-hidden>
                  <span className="h-px flex-1 bg-border" />
                  <span className="w-6 h-6 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground"><ArrowDown size={13} /></span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
              <div className="bg-secondary/40"><CycleLine label="Passa a ser o atual" cycle={target} /></div>
            </div>
            {current && <p className="text-[13px] leading-snug text-muted-foreground">&ldquo;{current.name}&rdquo; continua guardado no histórico, com os eventos e resultados dele.</p>}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button type="button" onClick={() => onOpenChange(false)} disabled={pending} className={btnSecondary}>Cancelar</button>
              <button type="button" onClick={onConfirm} disabled={pending} aria-busy={pending || undefined} className={btnPrimary} data-testid="button-confirm-make-current">
                {pending ? <><Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> Trocando…</> : <><Star size={15} aria-hidden /> Tornar atual</>}
              </button>
            </div>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
