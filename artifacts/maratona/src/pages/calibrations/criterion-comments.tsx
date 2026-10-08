// Comentários da calibração de um critério: lista, exclusão (com confirmação)
// e novo comentário (botão ou Ctrl+Enter).
import { useState } from "react";
import type React from "react";
import { Loader2, MessageSquare, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { DialogHeading, Eyebrow, btnSecondary, btnSmall, dialogCls } from "../evaluations/ui";
import { fieldCls } from "./cal-ui";
import { formatDateTime } from "./helpers";
import type { AddCommentMutation, CalibrationCommentItem, DeleteCommentMutation, ToastFn } from "./types";

export type CriterionCommentsProps = {
  criterionId: number;
  criterionName: string;
  calComments: CalibrationCommentItem[] | undefined;
  newCommentTexts: Record<number, string>;
  setNewCommentTexts: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  canFinalize: boolean;
  addCommentMutation: AddCommentMutation;
  deleteCommentMutation: DeleteCommentMutation;
  toast: ToastFn;
};

function grow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

export function CriterionComments({
  criterionId, criterionName, calComments, newCommentTexts, setNewCommentTexts, canFinalize, addCommentMutation, deleteCommentMutation, toast,
}: CriterionCommentsProps) {
  const [toDelete, setToDelete] = useState<CalibrationCommentItem | null>(null);
  const comments = (calComments ?? []).filter(cm => cm.criterionId === criterionId);
  const text = newCommentTexts[criterionId] ?? "";
  const fieldId = `cal-comment-${criterionId}`;
  const sending = addCommentMutation.isPending && addCommentMutation.variables?.criterionId === criterionId;

  function send() {
    if (!text.trim()) return;
    addCommentMutation.mutate(
      { criterionId, text: text.trim() },
      {
        onSuccess: () => setNewCommentTexts(prev => ({ ...prev, [criterionId]: "" })),
        onError: (e: Error) => toast({ title: "Erro ao enviar comentário", description: e.message, variant: "destructive" }),
      },
    );
  }

  if (!canFinalize && comments.length === 0) return null;

  return (
    <div>
      <Eyebrow as="p" className="flex items-center gap-1.5 mb-2">
        <MessageSquare size={13} aria-hidden /> Comentários{comments.length > 0 ? ` · ${comments.length}` : ""}
      </Eyebrow>
      {comments.length > 0 && (
        <ul className="space-y-2 mb-2.5">
          {comments.map(cm => (
            <li key={cm.id} className="group/cm rounded-lg bg-secondary/60 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-foreground">{cm.createdByName ?? "—"}</span>
                <span className="text-[12px] text-muted-foreground">{formatDateTime(new Date(cm.createdAt))}</span>
                {canFinalize && (
                  <button
                    type="button"
                    onClick={() => setToDelete(cm)}
                    aria-label={`Excluir comentário de ${cm.createdByName ?? "autor desconhecido"}`}
                    title="Excluir comentário"
                    className="ml-auto w-9 h-9 -my-1.5 -mr-1.5 rounded-md flex items-center justify-center text-muted-foreground opacity-70 hover:opacity-100 hover:text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)] transition-[opacity,color,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                )}
              </div>
              <p className="mt-1 text-[14px] leading-relaxed text-foreground whitespace-pre-wrap break-words">{cm.text}</p>
            </li>
          ))}
        </ul>
      )}
      {canFinalize && (
        <div className="flex items-end gap-2">
          <label htmlFor={fieldId} className="sr-only">Novo comentário em {criterionName}</label>
          <textarea
            id={fieldId}
            rows={1}
            placeholder="Escreva um comentário… (Ctrl+Enter envia)"
            value={text}
            onChange={e => { setNewCommentTexts(prev => ({ ...prev, [criterionId]: e.target.value })); grow(e.target); }}
            onFocus={e => grow(e.target)}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) { e.preventDefault(); send(); } }}
            className={cn(fieldCls, "flex-1 min-h-11 px-3 py-2.5 text-[14px] leading-snug resize-none overflow-hidden")}
          />
          <button type="button" disabled={!text.trim() || sending} onClick={send} className={btnSmall}>
            {sending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null} Comentar
          </button>
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={o => { if (!o && !deleteCommentMutation.isPending) setToDelete(null); }}>
        <AlertDialogContent className={dialogCls} data-testid="dialog-delete-cal-comment">
          <DialogHeading
            icon={Trash2}
            tone="danger"
            Title={AlertDialogTitle}
            Description={AlertDialogDescription}
            title="Excluir comentário?"
            description={<>O comentário de <b className="font-semibold text-foreground">{toDelete?.createdByName ?? "—"}</b> em {criterionName} sai da calibração. Não dá para desfazer.</>}
          />
          {toDelete && <blockquote className="rounded-lg bg-secondary/60 px-3.5 py-2.5 text-[14px] leading-relaxed text-foreground whitespace-pre-wrap break-words max-h-40 overflow-y-auto">{toDelete.text}</blockquote>}
          <AlertDialogFooter className="gap-2 sm:gap-2 sm:space-x-0">
            <AlertDialogCancel disabled={deleteCommentMutation.isPending} className={cn(btnSecondary, "mt-0")}>Manter</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteCommentMutation.isPending}
              onClick={e => {
                e.preventDefault();
                if (!toDelete) return;
                deleteCommentMutation.mutate(toDelete.id, {
                  onSuccess: () => { setToDelete(null); toast({ title: "Comentário excluído" }); },
                  onError: (err: Error) => toast({ title: "Erro ao excluir comentário", description: err.message, variant: "destructive" }),
                });
              }}
              className={cn(btnSecondary, "bg-[var(--destructive)] text-[var(--destructive-foreground)] border-transparent enabled:hover:bg-[var(--destructive)] enabled:hover:opacity-90")}
            >
              {deleteCommentMutation.isPending ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Excluindo…</> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
