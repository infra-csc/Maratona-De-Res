import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Star, Sliders, MessagesSquare, MessageSquare, ClipboardCheck, History } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getAuthToken } from "@/lib/custom-fetch";
import { CONDENSED } from "@/lib/premium-theme";

interface ActivityEntry {
  id: string;
  kind: string;
  label: string;
  userName: string | null;
  criterionName: string | null;
  score: number | null;
  detail: string | null;
  createdAt: string;
}

const KIND_CFG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  eval:          { icon: <Star size={9} />,            color: "#9ab000", bg: "rgba(154,176,0,0.14)" },
  calibration:   { icon: <Sliders size={9} />,         color: "#6366f1", bg: "rgba(99,102,241,0.13)" },
  cal_comment:   { icon: <MessagesSquare size={9} />,  color: "#e8a23d", bg: "rgba(232,162,61,0.14)" },
  event_comment: { icon: <MessageSquare size={9} />,   color: "#64748b", bg: "rgba(100,116,139,0.14)" },
  audit:         { icon: <ClipboardCheck size={9} />,  color: "#94a3b8", bg: "rgba(148,163,184,0.13)" },
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

  const { data, isLoading } = useQuery<ActivityEntry[]>({
    queryKey: ["event-activity-log", eventId],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`/api/events/${eventId}/activity-log`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error("Erro ao carregar log");
      return res.json();
    },
    enabled: canView && expanded,
    staleTime: 30_000,
  });

  if (!canView) return null;

  const entries = data ?? [];
  const visible = entries.slice(0, page * PAGE);
  const hasMore = entries.length > visible.length;

  return (
    <section className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full px-5 py-3 flex items-center gap-2 hover:opacity-80 transition-opacity"
        style={{ borderBottom: expanded ? "1px solid var(--border)" : "none" }}
      >
        <Activity size={16} style={{ color: "var(--accent)" }} />
        <span className="font-black uppercase tracking-tight text-xs" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>
          Log de Atividades
        </span>
        {data && (
          <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}>
            {entries.length}
          </span>
        )}
        <History size={12} className="ml-auto"
          style={{ color: "var(--muted-foreground)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>

      {expanded && (
        <div className="p-4">
          {isLoading ? (
            <p className="text-center text-xs py-6" style={{ color: "var(--muted-foreground)" }}>Carregando…</p>
          ) : entries.length === 0 ? (
            <p className="text-center text-xs py-6" style={{ color: "var(--muted-foreground)" }}>Nenhuma atividade registrada.</p>
          ) : (
            <div className="space-y-px">
              {visible.map((e, i) => {
                const cfg = KIND_CFG[e.kind] ?? KIND_CFG.audit;
                return (
                  <div key={e.id} className="flex items-start gap-2.5 py-1.5 px-1 rounded hover:bg-secondary/50 transition-colors">
                    <div className="flex flex-col items-center shrink-0 mt-0.5">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full text-[8px] font-bold shrink-0"
                        style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                        {cfg.icon}
                      </span>
                      {i < visible.length - 1 && (
                        <div className="w-px flex-1 mt-0.5" style={{ backgroundColor: "var(--border)", minHeight: 8 }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                          {e.label}
                        </span>
                        {e.userName && (
                          <span className="text-[11px] font-bold truncate">{e.userName}</span>
                        )}
                        {e.criterionName && (
                          <span className="text-[10px] truncate" style={{ color: "var(--muted-foreground)" }}>· {e.criterionName}</span>
                        )}
                        {e.score != null && (
                          <span className="text-[10px] font-black" style={{ color: cfg.color }}>→ {e.score.toFixed(2)}</span>
                        )}
                        <span className="ml-auto text-[9px] shrink-0 whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>
                          {fmtDTShort(e.createdAt)}
                        </span>
                      </div>
                      {e.detail && (
                        <p className="text-[10px] mt-0.5 leading-snug" style={{ color: "var(--muted-foreground)" }}>"{e.detail}"</p>
                      )}
                    </div>
                  </div>
                );
              })}
              {hasMore && (
                <button type="button" onClick={() => setPage(p => p + 1)}
                  className="w-full text-center text-[10px] font-black uppercase py-2 mt-1 rounded hover:opacity-70 transition-opacity"
                  style={{ color: "var(--muted-foreground)", border: "1px dashed var(--border)" }}>
                  Ver mais ({entries.length - visible.length} restantes)
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
