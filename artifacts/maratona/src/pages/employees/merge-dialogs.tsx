// Mesclagem de cadastros duplicados: a barra fixa (quem fica), a confirmação
// (o que sai e o que é apagado) e o resumo do que foi transferido.
import type { MergeEmployeeResult } from "@workspace/api-client-react";
import { AlertTriangle, ArrowDown, Check, GitMerge, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn, plural } from "@/lib/utils";
import { Chip, DialogHeading, Notice, btnDanger, btnPrimary, btnSecondary, dialogCls, dialogFooterCls, useReturnFocus } from "./ui";
import { toTitleCase } from "./utils";
import type { EmployeeWithCycle } from "./types";

const nameOf = (employees: EmployeeWithCycle[] | undefined, id: number | null) => {
  const e = (employees ?? []).find(x => x.id === id);
  return e ? toTitleCase(e.name) : "?";
};

/** Barra fixa do modo mesclagem: escolhe quem FICA entre os marcados e abre a confirmação. */
export function MergeActionBar({
  employees,
  selectedIds,
  canonicalId,
  onSelectCanonical,
  onRequestMerge,
  isPending,
}: {
  employees: EmployeeWithCycle[] | undefined;
  selectedIds: Set<number>;
  canonicalId: number | null;
  onSelectCanonical: (id: number) => void;
  onRequestMerge: () => void;
  isPending: boolean;
}) {
  return (
    <section aria-label="Mesclagem" data-testid="merge-action-bar"
      className="sticky bottom-3 z-20 rounded-2xl border border-foreground/30 bg-card shadow-[0_12px_32px_-12px_rgba(0,0,0,0.35)] p-4 flex flex-col lg:flex-row lg:items-center gap-4 motion-safe:animate-in motion-safe:slide-in-from-bottom-2 motion-safe:fade-in-0 duration-200">
      <div className="min-w-0 flex-1">
        <p className="font-condensed text-[16px] font-black uppercase leading-tight">{plural(selectedIds.size, "cadastro marcado", "cadastros marcados")}</p>
        <p id="merge-keep-hint" className="text-[13px] text-muted-foreground mt-0.5">Qual cadastro fica? Os outros são juntados nele e apagados.</p>
        <div role="group" aria-labelledby="merge-keep-hint" className="flex flex-wrap gap-1.5 mt-2.5">
          {Array.from(selectedIds).map(id => {
            const on = canonicalId === id;
            const emp = (employees ?? []).find(e => e.id === id);
            if (!emp) return null;
            return (
              <button key={id} type="button" aria-pressed={on} onClick={e => { e.stopPropagation(); onSelectCanonical(id); }}
                className={cn("inline-flex items-center gap-1.5 min-h-11 lg:min-h-9 px-3 rounded-lg border text-[14px] font-semibold transition-[background-color,border-color,color] duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                  on ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card text-foreground hover:bg-secondary")}>
                {on && <Check size={14} aria-hidden />}{toTitleCase(emp.name)}
              </button>
            );
          })}
        </div>
      </div>
      <button type="button" data-testid="button-request-merge" disabled={!canonicalId || isPending} onClick={() => { if (canonicalId) onRequestMerge(); }}
        className={cn(btnPrimary, "shrink-0 w-full lg:w-auto")}>
        <GitMerge size={15} aria-hidden />
        {canonicalId ? <>Mesclar e manter <span className="normal-case max-w-[220px] truncate">{nameOf(employees, canonicalId)}</span></> : "Escolha quem fica"}
      </button>
    </section>
  );
}

