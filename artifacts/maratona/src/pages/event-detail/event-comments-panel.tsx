// Comentários do evento (mural da equipe): lista, envio e exclusão.
// Componente autônomo — busca e muta os próprios comentários.
import { useState } from "react";
import { useGetEventComments, useCreateEventComment, useDeleteEventComment, getGetEventCommentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { fmtDateTime } from "@/lib/utils";
import { CONDENSED, DANGER_TEXT } from "@/lib/premium-theme";
import { fieldStyle } from "./helpers";

const COMMENT_ROLE_LABELS: Record<string, string> = {
  admin: "Admin", rh: "RH", diretoria: "Diretoria", gestor: "Gestor", avaliador: "Avaliador", visualizador: "Visualizador",
};

const COMMENT_TS_OPTS: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" };

export function EventCommentsPanel({ eventId }: { eventId: number }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");

  const { data: comments, isLoading } = useGetEventComments(eventId, {
    query: { enabled: !!eventId, queryKey: getGetEventCommentsQueryKey(eventId) },
  });

  const createComment = useCreateEventComment({
    mutation: {
      onSuccess: () => {
        setMessage("");
        qc.invalidateQueries({ queryKey: getGetEventCommentsQueryKey(eventId) });
      },
      onError: () => toast({ title: "Erro ao enviar comentário", variant: "destructive" }),
    },
  });

  const deleteComment = useDeleteEventComment({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetEventCommentsQueryKey(eventId) }),
      onError: () => toast({ title: "Erro ao excluir comentário", variant: "destructive" }),
    },
  });

  const canManage = !!user && ["admin", "rh"].includes(user.role);
  const trimmed = message.trim();

  const submit = () => {
    if (!trimmed || createComment.isPending) return;
    createComment.mutate({ id: eventId, data: { message: trimmed } });
  };

  return (
    <section className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <MessageSquare size={16} style={{ color: "var(--accent-text)" }} />
        <span className="font-black uppercase tracking-tight text-xs" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>Comentários do Evento</span>
      </div>
      <div className="p-5 space-y-4">
        <div data-testid="list-event-comments" className="max-h-96 overflow-y-auto space-y-2.5 pr-1">
          {isLoading ? (
            <p className="text-xs font-bold uppercase text-center py-4" style={{ color: "var(--muted-foreground)" }}>Carregando...</p>
          ) : !comments || comments.length === 0 ? (
            <p className="text-xs font-bold uppercase text-center py-4" style={{ color: "var(--muted-foreground)" }}>Nenhum comentário ainda. Seja o primeiro a comentar.</p>
          ) : (
            comments.map(c => {
              const isOwner = !!user && user.id === c.userId;
              const canDelete = isOwner || canManage;
              return (
                <div key={c.id} data-testid={`comment-${c.id}`} className="rounded-lg p-3 flex items-start gap-3 group" style={{ backgroundColor: "var(--secondary)" }}>
                  <div className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center font-black text-[11px]" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
                    {c.userName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black uppercase text-xs">{c.userName}</span>
                      {c.userRole && (
                        <span className="px-1.5 py-0.5 rounded font-bold text-[11px] uppercase" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                          {COMMENT_ROLE_LABELS[c.userRole] ?? c.userRole}
                        </span>
                      )}
                      <span className="text-[11px] font-semibold" style={{ color: "var(--muted-foreground)" }}>{fmtDateTime(c.createdAt, COMMENT_TS_OPTS)}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap mt-1 break-words">{c.message}</p>
                  </div>
                  {canDelete && (
                    <button
                      type="button"
                      data-testid={`button-delete-comment-${c.id}`}
                      onClick={() => deleteComment.mutate({ id: eventId, commentId: c.id })}
                      disabled={deleteComment.isPending}
                      className="p-1 transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 shrink-0 disabled:opacity-40 hover:opacity-70"
                      style={{ color: DANGER_TEXT }}
                      title="Excluir comentário"
                      aria-label="Excluir comentário"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-start gap-2 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          <Textarea
            data-testid="textarea-new-comment"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            placeholder="Escreva um comentário para toda a equipe..."
            className="text-sm rounded-lg min-h-[44px]"
            style={fieldStyle}
          />
          <button
            type="button"
            data-testid="button-send-comment"
            disabled={!trimmed || createComment.isPending}
            onClick={submit}
            className="h-11 px-4 shrink-0 rounded-lg font-black uppercase tracking-tight text-xs disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            {createComment.isPending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </div>
    </section>
  );
}
