// Comentários do evento (mural da equipe): lista, envio e exclusão.
// Componente autônomo — busca e muta os próprios comentários.
import { useState } from "react";
import { useGetEventComments, useCreateEventComment, useDeleteEventComment, getGetEventCommentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquare, SendHorizontal, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { cn, fmtDateTime } from "@/lib/utils";
import { matrixTextareaCls } from "../evaluations/conformity-bits";
import { Avatar, Bone, Chip, EmptyBlock, ErrorBlock, Section, btnGhost, btnPrimary, btnSmall, iconBtn } from "./detail-ui";

const COMMENT_ROLE_LABELS: Record<string, string> = {
  admin: "Admin", rh: "RH", diretoria: "Diretoria", gestor: "Gestor", avaliador: "Avaliador", visualizador: "Visualizador",
};

const COMMENT_TS_OPTS: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" };

/** readOnly: evento de ciclo fechado (só consulta) — lê os comentários, não escreve. */
export function EventCommentsPanel({ eventId, readOnly = false }: { eventId: number; readOnly?: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");

  // Exclusão em dois toques: o primeiro pede confirmação na própria linha.
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const { data: comments, isLoading, isError, refetch } = useGetEventComments(eventId, {
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
      onSuccess: () => {
        setConfirmingId(null);
        toast({ title: "Comentário excluído" });
        qc.invalidateQueries({ queryKey: getGetEventCommentsQueryKey(eventId) });
      },
      onError: () => toast({ title: "Erro ao excluir comentário", variant: "destructive" }),
    },
  });

  const canManage = !!user && ["admin", "rh"].includes(user.role);
  const trimmed = message.trim();

  const submit = () => {
    if (readOnly || !trimmed || createComment.isPending) return;
    createComment.mutate({ id: eventId, data: { message: trimmed } });
  };

  const count = comments?.length ?? 0;

  return (
    <Section id="event-comments" title="Comentários do evento" icon={MessageSquare} count={isLoading ? undefined : count}
      description="Mural da equipe de gestão: o que aconteceu e o que precisa de atenção.">
      <div data-testid="list-event-comments" className="max-h-[420px] overflow-y-auto overscroll-contain">
        {isLoading ? (
          <div role="status" aria-label="Carregando comentários" className="px-4 sm:px-5 py-4 space-y-3">
            {[0, 1].map(i => (
              <div key={i} className="flex gap-3"><Bone className="w-9 h-9 rounded-full" /><div className="flex-1 space-y-2"><Bone className="h-3 w-40" /><Bone className="h-4 w-3/4" /></div></div>
            ))}
          </div>
        ) : isError ? (
          <div className="p-4 sm:p-5"><ErrorBlock title="Não deu para carregar os comentários" onRetry={() => refetch()} /></div>
        ) : count === 0 ? (
          <EmptyBlock icon={MessageSquare} title="Nenhum comentário" className="py-9">
            {readOnly ? "Nenhum comentário neste evento." : "Nenhum comentário ainda. Seja o primeiro a comentar."}
          </EmptyBlock>
        ) : (
          <ul className="divide-y divide-border">
            {comments!.map(c => {
              const isOwner = !!user && user.id === c.userId;
              const canDelete = !readOnly && (isOwner || canManage);
              return (
                <li key={c.id} data-testid={`comment-${c.id}`} className="group px-4 sm:px-5 py-3.5 flex items-start gap-3">
                  <Avatar name={c.userName} className={cn(isOwner && "bg-primary text-primary-foreground")} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
                      <span className="font-condensed text-[15px] font-bold uppercase leading-tight text-foreground">{c.userName}</span>
                      {c.userRole && <Chip className="h-5 px-1.5 text-[11px]">{COMMENT_ROLE_LABELS[c.userRole] ?? c.userRole}</Chip>}
                      <span className="text-[12.5px] tabular-nums text-muted-foreground">{fmtDateTime(c.createdAt, COMMENT_TS_OPTS)}</span>
                    </div>
                    <p className="mt-1 text-[14.5px] leading-relaxed whitespace-pre-wrap break-words text-foreground">{c.message}</p>
                  </div>
                  {canDelete && confirmingId === c.id ? (
                    <div role="group" aria-label="Confirmar exclusão do comentário" className="shrink-0 flex items-center gap-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
                      <button
                        type="button"
                        autoFocus
                        data-testid={`button-confirm-delete-comment-${c.id}`}
                        onClick={() => deleteComment.mutate({ id: eventId, commentId: c.id })}
                        disabled={deleteComment.isPending}
                        aria-busy={deleteComment.isPending || undefined}
                        onKeyDown={(e) => { if (e.key === "Escape") setConfirmingId(null); }}
                        className={cn(btnSmall, "border-[var(--status-danger)]/50 text-[var(--status-danger-text)] enabled:hover:bg-[var(--status-danger-bg)]")}
                      >
                        {deleteComment.isPending ? <Loader2 size={14} aria-hidden className="motion-safe:animate-spin" /> : <Trash2 size={14} aria-hidden />}
                        Excluir
                      </button>
                      <button type="button" onClick={() => setConfirmingId(null)} disabled={deleteComment.isPending} className={btnGhost}>Manter</button>
                    </div>
                  ) : canDelete && (
                    <button
                      type="button"
                      data-testid={`button-delete-comment-${c.id}`}
                      onClick={() => setConfirmingId(c.id)}
                      disabled={deleteComment.isPending}
                      className={cn(iconBtn, "border-transparent bg-transparent text-muted-foreground hover:text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)] lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100 disabled:opacity-40")}
                      title="Excluir comentário"
                      aria-label={`Excluir comentário de ${c.userName}`}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {readOnly ? (
        <p className="px-4 sm:px-5 py-3.5 border-t border-border text-[13.5px] text-muted-foreground" data-testid="comments-readonly">
          Ciclo fechado — os comentários ficam só para consulta. Não é possível escrever ou apagar comentários neste evento.
        </p>
      ) : (
        <div className="px-4 sm:px-5 py-3.5 border-t border-border bg-secondary/30">
          <label htmlFor="new-event-comment" className="sr-only">Novo comentário</label>
          <div className="flex items-end gap-2">
            <textarea
              id="new-event-comment"
              data-testid="textarea-new-comment"
              value={message}
              rows={1}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
              }}
              placeholder="Escreva um comentário para toda a equipe…"
              className={cn(matrixTextareaCls, "flex-1 w-full border px-3.5 py-2.5 min-h-11 max-h-40 resize-none [field-sizing:content] text-[14.5px] focus-visible:outline-none")}
            />
            <button
              type="button"
              data-testid="button-send-comment"
              disabled={!trimmed || createComment.isPending}
              aria-busy={createComment.isPending || undefined}
              onClick={submit}
              className={cn(btnPrimary, "shrink-0 px-4")}
            >
              {createComment.isPending ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <SendHorizontal size={15} aria-hidden />}
              <span className="hidden sm:inline">{createComment.isPending ? "Enviando…" : "Enviar"}</span>
              <span className="sm:hidden sr-only">Enviar</span>
            </button>
          </div>
          <p className="mt-1.5 text-[12px] text-muted-foreground">Enter envia · Shift + Enter quebra a linha.</p>
        </div>
      )}
    </Section>
  );
}
