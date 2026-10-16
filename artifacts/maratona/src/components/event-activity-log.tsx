// Log de atividades do evento (avaliações, calibrações, comentários, matriz,
// publicações), em linha do tempo. Usado na tela de Calibração.
import { useState } from "react";
import { Activity, Star, Sliders, MessagesSquare, MessageSquare, ClipboardCheck, ShieldCheck, Send, ChevronDown, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useGetEventActivityLog, getGetEventActivityLogQueryKey } from "@workspace/api-client-react";
import { cn, fmtNum } from "@/lib/utils";
import { displayCriterionName } from "@/lib/criterion-name";

// Cor = tipo do registro (sempre junto do rótulo, nunca sozinha).
const KIND_CFG: Record<string, { icon: React.ReactNode; tone: string }> = {
  eval:          { icon: <Star size={12} />,           tone: "bg-[var(--status-ok-bg)] text-[var(--status-ok-text)]" },
  calibration:   { icon: <Sliders size={12} />,        tone: "bg-[var(--status-info-bg)] text-[var(--status-info-text)]" },
  cal_comment:   { icon: <MessagesSquare size={12} />, tone: "bg-secondary text-foreground" },
  event_comment: { icon: <MessageSquare size={12} />,  tone: "bg-secondary text-foreground" },
  conformity:    { icon: <ShieldCheck size={12} />,    tone: "bg-secondary text-foreground" },
  audit:         { icon: <ClipboardCheck size={12} />, tone: "bg-secondary text-muted-foreground" },
  publish:       { icon: <Send size={12} />,           tone: "bg-[var(--status-warn-bg)] text-[var(--status-warn-text)]" },
  publish_final: { icon: <Send size={12} />,           tone: "bg-primary text-primary-foreground" },
};

function fmtDTShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function EventActivityLog({ eventId }: { eventId: number }) {
  const { user } = useAuth();
  const canView = !!user && ["admin", "rh", "diretoria"].includes(user.role);
  const [expanded, setExpanded] = useState(false);
  const PAGE = 30;
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useGetEventActivityLog(eventId, {
    query: { queryKey: getGetEventActivityLogQueryKey(eventId), enabled: canView && expanded, staleTime: 30_000 },
  });

  if (!canView) return null;

  const entries = data ?? [];
  const visible = entries.slice(0, page * PAGE);
  const hasMore = entries.length > visible.length;

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        aria-controls={`activity-log-${eventId}`}
        className="w-full min-h-12 px-5 py-3 flex items-center gap-2.5 text-left hover:bg-secondary/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <Activity size={16} aria-hidden className="text-foreground" />
        <span className="font-condensed text-[12px] font-bold uppercase tracking-[0.08em] leading-none text-foreground">Log de atividades</span>
        {data && <span className="font-condensed text-[13px] font-bold tabular-nums text-muted-foreground">{entries.length}</span>}
        <span className="hidden xl:inline text-[13px] text-muted-foreground">Tudo o que aconteceu no evento, do mais recente ao mais antigo</span>
        <ChevronDown size={16} aria-hidden className={cn("ml-auto text-muted-foreground transition-transform duration-200", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div id={`activity-log-${eventId}`} className="border-t border-border px-5 py-4 motion-safe:animate-in motion-safe:fade-in-0 duration-150">
          {isLoading ? (
            <p className="flex items-center justify-center gap-2 text-[13px] py-6 text-muted-foreground"><Loader2 size={14} className="animate-spin" aria-hidden /> Carregando…</p>
          ) : isError ? (
            <p className="text-center text-[13px] py-6 text-muted-foreground">
              Não foi possível carregar o log.{" "}
              <button type="button" onClick={() => { void refetch(); }} className="font-semibold text-foreground underline underline-offset-2">Tentar de novo</button>
            </p>
          ) : entries.length === 0 ? (
            <p className="text-center text-[13px] py-6 text-muted-foreground">Nenhuma atividade registrada.</p>
          ) : (
            <ol className="space-y-0">
              {visible.map((e, i) => {
                const cfg = KIND_CFG[e.kind] ?? KIND_CFG.audit;
                return (
                  <li key={e.id} className="flex items-start gap-3">
                    <div className="flex flex-col items-center shrink-0 self-stretch">
                      <span className={cn("w-7 h-7 rounded-full flex items-center justify-center", cfg.tone)} aria-hidden>{cfg.icon}</span>
                      {i < visible.length - 1 && <span className="w-px flex-1 bg-border my-1 min-h-3" aria-hidden />}
                    </div>
                    <div className="flex-1 min-w-0 pb-3.5">
                      <div className="flex items-baseline gap-x-2 gap-y-0.5 flex-wrap">
                        <span className="text-[13.5px] font-semibold text-foreground">{e.label}</span>
                        {e.userName && <span className="text-[13px] text-foreground">{e.userName}</span>}
                        {e.criterionName && <span className="text-[13px] text-muted-foreground">· {displayCriterionName(e.criterionName)}</span>}
                        {e.score != null && <span className="font-condensed text-[15px] font-black tabular-nums text-foreground">→ {fmtNum(e.score, 2)}</span>}
                        <span className="ml-auto text-[12px] text-muted-foreground whitespace-nowrap tabular-nums">{fmtDTShort(e.createdAt)}</span>
                      </div>
                      {e.detail && <p className="text-[13px] mt-0.5 leading-snug text-muted-foreground break-words">“{e.detail}”</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {hasMore && (
            <button type="button" onClick={() => setPage(p => p + 1)}
              className="font-condensed w-full min-h-11 mt-1 rounded-lg border border-dashed border-border text-[13px] font-bold uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
              Ver mais · {entries.length - visible.length} restantes
            </button>
          )}
        </div>
      )}
    </section>
  );
}
