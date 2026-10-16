// Diálogos das faixas: remover uma faixa e trocar todas pelas de 2026. No
// padrão do app (cabeçalho com ícone, consequência em pontos, erro dentro
// do diálogo, foco devolvido ao gatilho).
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { ConsequenceList, DialogHeading, brl, btnDanger, btnPrimary, btnSecondary, dialogCls, dialogFooterCls, score, useReturnFocus } from "./rules-ui";
import { NEW_TIERS_2026 } from "./rule-meta";
import type { BandsState } from "./use-bands";

function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return <div role="alert" className="rounded-xl border border-[var(--status-danger)]/40 bg-[var(--status-danger-bg)] px-3.5 py-3 text-[13px] leading-snug text-foreground">{message}</div>;
}

export function DeleteBandDialog({ state }: { state: BandsState }) {
  const p = state.deleteTarget;
  const pending = state.deleteMutation.isPending;
  const onCloseAutoFocus = useReturnFocus(!!p);
  return (
    <AlertDialog open={!!p} onOpenChange={o => { if (!o && !pending) state.setDeleteTarget(null); }}>
      <AlertDialogContent className={cn(dialogCls, "max-w-[480px] outline-none")} data-testid="delete-band-dialog" onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={e => { if (pending) e.preventDefault(); }}>
        {p && (
          <>
            <DialogHeading icon={Trash2} tone="danger" Title={AlertDialogTitle} Description={AlertDialogDescription}
              title={`Remover “${p.name}”?`} description={`Notas de ${score(Number(p.minScore))} a ${score(Number(p.maxScore))} · prêmio base ${brl(Number(p.bonusValue))}.`} />
            <ConsequenceList items={[
              <>A faixa é apagada de vez; as notas dela ficam <span className="font-semibold text-foreground">sem faixa</span> até outra cobrir o intervalo.</>,
              <>Quem já está nela no ciclo atual pode mudar de bônus no próximo recálculo.</>,
            ]} />
            <ErrorBox message={state.deleteError} />
            <div className={dialogFooterCls}>
              <button type="button" onClick={() => state.setDeleteTarget(null)} disabled={pending} className={btnSecondary}>Cancelar</button>
              <button type="button" data-testid="button-confirm-delete-band" onClick={() => state.deleteMutation.mutate({ id: p.id })} disabled={pending} aria-busy={pending || undefined} className={btnDanger}>
                {pending ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <Trash2 size={15} aria-hidden />}
                {pending ? "Removendo…" : "Remover faixa"}
              </button>
            </div>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ReplaceBandsDialog({ state, currentCount }: { state: BandsState; currentCount: number }) {
  const open = state.replaceOpen;
  const onCloseAutoFocus = useReturnFocus(open);
  return (
    <AlertDialog open={open} onOpenChange={o => state.setReplaceOpen(o)}>
      <AlertDialogContent className={cn(dialogCls, "max-w-[540px] max-h-[92dvh] overflow-y-auto outline-none")} data-testid="replace-bands-dialog" onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={e => { if (state.replacing) e.preventDefault(); }}>
        <DialogHeading icon={RefreshCw} Title={AlertDialogTitle} Description={AlertDialogDescription} title="Aplicar as faixas de 2026?"
          description={`Apaga ${currentCount === 1 ? "a faixa atual" : `as ${currentCount} faixas atuais`} e cria as ${NEW_TIERS_2026.length} abaixo.`} />
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full border-collapse text-[13.5px]" aria-label="Faixas de 2026">
            <thead>
              <tr className="bg-secondary/50">
                <th className="font-condensed px-3 py-2 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Faixa</th>
                <th className="font-condensed px-3 py-2 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Notas</th>
                <th className="font-condensed px-3 py-2 text-right text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Base</th>
                <th className="font-condensed px-3 py-2 text-right text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Por extra</th>
              </tr>
            </thead>
            <tbody>
              {NEW_TIERS_2026.map(t => (
                <tr key={t.name} className="border-t border-border">
                  <td className="px-3 py-1.5 font-semibold text-foreground"><span className="inline-flex items-center gap-2"><span aria-hidden className="w-3 h-3 rounded-[3px] border border-foreground/15" style={{ backgroundColor: t.color }} />{t.name}</span></td>
                  <td className="px-3 py-1.5 tabular-nums text-muted-foreground whitespace-nowrap">{score(t.minScore)}–{score(t.maxScore)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-foreground">{t.bonusValue > 0 ? brl(t.bonusValue) : "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-foreground">{t.bonusPerExtraEvent > 0 ? brl(t.bonusPerExtraEvent) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ConsequenceList items={[
          <>O recálculo do ciclo <span className="font-semibold text-foreground">não roda sozinho</span>: depois de aplicar, use “Recalcular ciclo” em Integração.</>,
          <>Mudanças ainda não salvas nas faixas atuais se perdem.</>,
        ]} />
        <ErrorBox message={state.replaceError} />
        <div className={dialogFooterCls}>
          <button type="button" onClick={() => state.setReplaceOpen(false)} disabled={state.replacing} className={btnSecondary}>Cancelar</button>
          <button type="button" data-testid="button-confirm-replace-bands" onClick={() => { void state.replaceAll(); }} disabled={state.replacing} aria-busy={state.replacing || undefined} className={btnPrimary}>
            {state.replacing ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <RefreshCw size={15} aria-hidden />}
            {state.replacing ? "Aplicando…" : "Aplicar faixas 2026"}
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
