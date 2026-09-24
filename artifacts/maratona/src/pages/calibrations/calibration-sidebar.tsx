// Barra lateral direita (contexto sempre visível): resumo do evento, revisões
// sinalizadas, equipe, Matriz de Conformidade e comentários do evento.
import type React from "react";
import { Link } from "wouter";
import { ChevronDown, ChevronUp, ExternalLink, MessageSquare, Users } from "lucide-react";
import type { EventDetail, EventFeedback, EventComment } from "@workspace/api-client-react";
import { CONDENSED } from "@/lib/premium-theme";
import { formatDateTime } from "./helpers";
import { ConformityPanel } from "./conformity-panel";
import type { ConformityState } from "./use-conformity";
import type { ApiEvent } from "./types";
import { fmtNum } from "@/lib/utils";

export type CalibrationSidebarProps = {
  selectedEventId: number | null;
  pickedEvent: ApiEvent | undefined;
  feedback: EventFeedback | undefined;
  fullEvent: EventDetail | undefined;
  teamPanelOpen: boolean;
  setTeamPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  conformityState: ConformityState;
  eventComments: EventComment[] | undefined;
};

export function CalibrationSidebar({
  selectedEventId,
  pickedEvent,
  feedback,
  fullEvent,
  teamPanelOpen,
  setTeamPanelOpen,
  conformityState,
  eventComments,
}: CalibrationSidebarProps) {
  const { conformity, canManageConformity } = conformityState;
  return (
          <aside className="w-full lg:w-72 xl:w-80 shrink-0 lg:sticky lg:top-16 self-start lg:order-2 rounded-xl max-h-[50vh] lg:max-h-[calc(100vh-90px)] overflow-y-auto" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>

            {/* Event summary bar */}
            {pickedEvent && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center gap-3 min-w-0">
                  <h3 className="font-black uppercase tracking-tight text-sm truncate" style={{ fontFamily: CONDENSED }}>{pickedEvent.name}</h3>
                  <span className="text-[11px] font-bold uppercase truncate hidden sm:inline" style={{ color: "var(--muted-foreground)" }}>{pickedEvent.clientName}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {feedback && (
                    <span className="rounded-lg px-3 py-1.5 flex items-center gap-1.5" style={{ border: "1px solid var(--border)" }}>
                      <span className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Nota Final</span>
                      <span className="text-lg font-black leading-none" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>{fmtNum(feedback.eventScore, 1)}<span className="text-xs" style={{ color: "var(--muted-foreground)" }}>/100</span></span>
                    </span>
                  )}
                  <Link
                    href={`/events/${selectedEventId}`}
                    className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase rounded-lg px-3 py-1.5 transition-colors hover:opacity-80 shrink-0"
                    style={{ border: "1px solid var(--border)" }}
                  >
                    <ExternalLink size={12} /> Ver Evento
                  </Link>
                </div>
              </div>
            )}

            {/* Team */}
            {fullEvent?.participants && fullEvent.participants.length > 0 && (() => {
              const relevantParticipants = fullEvent.participants!.filter(p => p.confirmed !== false && p.countsForScore !== false);
              return (
                <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <button type="button" onClick={() => setTeamPanelOpen(o => !o)} className="flex items-center gap-2 w-full text-left mb-2">
                    <Users size={13} className="shrink-0" />
                    <span className="text-[11px] font-black uppercase">Equipe Alocada <span style={{ color: "var(--muted-foreground)" }}>({relevantParticipants.length})</span></span>
                    {teamPanelOpen ? <ChevronUp size={12} className="ml-auto" style={{ color: "var(--muted-foreground)" }} /> : <ChevronDown size={12} className="ml-auto" style={{ color: "var(--muted-foreground)" }} />}
                  </button>
                  {teamPanelOpen && (
                    relevantParticipants.length === 0 ? (
                      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Nenhum colaborador ativo alocado.</p>
                    ) : (
                      <div className="space-y-1">
                        {relevantParticipants.map(p => {
                          return (
                            <div key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ backgroundColor: "var(--secondary)" }}>
                              <div className="w-7 h-7 rounded-md flex items-center justify-center font-black text-[11px] shrink-0" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
                                {p.employeeName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-black uppercase text-[11px] leading-tight truncate">{p.employeeName}</p>
                                <p className="text-[11px] font-bold uppercase truncate" style={{ color: "var(--muted-foreground)" }}>{p.functionName}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              );
            })()}

            {/* Conformidade — editável para gestores */}
            {(conformity || canManageConformity) && (
              <ConformityPanel selectedEventId={selectedEventId} fullEvent={fullEvent} conformityState={conformityState} />
            )}

            {/* Event Comments */}
            {eventComments && eventComments.length > 0 && (
              <div className="px-4 py-3">
                <p className="text-[11px] font-black uppercase mb-2 flex items-center gap-1.5"><MessageSquare size={13} /> Comentários <span style={{ color: "var(--muted-foreground)" }}>({eventComments.length})</span></p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {eventComments.map((c, i) => (
                    <div key={i} className="text-[11px] rounded-lg px-3 py-2" style={{ backgroundColor: "var(--secondary)" }}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold uppercase text-[11px]">{c.userName || "Admin"}</span>
                        <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{c.createdAt ? formatDateTime(new Date(c.createdAt)) : ""}</span>
                      </div>
                      <p className="leading-snug whitespace-pre-wrap">{c.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
  );
}
