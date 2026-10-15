// Mesclar duplicados: barra fixa com a seleção (2+ marcados), confirmação com
// o que vai para a conta mantida (a recusa do servidor — 409 — aparece aqui
// dentro) e o resultado com o que foi transferido.
import type { User } from "@workspace/api-client-react";
import { AlertTriangle, CheckCircle2, GitMerge, Loader2, Lock, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn, plural } from "@/lib/utils";
import { Avatar, ConsequenceList, DialogHeading, Eyebrow, FOCUS_RING, btnPrimary, btnSecondary, dialogCls, dialogFooterCls, surfaceCls, useReturnFocus } from "./users-ui";
import type { UserMergeState } from "./use-user-merge";

export function MergeActionBar({ merge, users }: { merge: UserMergeState; users: User[] }) {
  const { mergeMode, selectedIds, canonicalId, mergeMutation, cancelMerge, setConfirmOpen } = merge;
  if (!mergeMode || selectedIds.size === 0) return null;
  const canonical = users.find(u => u.id === canonicalId);
  const ready = selectedIds.size >= 2 && !!canonical;
  const status = selectedIds.size < 2
    ? "Marque pelo menos mais uma conta do mesmo avaliador."
    : canonical ? <>Fica <span className="font-semibold text-foreground">{canonical.name}</span>; {plural(selectedIds.size - 1, "outra é desativada", "outras são desativadas")}.</>
    : "Escolha a conta que fica em “Manter esta”.";
  return (
    <div role="region" aria-label="Mescla de duplicados" data-testid="merge-action-bar"
      className={cn(surfaceCls, "fixed z-40 bottom-3 inset-x-3 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[min(640px,calc(100vw-304px))] md:ml-[128px] shadow-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3",
        "motion-safe:animate-in motion-safe:slide-in-from-bottom-2 motion-safe:fade-in-0 duration-200")}>
      <div className="min-w-0 flex-1">
        <Eyebrow as="p">{plural(selectedIds.size, "conta marcada", "contas marcadas")}</Eyebrow>
        <p className="mt-1 text-[13.5px] leading-snug text-muted-foreground" aria-live="polite">{status}</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={cancelMerge} aria-label="Limpar e sair da mescla" title="Limpar e sair"
          className={cn("w-11 h-11 lg:w-9 lg:h-9 shrink-0 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-150", FOCUS_RING)}>
          <X size={17} aria-hidden />
        </button>
        <button type="button" data-testid="button-merge-now" disabled={!ready || mergeMutation.isPending} onClick={() => setConfirmOpen(true)}
          className={cn(btnPrimary, "flex-1 sm:flex-none")}>
          <GitMerge size={15} aria-hidden /> Mesclar
        </button>
      </div>
    </div>
  );
}

