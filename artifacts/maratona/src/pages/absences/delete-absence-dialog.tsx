// Confirmação de exclusão: mostra o lançamento (quem, o quê, quanto) e o
// que acontece com a nota.
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, Trash2 } from "lucide-react";
import { cn, fmtDate, fmtNum, plural } from "@/lib/utils";
import {
  Avatar, ConsequenceList, DialogHeading, KindChip, SignedNumber, btnDanger, btnSecondary, dialogCls, dialogFooterCls, useReturnFocus,
} from "./absences-ui";
import { DATE_FULL, scoreEffect, signedPts, totalPoints } from "./helpers";
import type { AbsenceDeleteState } from "./use-absence-delete";
import type { EmployeeScore } from "./types";

export function DeleteAbsenceDialog({ state, typeLabel, scores }: {
  state: AbsenceDeleteState;
  typeLabel: (slug: string) => string;
  scores: Map<number, EmployeeScore>;
}) {
  const { deleteTarget: a, setDeleteTarget, deleteMutation } = state;
  const pending = deleteMutation.isPending;
  const open = a !== null;
  const onCloseAutoFocus = useReturnFocus(open);
  const score = a ? scores.get(a.employeeId) : undefined;
  const effect = a ? scoreEffect(totalPoints(a), score?.eventsCount) : null;
  const merit = a?.kind === "merit";
  const first = a?.employeeName?.split(" ")[0] ?? "o colaborador";
  return (
    <AlertDialog open={open} onOpenChange={v => { if (!v && !pending) setDeleteTarget(null); }}>
      <AlertDialogContent className={cn(dialogCls, "max-w-[500px]")} data-testid="delete-absence-dialog" onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={e => { if (pending) e.preventDefault(); }}>
        {a && (
          <>
            <DialogHeading icon={Trash2} tone="danger" Title={AlertDialogTitle} Description={AlertDialogDescription}
              title="Excluir este lançamento?"
              description="Ele sai do ciclo e a nota é recalculada na hora. Não dá para desfazer: para voltar, é preciso lançar de novo." />
            <div className="rounded-xl border border-border px-4 py-3 flex items-center gap-3">
              <Avatar name={a.employeeName ?? "?"} className="w-9 h-9 text-[13px]" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground truncate">{a.employeeName}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted-foreground">
                  <KindChip kind={a.kind}>{typeLabel(a.penaltyType)}</KindChip>
                  <span className="tabular-nums">{fmtDate(a.date, DATE_FULL)}</span>
                </div>
              </div>
              <SignedNumber kind={a.kind} className="text-[22px] shrink-0">{signedPts(a.kind, totalPoints(a))}</SignedNumber>
            </div>
            <ConsequenceList items={[
              effect != null
                ? <>A nota de <span className="font-semibold text-foreground">{first}</span> {merit ? "perde" : "recupera"} <span className="font-semibold text-foreground tabular-nums">{fmtNum(effect, 1)}</span> ({totalPoints(a)} pts ÷ {plural(score!.eventsCount, "evento", "eventos")}).</>
                : <>{first} ainda não tem evento com nota: a exclusão não muda nada agora.</>,
              <>Resultados, faixa e bônus projetado acompanham na hora.</>,
              <>A exclusão fica registrada na auditoria.</>,
            ]} />
            <div className={dialogFooterCls}>
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={pending} className={btnSecondary}>Cancelar</button>
              <button type="button" data-testid="button-confirm-delete-absence" disabled={pending} aria-busy={pending || undefined}
                onClick={() => deleteMutation.mutate({ id: a.id })} className={btnDanger}>
                {pending ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <Trash2 size={15} aria-hidden />}
                {pending ? "Excluindo…" : "Excluir lançamento"}
              </button>
            </div>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