/** Confirmação: quem fica, quem sai (apagado) e o aviso de que não dá para desfazer. Erro do servidor (ex.: 409 de ciclo fechado) aparece aqui. */
export function MergeConfirmDialog({
  open,
  onOpenChange,
  employees,
  selectedIds,
  canonicalId,
  isPending,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employees: EmployeeWithCycle[] | undefined;
  selectedIds: Set<number>;
  canonicalId: number | null;
  isPending: boolean;
  /** Recusa do servidor (fica no diálogo, com o motivo). */
  error: string | null;
  onConfirm: () => void;
}) {
  const onCloseAutoFocus = useReturnFocus(open);
  const leaving = Array.from(selectedIds).filter(id => id !== canonicalId);
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isPending) onOpenChange(v); }}>
      <DialogContent className={cn(dialogCls, "max-w-[520px] max-h-[90dvh] overflow-y-auto")} data-testid="merge-confirm-dialog" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeading icon={GitMerge} Title={DialogTitle} Description={DialogDescription} title="Confirmar mesclagem"
          description="As participações em eventos e as faltas dos duplicados passam para o cadastro que fica." />
        <div className="space-y-2">
          <div className="rounded-xl border border-border px-4 py-3">
            <Chip tone="ok">Fica</Chip>
            <p className="mt-2 text-[16px] font-semibold leading-snug break-words">{nameOf(employees, canonicalId)}</p>
          </div>
          <div className="flex justify-center -my-1" aria-hidden><span className="w-7 h-7 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground"><ArrowDown size={14} className="rotate-180" /></span></div>
          <div className="rounded-xl border border-border px-4 py-3">
            <Chip tone="danger">{leaving.length === 1 ? "Sai (apagado)" : `Saem (${leaving.length}, apagados)`}</Chip>
            <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {leaving.map(id => <li key={id} className="text-[16px] font-semibold leading-snug break-words">{nameOf(employees, id)}</li>)}
            </ul>
          </div>
        </div>
        <Notice icon={AlertTriangle} tone="danger">Os cadastros duplicados e os resultados de ciclo calculados para eles são apagados. Não dá para desfazer.</Notice>
        {error && (
          <Notice icon={AlertTriangle} tone="warn" testId="merge-error">
            <p className="font-semibold text-foreground">Não foi possível mesclar</p>
            <p className="mt-0.5">{error}</p>
          </Notice>
        )}
        <div className={dialogFooterCls}>
          <button type="button" onClick={() => onOpenChange(false)} disabled={isPending} className={btnSecondary}>Cancelar</button>
          <button type="button" data-testid="button-confirm-merge-employees" disabled={!canonicalId || isPending} aria-busy={isPending || undefined} onClick={onConfirm} className={btnDanger}>
            {isPending ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <GitMerge size={15} aria-hidden />}
            {isPending ? "Mesclando…" : "Mesclar e apagar duplicados"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Resumo da mesclagem concluída. */
export function MergeResultDialog({ mergeResult, onClose }: { mergeResult: MergeEmployeeResult | null; onClose: () => void }) {
  const r = mergeResult;
  const lines = r ? [
    { n: r.merged.length, label: r.merged.length === 1 ? "cadastro duplicado apagado" : "cadastros duplicados apagados" },
    { n: r.movedParticipations, label: r.movedParticipations === 1 ? "participação transferida" : "participações transferidas" },
    ...((r.movedAbsences ?? 0) > 0 ? [{ n: r.movedAbsences, label: r.movedAbsences === 1 ? "penalidade/mérito transferido" : "penalidades/méritos transferidos" }] : []),
    ...((r.movedEvaluatorEvals ?? 0) > 0 ? [{ n: r.movedEvaluatorEvals, label: r.movedEvaluatorEvals === 1 ? "avaliação de avaliador transferida" : "avaliações de avaliador transferidas" }] : []),
    ...((r.removedUsers ?? 0) > 0 ? [{ n: r.removedUsers, label: r.removedUsers === 1 ? "conta de usuário desativada" : "contas de usuário desativadas", danger: true }] : []),
  ] : [];
  return (
    <Dialog open={!!r} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className={cn(dialogCls, "max-w-[440px]")} data-testid="merge-result-dialog">
        <DialogHeading icon={Check} tone="brand" Title={DialogTitle} Description={DialogDescription} title="Mesclagem concluída"
          description="O cadastro que ficou já aparece na lista com tudo junto." />
        <dl className="rounded-xl border border-border divide-y divide-border">
          {lines.map(l => (
            <div key={l.label} className="flex items-baseline gap-3 px-4 py-2.5">
              <dt className={cn("font-condensed w-10 text-right text-[22px] font-black leading-none tabular-nums", "danger" in l && l.danger && "text-[var(--status-danger-text)]")}>{l.n ?? 0}</dt>
              <dd className="text-[14px] text-muted-foreground">{l.label}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[13px] text-muted-foreground">Se o cadastro que ficou ainda não tem acesso, crie em “Mais ações → Gerar acessos em massa” ou no menu da pessoa.</p>
        <div className={dialogFooterCls}>
          <button type="button" onClick={onClose} className={btnPrimary}>Fechar</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
