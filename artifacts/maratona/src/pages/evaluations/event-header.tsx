import { Users, CalendarDays, MapPin, CheckCircle2, CalendarClock, ArrowRight, ListChecks } from "lucide-react";
import type { MyAreaUpcomingEvent } from "@workspace/api-client-react";
import { fmtDate, fmtOpensOn, plural, todayBR } from "@/lib/utils";
import { NEXT_CYCLE_BADGE, NEXT_CYCLE_NOTICE } from "../events/rules";
import { Chip, Eyebrow, btnPrimary } from "./ui";

export interface NextEventInfo { id: number; name: string; detail: string; answered: number; total: number }

/**
 * Painel sem evento aberto. Com pendências: quantas são e um atalho para a
 * primeira da lista. Sem nada a responder ("Tudo em dia"): diz que está em
 * dia e mostra o que abre em breve, quando houver.
 */
export function NoEventSelected({ pendingCount = null, upcoming = [], next = null, onOpen }: {
  pendingCount?: number | null;
  upcoming?: MyAreaUpcomingEvent[];
  next?: NextEventInfo | null;
  onOpen?: (id: number) => void;
}) {
  const today = todayBR();
  if (pendingCount === 0) {
    const soon = upcoming.slice(0, 3);
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-2" data-testid="evaluator-all-done">
        <div className="w-full max-w-md">
          <span className="w-12 h-12 rounded-full bg-accent text-accent-foreground flex items-center justify-center motion-safe:animate-in motion-safe:zoom-in-90 duration-300">
            <CheckCircle2 size={24} aria-hidden />
          </span>
          <h2 className="font-condensed mt-5 text-[40px] font-black uppercase leading-[0.95] tracking-[-0.02em] text-foreground">Tudo em dia</h2>
          <p className="mt-2 text-[15px] text-muted-foreground leading-relaxed">Nenhuma avaliação pendente. Cada evento novo aparece na lista no dia seguinte ao fim dele.</p>
          {soon.length > 0 && (
            <div className="mt-7" data-testid="evaluator-all-done-upcoming">
              <Eyebrow className="flex items-center gap-1.5 text-[var(--status-info-text)]"><CalendarClock size={13} aria-hidden /> Abrem em breve</Eyebrow>
              <ul className="mt-2.5 rounded-xl border border-border bg-card divide-y divide-border">
                {soon.map(u => (
                  <li key={u.eventId} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="min-w-0 text-[14px] font-semibold text-foreground leading-snug break-words">{u.eventName}</span>
                    {u.opensOn && <Chip tone="info">Abre em {fmtOpensOn(u.opensOn, today)}</Chip>}
                  </li>
                ))}
              </ul>
              {upcoming.length > soon.length && (
                <p className="text-[13px] text-muted-foreground mt-2">e mais {plural(upcoming.length - soon.length, "evento")} na lista ao lado.</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-2">
      <div className="w-full max-w-md">
        <span className="w-12 h-12 rounded-full bg-secondary text-foreground flex items-center justify-center"><ListChecks size={22} aria-hidden /></span>
        {pendingCount != null && pendingCount > 0 ? (
          <>
            <h2 className="font-condensed mt-5 text-[40px] font-black uppercase leading-[0.95] tracking-[-0.02em] text-foreground">
              {plural(pendingCount, "evento", "eventos")} a responder
            </h2>
            <p className="mt-2 text-[15px] text-muted-foreground leading-relaxed">Escolha um evento na lista para dar as notas da equipe de Cenografia. Dá para parar e continuar depois.</p>
          </>
        ) : (
          <>
            <h2 className="font-condensed mt-5 text-[40px] font-black uppercase leading-[0.95] tracking-[-0.02em] text-foreground">Pronto para avaliar</h2>
            <p className="mt-2 text-[15px] text-muted-foreground leading-relaxed">Selecione um evento ao lado para iniciar ou continuar sua avaliação.</p>
          </>
        )}
        {next && onOpen && (
          <div className="mt-7 rounded-xl border border-border bg-card p-4">
            <Eyebrow>Próximo da lista</Eyebrow>
            <p className="font-condensed mt-2 text-[20px] font-black uppercase leading-tight text-foreground break-words">{next.name}</p>
            <p className="text-[13px] text-muted-foreground mt-0.5">{next.detail}</p>
            <button type="button" onClick={() => onOpen(next.id)} className={`${btnPrimary} mt-4 w-full sm:w-auto`}>
              {next.answered > 0 ? "Continuar avaliação" : "Começar avaliação"} <ArrowRight size={15} aria-hidden />
            </button>
          </div>
        )}
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

// Cabeçalho do evento aberto: nome, cliente, local, datas, situação e QUEM é avaliado.
export function EventHeaderStrip({ currentEvent, nextCycle = false, currentCycleName = null }: { currentEvent: EventHeaderInfo; nextCycle?: boolean; currentCycleName?: string | null }) {
  const place = currentEvent.city ? `${currentEvent.city}${currentEvent.state ? `, ${currentEvent.state}` : ""}` : currentEvent.location;
  const sameDay = !currentEvent.endDate || currentEvent.endDate === currentEvent.startDate;
  const fmt = (d: string) => fmtDate(d, { day: "2-digit", month: "2-digit", year: "numeric" });
  const showCycle = !!currentEvent.cycleName && currentEvent.cycleName !== currentCycleName;
  return (
    <header className="rounded-2xl border border-border bg-card px-5 sm:px-7 py-5 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>{currentEvent.clientName ? `Evento · ${currentEvent.clientName}` : "Evento"}</Eyebrow>
          <h2 className="font-condensed mt-2 text-[28px] md:text-[34px] font-black uppercase leading-[0.98] tracking-[-0.015em] text-foreground break-words">{currentEvent.name}</h2>
          <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} aria-hidden />{sameDay ? fmt(currentEvent.startDate) : `${fmt(currentEvent.startDate)} – ${fmt(currentEvent.endDate)}`}</span>
            {place && <span className="inline-flex items-center gap-1.5"><MapPin size={14} aria-hidden />{place}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:justify-end sm:shrink-0">
          {showCycle && <Chip>{currentEvent.cycleName}</Chip>}
          {nextCycle ? (
            <Chip tone="info" data-testid="badge-evaluator-next-cycle" title={NEXT_CYCLE_NOTICE}>{NEXT_CYCLE_BADGE}</Chip>
          ) : currentEvent.status === "open" ? (
            <Chip tone="ok">Aberto para avaliação</Chip>
          ) : (
            <Chip>Fechado</Chip>
          )}
        </div>
      </div>

      {/* Quem é avaliado: sempre a equipe de Cenografia do evento. */}
      <div className="mt-5 flex items-start gap-3 rounded-xl bg-secondary/70 px-4 py-3">
        <span className="mt-0.5 w-8 h-8 shrink-0 rounded-full bg-card flex items-center justify-center text-foreground"><Users size={15} aria-hidden /></span>
        <p className="text-[14px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Você avalia a equipe de Cenografia deste evento</span>
          {currentEvent.participantCount ? <> · {plural(currentEvent.participantCount, "participante")}</> : null}.{" "}
          Cada nota de 0 a 10 vale para a equipe inteira, não para uma pessoa.
        </p>
      </div>
    </header>
  );
}
