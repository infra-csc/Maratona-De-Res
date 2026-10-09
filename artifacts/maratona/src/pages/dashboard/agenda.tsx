// Próximos fins de semana com eventos do ciclo atual (operacional): o que vem
// por aí e quando cada um abre para avaliação.
import type { Cycle, Event } from "@workspace/api-client-react";
import { Link } from "wouter";
import { CalendarDays, CalendarX2 } from "lucide-react";
import { evaluationOpensOn, fmtOpensOn, getCycleWeekends, weekendsEnd } from "@/lib/utils";
import { Bone, FooterLink, InlineState, Panel, RowArrow, rowLinkCls } from "./dashboard-ui";

type CycleLike = Pick<Cycle, "startDate" | "endDate"> | null | undefined;

/** Até 5 fins de semana (dos próximos 8) com eventos ainda não encerrados. */
export function upcomingWeekends(cycle: CycleLike, events: Event[] | undefined) {
  // Fuso local: toISOString() é UTC e escondia o fim de semana atual entre 21h e meia-noite.
  const today = new Date().toLocaleDateString("sv-SE");
  // Até o último evento do ciclo: evento "fora do período" (depois do fim)
  // também aparece nos próximos fins de semana (como na lista de Eventos).
  return getCycleWeekends(cycle?.startDate, weekendsEnd(cycle?.endDate, events))
    .filter(w => w.sun >= today)
    .slice(0, 8)
    .map(w => ({
      ...w,
      events: (events ?? []).filter(ev => ev.status !== "closed" && ev.startDate <= w.sun && (ev.endDate ?? ev.startDate) >= w.sat),
    }))
    .filter(w => w.events.length > 0)
    .slice(0, 5);
}

/** "sáb 11 – dom 12 out" a partir do sábado. */
function weekendTitle(sat: string, sun: string) {
  const d = (iso: string) => new Date(`${iso}T12:00:00`);
  const day = (iso: string) => String(d(iso).getDate()).padStart(2, "0");
  const month = (iso: string) => d(iso).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return month(sat) === month(sun) ? { days: `${day(sat)}–${day(sun)}`, month: month(sun) } : { days: `${day(sat)}/${month(sat)}–${day(sun)}`, month: month(sun) };
}

export function AgendaPanel({ cycle, events, loading }: { cycle: CycleLike; events: Event[] | undefined; loading: boolean }) {
  const weeks = upcomingWeekends(cycle, events);
  const today = new Date().toLocaleDateString("sv-SE");
  return (
    <Panel
      labelId="dash-agenda-title"
      testId="dashboard-agenda"
      icon={CalendarDays}
      title="Próximos fins de semana"
      sub="Eventos do ciclo atual e quando abrem para avaliação."
      footer={<FooterLink href="/events">Todos os eventos</FooterLink>}
    >
      {loading ? (
        <div className="px-4 lg:px-5 pb-5 space-y-3" aria-hidden>{[0, 1, 2].map(i => <Bone key={i} className="h-10 w-full" />)}</div>
      ) : weeks.length === 0 ? (
        <InlineState icon={CalendarX2} title="Nenhum evento nos próximos fins de semana." testId="dashboard-agenda-empty"
          className="h-full min-h-[96px] items-center">
          Os eventos do ciclo aparecem aqui conforme as datas se aproximam.
        </InlineState>
      ) : (
        <ol className="border-t border-border divide-y divide-border">
          {weeks.map(w => {
            const t = weekendTitle(w.sat, w.sun);
            return (
              <li key={w.sat} className="flex">
                <div className="w-[68px] lg:w-[76px] shrink-0 border-r border-border py-3 text-center">
                  <span className="block font-condensed text-[18px] font-black leading-none tabular-nums text-foreground whitespace-nowrap">{t.days}</span>
                  <span className="mt-1 block font-condensed text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{t.month}</span>
                </div>
                <ul className="flex-1 min-w-0">
                  {w.events.map(ev => {
                    const opens = evaluationOpensOn(ev);
                    return (
                      <li key={ev.id}>
                        <Link href={`/events/${ev.id}`} className={rowLinkCls}>
                          <span className="flex-1 min-w-0">
                            <span className="block text-[14px] font-semibold text-foreground truncate" title={ev.name}>{ev.name}</span>
                            <span className="block text-[12.5px] text-muted-foreground truncate">
                              {[ev.city, opens && opens > today ? `Avaliação abre em ${fmtOpensOn(opens)}` : null].filter(Boolean).join(" · ") || " "}
                            </span>
                          </span>
                          <RowArrow />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
