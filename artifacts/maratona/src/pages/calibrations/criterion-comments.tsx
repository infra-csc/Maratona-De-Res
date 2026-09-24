// Comentários da calibração de um critério: lista, exclusão e novo comentário (Ctrl+Enter).
import type React from "react";
import { MessageSquare, User, Trash2, Plus } from "lucide-react";
import { formatDateTime } from "./helpers";
import type { AddCommentMutation, CalibrationCommentItem, DeleteCommentMutation, ToastFn } from "./types";

export type CriterionCommentsProps = {
  criterionId: number;
  calComments: CalibrationCommentItem[] | undefined;
  newCommentTexts: Record<number, string>;
  setNewCommentTexts: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  canFinalize: boolean;
  addCommentMutation: AddCommentMutation;
  deleteCommentMutation: DeleteCommentMutation;
  toast: ToastFn;
};

export function CriterionComments({
  criterionId,
  calComments,
  newCommentTexts,
  setNewCommentTexts,
  canFinalize,
  addCommentMutation,
  deleteCommentMutation,
  toast,
}: CriterionCommentsProps) {
                                const criterionComments = (calComments ?? []).filter(cm => cm.criterionId === criterionId);
                                const commentText = newCommentTexts[criterionId] ?? "";
                                return (
                                  <div className="mt-2 pt-1.5 space-y-1.5" style={{ borderTop: "1px dashed var(--border)" }} onClick={e => e.stopPropagation()}>
                                    {/* Header */}
                                    <div className="flex items-center gap-2">
                                      <MessageSquare size={9} style={{ color: "var(--muted-foreground)" }} />
                                      <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                                        Comentários{criterionComments.length > 0 ? ` (${criterionComments.length})` : ""}
                                      </span>
                                    </div>
                                    {/* Comentários existentes */}
                                    {criterionComments.map(cm => (
                                      <div key={cm.id} className="rounded p-1.5 group/cm"
                                        style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                          <User size={8} style={{ color: "var(--muted-foreground)" }} />
                                          <span className="text-[11px] font-black">{cm.createdByName ?? "?"}</span>
                                          <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                                            {formatDateTime(new Date(cm.createdAt))}
                                          </span>
                                          {canFinalize && (
                                            <button type="button"
                                              onClick={() => deleteCommentMutation.mutate(cm.id, {
                                                onSuccess: () => toast({ title: "Comentário excluído" }),
                                                onError: (e: Error) => toast({ title: "Erro ao excluir comentário", description: e.message, variant: "destructive" }),
                                              })}
                                              disabled={deleteCommentMutation.isPending}
                                              className="ml-auto opacity-60 hover:opacity-100 transition-opacity disabled:opacity-30"
                                              style={{ color: "var(--muted-foreground)" }} title="Excluir">
                                              <Trash2 size={9} />
                                            </button>
                                          )}
                                        </div>
                                        <p className="text-[11px] leading-snug whitespace-pre-wrap">{cm.text}</p>
                                      </div>
                                    ))}
                                    {/* Input novo comentário */}
                                    {canFinalize && (
                                      <div className="flex gap-1.5">
                                        <textarea rows={1}
                                          placeholder="Adicionar comentário… (Ctrl+Enter)"
                                          value={commentText}
                                          onChange={e => {
                                            setNewCommentTexts(prev => ({ ...prev, [criterionId]: e.target.value }));
                                            e.target.style.height = "auto";
                                            e.target.style.height = e.target.scrollHeight + "px";
                                          }}
                                          onFocus={e => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                                          onKeyDown={e => {
                                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && commentText.trim()) {
                                              e.preventDefault();
                                              addCommentMutation.mutate(
                                                { criterionId: criterionId, text: commentText.trim() },
                                                { onSuccess: () => setNewCommentTexts(prev => ({ ...prev, [criterionId]: "" })) }
                                              );
                                            }
                                          }}
                                          className="flex-1 px-2 py-1.5 text-[11px] rounded resize-none leading-snug overflow-hidden focus:outline-none"
                                          style={{ border: "1px solid var(--border)", backgroundColor: "var(--secondary)", color: "var(--foreground)", minHeight: 30 }}
                                        />
                                        <button type="button"
                                          disabled={!commentText.trim() || addCommentMutation.isPending}
                                          onClick={() => addCommentMutation.mutate(
                                            { criterionId: criterionId, text: commentText.trim() },
                                            { onSuccess: () => setNewCommentTexts(prev => ({ ...prev, [criterionId]: "" })) }
                                          )}
                                          className="self-end h-8 w-8 rounded flex items-center justify-center disabled:opacity-40 hover:opacity-80 transition-opacity"
                                          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)", flexShrink: 0 }}
                                          title="Enviar comentário">
                                          <Plus size={12} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
}
