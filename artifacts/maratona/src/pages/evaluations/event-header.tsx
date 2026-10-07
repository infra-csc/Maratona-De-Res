import { Users, Calendar, MapPin, Rocket, CheckCircle2, CalendarClock } from "lucide-react";
import type { MyAreaUpcomingEvent } from "@workspace/api-client-react";
import { fmtDate, fmtOpensOn, plural, todayBR } from "@/lib/utils";
import { CONDENSED } from "@/lib/premium-theme";
import { NEXT_CYCLE_BADGE, NEXT_CYCLE_NOTICE } from "../events/rules";

/**
 * Estado vazio: nenhum evento selecionado na sidebar. Sem nada a responder
 * ("Tudo em dia"), não manda escolher evento: diz que está em dia e mostra o
 * que abre em breve, quando houver.
 */
export function NoEventSelected({ pendingCount = null, upcoming = [] }: { pendingCount?: number | null; upcoming?: MyAreaUpcomingEvent[] }) {
  if (pendingCount === 0) {
    const today = todayBR();
    const next = upcoming.slice(0, 3);
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-4 sm:px-8" data-testid="evaluator-all-done">
        <div className="border border-border rounded-xl bg-card p-8 sm:p-10 max-w-sm w-full flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--accent)" }}>
            <CheckCircle2 style={{ color: "var(--accent-foreground)" }} size={36} aria-hidden />
          </div>
          <div>
            <h2 className="text-2xl uppercase font-black tracking-tight text-foreground leading-tight" style={{ fontFamily: CONDENSED }}>
              Tudo em dia
            </h2>
            <p className="text-muted-foreground text-sm mt-1.5 leading-relaxed">Nenhuma avaliação pendente.</p>
          </div>
          {next.length > 0 && (
            <div className="w-full text-left border-t border-border pt-3" data-testid="evaluator-all-done-upcoming">
              <p className="text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-2" style={{ color: "var(--status-info-text)" }}>
                <CalendarClock size={12} aria-hidden /> Abrem em breve
              </p>
              <ul className="space-y-1.5">
                {next.map(u => (
                  <li key={u.eventId} className="flex items-start justify-between gap-2">
                    <span className="text-[12.5px] font-black uppercase leading-snug text-foreground break-words min-w-0" style={{ fontFamily: CONDENSED }}>{u.eventName}</span>
                    {u.opensOn && (
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase whitespace-nowrap" style={{ fontFamily: CONDENSED, backgroundColor: "var(--status-info-bg)", color: "var(--status-info-text)" }}>
                        Abre em {fmtOpensOn(u.opensOn, today)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {upcoming.length > next.length && (
                <p className="text-[11px] text-muted-foreground mt-2">e mais {plural(upcoming.length - next.length, "evento")} na lista ao lado.</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-8">
      <div className="border border-border rounded-xl bg-card p-10 max-w-sm w-full flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-xl bg-primary flex items-center justify-center">
          <Rocket className="text-primary-foreground" size={36} />
        </div>
        <div>
          <h2 className="text-2xl uppercase font-black tracking-tight text-foreground leading-tight" style={{ fontFamily: CONDENSED }}>
            Pronto para avaliar
          </h2>
          <p className="text-muted-foreground text-sm mt-1.5 leading-relaxed">
            Selecione um evento ao lado para iniciar ou continuar sua avaliação.
          </p>
        </div>
      </div>
    </div>
  );
}

// O mínimo que a faixa do evento usa (vem de GET /evaluations/my-area).
export interface EventHeaderInfo {
  name: string;
  cycleName?: string | null;
  clientName?: string | null;
  city?: string | null;
  state?: string | null;
  location?: string | null;
  startDate: string;
  endDate: string;
  status: string;
  participantCount?: number | null;
}

// Faixa compacta com nome, cliente, local, datas e participantes do evento.
export function EventHeaderStrip({ currentEvent, nextCycle = false }: { currentEvent: EventHeaderInfo; nextCycle?: boolean }) {
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Faixa de título do evento */}
      <div className="bg-card px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-black uppercase tracking-tight text-foreground leading-tight" style={{ fontFamily: CONDENSED }}>{currentEvent.name}</h2>
            {currentEvent.cycleName && (
              <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded border border-border text-muted-foreground bg-secondary">{currentEvent.cycleName}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
            {currentEvent.clientName && <span className="text-foreground font-bold">{currentEvent.clientName}</span>}
            {(currentEvent.city || currentEvent.location) && (
              <span className="flex items-center gap-1"><MapPin size={9} />{currentEvent.city ? `${currentEvent.city}${currentEvent.state ? `, ${currentEvent.state}` : ""}` : currentEvent.location}</span>
            )}
            <span className="flex items-center gap-1"><Calendar size={9} />{fmtDate(currentEvent.startDate, { day: "2-digit", month: "2-digit", year: "numeric" })} — {fmtDate(currentEvent.endDate, { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {nextCycle ? (
            <span data-testid="badge-evaluator-next-cycle" title={NEXT_CYCLE_NOTICE} className="text-[11px] font-black uppercase px-2.5 py-1 rounded" style={{ backgroundColor: "var(--status-info-bg)", color: "var(--status-info-text)" }}>{NEXT_CYCLE_BADGE}</span>
          ) : currentEvent.status === "open" ? (
            <span className="text-[11px] font-black uppercase px-2.5 py-1 rounded bg-accent text-accent-foreground">Aberto</span>
          ) : (
            <span className="text-[11px] font-black uppercase px-2.5 py-1 rounded bg-secondary border border-border text-muted-foreground">Fechado</span>
          )}
          {!!currentEvent.participantCount && (
            <span className="text-[11px] font-black text-muted-foreground flex items-center gap-1"><Users size={11} />{currentEvent.participantCount} part.</span>
          )}
        </div>
      </div>
    </div>
  );
}