export function MergeConfirmDialog({ merge, users }: { merge: UserMergeState; users: User[] }) {
  const { confirmOpen, setConfirmOpen, selectedIds, canonicalId, mergeMutation, confirmMerge, mergeError } = merge;
  const pending = mergeMutation.isPending;
  const onCloseAutoFocus = useReturnFocus(confirmOpen);
  const canonical = users.find(u => u.id === canonicalId);
  const dups = [...selectedIds].filter(id => id !== canonicalId).map(id => users.find(u => u.id === id)).filter((u): u is User => !!u);
  return (
    <AlertDialog open={confirmOpen} onOpenChange={o => { if (!pending) setConfirmOpen(o); }}>
      <AlertDialogContent className={cn(dialogCls, "max-w-[540px] max-h-[92dvh] overflow-y-auto outline-none")} data-testid="merge-confirm-dialog" onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={e => { if (pending) e.preventDefault(); }}>
        <DialogHeading icon={GitMerge} Title={AlertDialogTitle} Description={AlertDialogDescription} title="Mesclar contas?"
          description="O histórico das contas duplicadas passa para a conta que fica. Não dá para desfazer." />
        {canonical && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 rounded-xl border border-foreground/30 px-3.5 py-2.5">
              <Avatar name={canonical.name} highlight className="w-9 h-9" />
              <div className="min-w-0">
                <Eyebrow as="p">Fica</Eyebrow>
                <p className="mt-1 text-[14.5px] font-semibold text-foreground truncate">{canonical.name}</p>
              </div>
            </div>
            <div className="rounded-xl border border-border divide-y divide-border">
              {dups.map(u => (
                <div key={u.id} className="flex items-center gap-3 px-3.5 py-2.5">
                  <Avatar name={u.name} className="w-9 h-9" />
                  <div className="min-w-0">
                    <Eyebrow as="p">Desativada</Eyebrow>
                    <p className="mt-1 text-[14px] text-foreground truncate">{u.name}{u.email ? <span className="text-muted-foreground"> · {u.email}</span> : null}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <ConsequenceList items={[
          <>Avaliações, calibrações, matrizes de conformidade e designações vão para <span className="font-semibold text-foreground">{canonical?.name ?? "a conta mantida"}</span>.</>,
          <>Dados de <span className="font-semibold text-foreground">ciclo fechado</span> não mudam de avaliador: se houver, a mescla é recusada.</>,
        ]} />
        {mergeError && (
          <div role="alert" data-testid="merge-error" className="flex items-start gap-2.5 rounded-xl border border-[var(--status-danger)]/40 bg-[var(--status-danger-bg)] px-3.5 py-3 text-[13px] leading-snug text-foreground">
            {mergeError.closedCycle ? <Lock size={15} aria-hidden className="mt-[1px] shrink-0 text-[var(--status-danger-text)]" /> : <AlertTriangle size={15} aria-hidden className="mt-[1px] shrink-0 text-[var(--status-danger-text)]" />}
            <span className="min-w-0">
              <span className="block font-semibold">{mergeError.closedCycle ? "Mescla recusada: há dados de ciclo fechado" : "Mescla recusada"}</span>
              <span className="block mt-0.5 text-muted-foreground">{mergeError.message}</span>
            </span>
          </div>
        )}
        <div className={dialogFooterCls}>
          <button type="button" onClick={() => setConfirmOpen(false)} disabled={pending} className={btnSecondary}>{mergeError ? "Voltar" : "Cancelar"}</button>
          {!mergeError && (
            <button type="button" data-testid="button-confirm-merge" onClick={confirmMerge} disabled={pending || !canonical} aria-busy={pending || undefined} className={btnPrimary}>
              {pending ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <GitMerge size={15} aria-hidden />}
              {pending ? "Mesclando…" : `Mesclar ${plural(dups.length + 1, "conta", "contas")}`}
            </button>
          )}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** "Mescla concluída" com o que foi transferido para a conta mantida. */
export function MergeResultDialog({ merge }: { merge: UserMergeState }) {
  const { mergeResult, setMergeResult } = merge;
  const open = mergeResult !== null;
  const onCloseAutoFocus = useReturnFocus(open);
  const items = mergeResult ? [
    { val: mergeResult.movedEvaluations ?? 0, label: "Avaliações" },
    { val: mergeResult.movedCalibrations ?? 0, label: "Calibrações" },
    { val: mergeResult.movedConformities ?? 0, label: "Matrizes" },
    { val: mergeResult.movedAssignments ?? 0, label: "Designações" },
  ] : [];
  return (
    <Dialog open={open} onOpenChange={v => !v && setMergeResult(null)}>
      <DialogContent className={cn(dialogCls, "max-w-[460px]")} data-testid="merge-result-dialog" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeading icon={CheckCircle2} tone="brand" Title={DialogTitle} Description={DialogDescription} title="Mescla concluída"
          description={mergeResult ? `${plural(mergeResult.merged.length, "conta mesclada e desativada", "contas mescladas e desativadas")}. Transferido para a conta mantida:` : undefined} />
        <dl className={cn(surfaceCls, "grid grid-cols-2 gap-px overflow-hidden bg-border")}>
          {items.map(s => (
            <div key={s.label} className="bg-card px-4 py-3">
              <dt><Eyebrow as="span">{s.label}</Eyebrow></dt>
              <dd className="mt-1.5 font-condensed text-[26px] font-black leading-none tabular-nums text-foreground">{s.val.toLocaleString("pt-BR")}</dd>
            </div>
          ))}
        </dl>
        <div className={dialogFooterCls}>
          <button type="button" onClick={() => setMergeResult(null)} className={btnPrimary}>Fechar</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
