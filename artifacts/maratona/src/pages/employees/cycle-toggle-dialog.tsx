// Tirar do ciclo / devolver ao ciclo (só admin). A recusa do servidor (ex.:
// 409 — bônus já aprovado, agendado, pago ou bloqueado) fica no próprio
// diálogo, com o atalho para Resultados.
import { Link } from "wouter";
import { AlertTriangle, ArrowRight, Loader2, UserMinus, UserPlus } from "lucide-react";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { DialogHeading, FieldLabel, Notice, btnDanger, btnPrimary, btnSecondary, dialogCls, dialogFooterCls, useReturnFocus } from "./ui";
import { cycleStatus, toTitleCase } from "./utils";
import type { EmployeeWithCycle } from "./types";

export function CycleToggleDialog({ target, reason, onReasonChange, pending, error, onConfirm, onClose }: {
  target: EmployeeWithCycle | null;
  reason: string;
  onReasonChange: (v: string) => void;
  pending: boolean;
  /** Recusa do servidor (fica no diálogo). */
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const onCloseAutoFocus = useReturnFocus(!!target);
  const restoring = !!target && cycleStatus(target) === "out";
  const name = target ? toTitleCase(target.name) : "";
  return (
    <AlertDialog open={!!target} onOpenChange={o => { if (!o && !pending) onClose(); }}>
      <AlertDialogContent className={cn(dialogCls, "max-w-[500px] max-h-[92dvh] overflow-y-auto")} data-testid="cycle-toggle-dialog" onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={e => { if (pending) e.preventDefault(); }}>
        {target && (
          <>
            <DialogHeading
              icon={restoring ? UserPlus : UserMinus}
              tone={restoring ? "brand" : "danger"}
              Title={AlertDialogTitle}
              Description={AlertDialogDescription}
              title={restoring ? `Devolver ${name} ao ciclo?` : `Tirar ${name} do ciclo?`}
              description={restoring
                ? "Volta a ter nota e a entrar no ranking, nas análises e no bônus deste ciclo. O ciclo é recalculado na hora."
                : "Fica sem nota, fora do ranking, das análises e do bônus deste ciclo. O histórico dos eventos continua guardado e dá para devolver depois, em “Fora do ciclo”. O ciclo é recalculado na hora."}
            />
            {!restoring && (
              <div>
                <FieldLabel htmlFor="cycle-reason" hint={<span className="tabular-nums">{reason.length}/300</span>}>Motivo (opcional)</FieldLabel>
                <textarea id="cycle-reason" value={reason} onChange={e => onReasonChange(e.target.value)} maxLength={300} rows={3} disabled={pending}
                  placeholder="Ex.: desligado em setembro, afastado…"
                  className="w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-[15px] leading-snug text-foreground placeholder:text-muted-foreground resize-none transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-foreground/40 focus:ring-2 focus:ring-ring/30 disabled:opacity-60" />
                <p className="mt-1.5 text-[12.5px] text-muted-foreground">Aparece na aba “Fora do ciclo”, ao lado do nome.</p>
              </div>
            )}
            {error && (
              <Notice icon={AlertTriangle} tone="warn" testId="cycle-toggle-error">
                <p className="font-semibold text-foreground">Não foi possível {restoring ? "devolver" : "tirar do ciclo"}</p>
                <p className="mt-0.5">{error}</p>
                {/bônus|pagamento/i.test(error) && (
                  <Link href="/results" className="mt-1.5 inline-flex items-center gap-1 font-semibold text-foreground underline underline-offset-2 hover:no-underline">
                    Abrir Resultados &amp; Ranking <ArrowRight size={13} aria-hidden />
                  </Link>
                )}
              </Notice>
            )}
            <div className={dialogFooterCls}>
              <button type="button" onClick={onClose} disabled={pending} className={btnSecondary}>Cancelar</button>
              <button type="button" onClick={onConfirm} disabled={pending} aria-busy={pending || undefined} data-testid="button-confirm-cycle-toggle"
                className={restoring ? btnPrimary : btnDanger}>
                {pending ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : restoring ? <UserPlus size={15} aria-hidden /> : <UserMinus size={15} aria-hidden />}
                {pending ? "Recalculando…" : restoring ? "Devolver ao ciclo" : "Tirar do ciclo"}
              </button>
            </div>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
