// Coluna de contexto (direita no desktop, depois dos critérios no celular):
// equipe alocada, Matriz de Conformidade (com faltas/atrasos e destaque) e os
// comentários do evento.
import type React from "react";
import { ChevronDown, MessageSquare } from "lucide-react";
import type { EventDetail, EventComment } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Eyebrow } from "../evaluations/ui";
import { formatDateTime } from "./helpers";
import { ConformityPanel } from "./conformity-panel";
import type { ConformityState } from "./use-conformity";

export type CalibrationSidebarProps = {
  selectedEventId: number | null;
  fullEvent: EventDetail | undefined;
  teamPanelOpen: boolean;
  setTeamPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  conformityState: ConformityState;
  eventComments: EventComment[] | undefined;
};

function initials(name: string) {
  return name.split(" ").filter(Boolean).map(n => n[0]).slice(0, 2).join("").toUpperCase();
}

export function CalibrationSidebar({
  selectedEventId, fullEvent, teamPanelOpen, setTeamPanelOpen, conformityState, eventComments,
}: CalibrationSidebarProps) {
  const { conformity, canManageConformity } = conformityState;
  const team = (fullEvent?.participants ?? []).filter(p => p.confirmed !== false && p.countsForScore !== false);
  return (
    <aside aria-label="Contexto do evento" className="rounded-2xl border border-border bg-card divide-y divide-border lg:sticky lg:top-[84px] lg:max-h-[calc(100dvh-100px)] lg:overflow-y-auto overscroll-contain">
      {/* Equipe */}
      {fullEvent?.participants && fullEvent.participants.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setTeamPanelOpen(o => !o)}
            aria-expanded={teamPanelOpen}
            aria-controls="cal-team-list"
            className="w-full min-h-12 px-4 py-3 flex items-center gap-2 text-left hover:bg-secondary/50 transition-colors rounded-t-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <Eyebrow as="span" className="text-foreground">Equipe alocada</Eyebrow>
            <span className="font-condensed text-[13px] font-bold tabular-nums text-muted-foreground">{team.length}</span>
            {!teamPanelOpen && team.length > 0 && (
              <span className="ml-2 flex -space-x-1.5" aria-hidden>
                {team.slice(0, 4).map(p => (
                  <span key={p.id} className="font-condensed w-6 h-6 rounded-full bg-secondary ring-2 ring-card text-[10.5px] font-black text-foreground flex items-center justify-center">{initials(p.employeeName)}</span>
                ))}
              </span>
            )}
            <ChevronDown size={16} aria-hidden className={cn("ml-auto text-muted-foreground transition-transform duration-200", teamPanelOpen && "rotate-180")} />
          </button>
          {teamPanelOpen && (
            <div id="cal-team-list" className="px-4 pb-3 motion-safe:animate-in motion-safe:fade-in-0 duration-150">
              {team.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">Nenhum colaborador ativo alocado.</p>
              ) : (
                <ul className="space-y-1">
                  {team.map(p => (
                    <li key={p.id} className="flex items-center gap-2.5 py-1">
                      <span className="font-condensed w-8 h-8 shrink-0 rounded-full bg-secondary text-[12px] font-black text-foreground flex items-center justify-center">{initials(p.employeeName)}</span>
                      <span className="min-w-0">
                        <span className="block text-[14px] font-semibold text-foreground leading-tight truncate">{p.employeeName}</span>
                        <span className="block text-[12.5px] text-muted-foreground truncate">{p.functionName}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      {/* Matriz de Conformidade — editável para gestores */}
      {(conformity || canManageConformity) && (
        <ConformityPanel selectedEventId={selectedEventId} fullEvent={fullEvent} conformityState={conformityState} />
      )}

      {/* Comentários do evento */}
      {eventComments && eventComments.length > 0 && (
        <section className="px-4 py-4">
          <Eyebrow as="h3" className="flex items-center gap-1.5 mb-2.5 text-foreground">
            <MessageSquare size={13} aria-hidden /> Comentários do evento
            <span className="text-muted-foreground tabular-nums">· {eventComments.length}</span>
          </Eyebrow>
          <ul className="space-y-2 max-h-56 overflow-y-auto">
            {eventComments.map((c, i) => (
              <li key={i} className="rounded-lg bg-secondary/60 px-3 py-2.5">
                <p className="flex items-baseline gap-2">
                  <span className="text-[13px] font-semibold text-foreground">{c.userName || "Admin"}</span>
                  <span className="text-[12px] text-muted-foreground">{c.createdAt ? formatDateTime(new Date(c.createdAt)) : ""}</span>
                </p>
                <p className="mt-0.5 text-[13.5px] leading-snug text-foreground whitespace-pre-wrap break-words">{c.message}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
