import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { CONDENSED, WARNING } from "@/lib/premium-theme";
import type { AbsenceDeleteState } from "./use-absence-delete";

/** Confirmação de exclusão de um lançamento. */
export function DeleteAbsenceDialog({ state }: { state: AbsenceDeleteState }) {
  const { deleteTargetId, setDeleteTargetId, deleteMutation } = state;
  return (
    <AlertDialog open={deleteTargetId !== null} onOpenChange={v => { if (!v) setDeleteTargetId(null); }}>
      <AlertDialogContent className="rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED, color: "var(--foreground)" }}>
            <Trash2 size={18} /> Confirmar exclusão
          </AlertDialogTitle>
          <AlertDialogDescription style={{ color: "var(--muted-foreground)" }}>
            Este lançamento será removido permanentemente. O cálculo do resultado final do colaborador será atualizado no próximo reprocessamento.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-lg font-bold uppercase text-xs" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={deleteMutation.isPending}
            onClick={() => deleteTargetId && deleteMutation.mutate({ id: deleteTargetId })}
            className="rounded-lg font-bold uppercase text-xs disabled:opacity-50"
            style={{ backgroundColor: WARNING, color: "white", border: "none" }}
          >
            Sim, excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
