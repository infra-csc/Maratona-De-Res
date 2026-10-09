// Eventos do ciclo no histórico, com a situação da avaliação pelas mesmas
// regras de Eventos e da Central ("Abre em", "Próximo ciclo", "Aberto",
// "Fechado") e as datas com ano quando o período toca outro ano.
import { Link } from "wouter";
import type { CycleHistory } from "@workspace/api-client-react";
import { CalendarRange } from "lucide-react";
import { cn, plural, todayBR } from "@/lib/utils";
import { fmtEventDate, isNextCycleEvent, isOpenEvent, opensLabelFor, NEXT_CYCLE_BADGE, NEXT_CYCLE_NOTICE } from "../events/rules";
import { Panel } from "../dashboard/dashboard-ui";
import { Chip, EmptyBlock, FOCUS_RING, type Tone } from "./cycles-ui";

type Ev = CycleHistory["events"][number];

function eventSituation(e: Ev, cycle: CycleHistory["cycle"], today: string): { label: string; tone: Tone; title?: string; key: "next" | "opens" | "open" | "closed" } {
  if (!e.isHistorical && isNextCycleEvent(e, cycle)) return { label: NEXT_CYCLE_BADGE, tone: "info", title: NEXT_CYCLE_NOTICE, key: "next" };
  const opens = e.isHistorical ? null : opensLabelFor(e, cycle, today);
  if (opens && e.status === "open") return { label: opens, tone: "info", title: "A avaliação abre sozinha no dia seguinte ao fim do evento.", key: "opens" };
  if (isOpenEvent(e, cycle, today)) return { label: "Aberto", tone: "warn", title: "Aberto para avaliação", key: "open" };
  return { label: "Fechado", tone: "neutral", key: "closed" };
}

function EventDate({ e, today }: { e: Ev; today: string }) {
  // Ano aparece quando o período toca outro ano (fmtEventDate, como em Eventos).
  const otherYear = [e.startDate, e.endDate].some(d => !!d && d.slice(0, 4) !== today.slice(0, 4));
  return (
    <>
      {fmtEventDate(e.startDate, today, otherYear)}{e.endDate && e.endDate !== e.startDate ? ` a ${fmtEventDate(e.endDate, today, otherYear)}` : ""}
      {!otherYear && <span className="sr-only"> de {e.startDate.slice(0, 4)}</span>}
    </>
  );
}

const TH = "py-2.5 px-3 first:pl-5 last:pr-5 font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap border-b border-border text-left";
const TD = "py-2.5 px-3 first:pl-5 last:pr-5 border-b border-border";

export function HistoryEvents({ history }: { history: CycleHistory }) {
  const { cycle, events } = history;
  const today = todayBR();
  const rows = events.map(e => ({ e, sit: eventSituation(e, cycle, today) }));
  const confirmed = events.filter(e => e.resultsConfirmed).length;
  const count = (k: string) => rows.filter(r => r.sit.key === k).length;
  const summary = [
    plural(confirmed, "confirmado", "confirmados"),
    count("open") > 0 ? plural(count("open"), "aberto", "abertos") : null,
    count("opens") > 0 ? `${count("opens")} ainda vão abrir` : null,
    count("next") > 0 ? `${count("next")} do próximo ciclo` : null,
  ].filter(Boolean).join(" · ");

  return (
    <Panel
      labelId="history-events-title"
      testId="history-events"
      title={<>Eventos do ciclo <span className="font-condensed text-[15px] font-bold text-muted-foreground tabular-nums">{events.length}</span></>}
      sub={events.length > 0 ? <>{summary}. Só os confirmados entram na nota.</> : "Só os confirmados entram na nota."}
    >
      {events.length === 0 ? (
        <EmptyBlock icon={CalendarRange} title="Nenhum evento neste ciclo" className="py-10">Os eventos aparecem aqui quando entram no período do ciclo.</EmptyBlock>
      ) : (
        <>
          <ul className="lg:hidden border-t border-border divide-y divide-border" data-testid="list-history-events-mobile">
            {rows.map(({ e, sit }) => (
              <li key={e.id} className="px-4 py-3.5 space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/events/${e.id}`} className={cn("min-w-0 font-semibold leading-snug hover:underline underline-offset-2 rounded-sm", FOCUS_RING)}>{e.name}</Link>
                  <Chip tone={sit.tone} title={sit.title} className="shrink-0">{sit.label}</Chip>
                </div>
                <p className="text-[13px] text-muted-foreground tabular-nums">
                  <EventDate e={e} today={today} />
                  {[e.clientName, [e.city, e.state].filter(Boolean).join("/")].filter(Boolean).map(t => ` · ${t}`).join("")}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {e.resultsConfirmed ? <Chip tone="ok">Confirmados</Chip> : <Chip>Não confirmados</Chip>}
                  {e.isHistorical && <span className="text-[12px] text-muted-foreground">importado</span>}
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden lg:block overflow-x-auto relative">
            <table className="w-full min-w-[720px] text-[13.5px]" data-testid="table-history-events">
              <thead>
                <tr>
                  <th scope="col" className={TH}>Data</th>
                  <th scope="col" className={TH}>Evento</th>
                  <th scope="col" className={cn(TH, "hidden lg:table-cell")}>Cliente</th>
                  <th scope="col" className={TH}>Local</th>
                  <th scope="col" className={TH}>Situação</th>
                  <th scope="col" className={TH}>Resultados</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ e, sit }) => (
                  <tr key={e.id} data-testid={`row-history-event-${e.id}`} className="transition-colors duration-150 hover:bg-secondary/40">
                    <td className={cn(TD, "whitespace-nowrap tabular-nums")}><EventDate e={e} today={today} /></td>
                    <td className={TD}>
                      <Link href={`/events/${e.id}`} className={cn("font-semibold hover:underline underline-offset-2 rounded-sm", FOCUS_RING)}>{e.name}</Link>
                      {e.isHistorical && <span className="ml-2 text-[12px] text-muted-foreground">importado</span>}
                    </td>
                    <td className={cn(TD, "text-muted-foreground")}>{e.clientName ?? "—"}</td>
                    <td className={cn(TD, "whitespace-nowrap text-muted-foreground")}>{[e.city, e.state].filter(Boolean).join("/") || "—"}</td>
                    <td className={cn(TD, "whitespace-nowrap")} title={sit.title}><Chip tone={sit.tone}>{sit.label}</Chip></td>
                    <td className={TD}>{e.resultsConfirmed ? <Chip tone="ok">Confirmados</Chip> : <Chip>Não confirmados</Chip>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}
