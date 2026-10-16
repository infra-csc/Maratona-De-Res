// Tabela de eventos (cabeçalho ordenável + linhas, agrupadas por fim de semana
// quando a ordem é por data) e a legenda/contagem abaixo dela.
import type { Cycle, User } from "@workspace/api-client-react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn, plural, type getCycleWeekends } from "@/lib/utils";
import { EventRow, EventCard, type EventRowActions } from "./event-row";
import { nextColSort, isColActive, isColAsc } from "./url-filters";
import { useWideScreen } from "./use-wide-screen";
import { deriveEventRow, type AreaResponseCount } from "./rules";
import { Chip, Eyebrow, FOCUS_RING, surfaceCls } from "./events-ui";
import type { EventItem } from "./types";

type Weekend = ReturnType<typeof getCycleWeekends>[number];

// Data com 96px (cabe "Fora do período" embaixo); Status com 144px (cabe
// "Abre em DD/MM", "Próximo ciclo" e "Aguardando RH →").
const COLS_WITH_SCORE = "minmax(0,1fr) 96px 56px 112px 112px 92px 80px 144px 100px";
const COLS_NO_SCORE = "minmax(0,1fr) 96px 56px 116px 116px 96px 156px 100px";

const COLUMNS = ["name", "date", "participants", "evaluated", "calibr", "matrix", "score"] as const;
const COLUMN_LABELS: Record<(typeof COLUMNS)[number], string> = {
  name: "Evento", date: "Data", participants: "Part.",
  evaluated: "Avaliações", calibr: "Publicadas", matrix: "Matriz", score: "Nota",
};
const COLUMN_TITLES: Partial<Record<(typeof COLUMNS)[number], string>> = {
  participants: "Participantes",
  evaluated: "Respostas dos critérios (no ciclo por área, uma por área)",
  calibr: "Critérios com calibração publicada (final + parcial)",
  matrix: "Itens da Matriz de Conformidade respondidos",
};

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Fim de semana da "semana do evento" (segunda a domingo) — o mesmo agrupamento da Central. */
function weekendOf(date: string | null | undefined, weekends: Weekend[]): Weekend | null {
  if (!date) return null;
  return weekends.find(w => addDays(w.sat, -5) <= date && date <= w.sun) ?? null;
}

type Group = { key: string; label: string | null; sat: string | null; events: EventItem[] };

/** Grupos por fim de semana quando a ordem é por data (a ordem da lista é mantida). */
function groupEvents(events: EventItem[], grouped: boolean, weekends: Weekend[]): Group[] {
  if (!grouped || weekends.length === 0) return [{ key: "all", label: null, sat: null, events }];
  const out: (Group & { raw: string })[] = [];
  for (const ev of events) {
    const wk = weekendOf(ev.startDate, weekends);
    const raw = wk?.sat ?? "other";
    const last = out.at(-1);
    if (last && last.raw === raw) last.events.push(ev);
    else out.push({ key: `${raw}-${out.length}`, raw, label: wk ? `Fim de semana ${wk.label}` : "Outras datas", sat: wk?.sat ?? null, events: [ev] });
  }
  return out;
}

/** "3 eventos · 1 fechado · 2 a fechar" — o que falta no fim de semana, num relance. */
function GroupSummary({ events, cycleOf, areaCountsOf }: { events: EventItem[]; cycleOf?: (ev: EventItem) => Cycle | null; areaCountsOf?: (ev: EventItem) => AreaResponseCount | null }) {
  let closed = 0, waiting = 0;
  for (const ev of events) {
    const r = deriveEventRow(ev, undefined, cycleOf?.(ev) ?? null, areaCountsOf?.(ev) ?? null);
    if (r.badge.label === "Pub. Final") closed++;
    else if (r.nextCycle || r.notOpenYet) waiting++;
  }
  const open = events.length - closed - waiting;
  return (
    <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
      <span className="font-condensed text-[13px] font-bold uppercase tracking-[0.05em] tabular-nums text-foreground">{plural(events.length, "evento", "eventos")}</span>
      {closed > 0 && <span className="inline-flex items-center gap-1.5"><span aria-hidden className="w-1.5 h-1.5 rounded-full bg-[var(--status-ok)]" />{plural(closed, "publicado", "publicados")}</span>}
      {open > 0 && <span className="inline-flex items-center gap-1.5"><span aria-hidden className="w-1.5 h-1.5 rounded-full bg-[var(--status-warn)]" />{open} a fechar</span>}
      {waiting > 0 && <span className="inline-flex items-center gap-1.5"><span aria-hidden className="w-1.5 h-1.5 rounded-full bg-[var(--status-info)]" />{waiting} a abrir</span>}
    </span>
  );
}

function GroupHeading({ g, currentSat, summary, className }: { g: Group; currentSat: string | null; summary: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5", className)}>
      <Eyebrow as="span" className="text-foreground">{g.label}</Eyebrow>
      {g.sat != null && g.sat === currentSat && <Chip tone="warn" className="h-5 px-1.5 text-[11px]">Atual</Chip>}
      <span className="ml-auto">{summary}</span>
    </div>
  );
}

type EventsTableProps = EventRowActions & {
  events: EventItem[];
  user: User | null;
  sortBy: string;
  setSortBy: (v: string) => void;
  /** Ciclo anterior / Total geral: linhas só de consulta. */
  readOnly?: boolean;
  /** Total geral: nome do ciclo de cada evento (selo na coluna Data). */
  cycleLabelOf?: (ev: EventItem) => string | null;
  /** Ciclo de cada evento (selo "Fora do período"). */
  cycleOf?: (ev: EventItem) => Cycle | null;
  /** Ciclo por área: respostas por área de cada evento (a mesma conta da Central). */
  areaCountsOf?: (ev: EventItem) => AreaResponseCount | null;
  /** Fins de semana do ciclo (agrupa a lista quando a ordem é por data). */
  weekends?: Weekend[];
  currentSat?: string | null;
  /** Mostra a Nota (o operador não vê nota). */
  showScore?: boolean;
};

export function EventsTable({ events, user, sortBy, setSortBy, readOnly = false, cycleLabelOf, cycleOf, areaCountsOf, weekends = [], currentSat = null, showScore = true, ...actions }: EventsTableProps) {
  const wide = useWideScreen();
  const grouped = sortBy === "dateDesc" || sortBy === "dateAsc";
  const groups = groupEvents(events, grouped, weekends);
  const rowProps = (ev: EventItem) => ({
    ev, user, readOnly, showScore,
    cycleLabel: cycleLabelOf?.(ev) ?? null,
    eventCycle: cycleOf?.(ev) ?? null,
    areaCounts: areaCountsOf?.(ev) ?? null,
    ...actions,
  });
  const summary = (g: Group) => <GroupSummary events={g.events} cycleOf={cycleOf} areaCountsOf={areaCountsOf} />;

  // Celular e tablet: cartões (a tabela de 9 colunas não cabe).
  if (!wide) return (
    <div data-testid="events-cards" className="space-y-5">
      {groups.map(g => (
        <section key={g.key} aria-label={g.label ?? "Eventos"}>
          {g.label && <GroupHeading g={g} currentSat={currentSat} summary={summary(g)} className="mb-2.5 px-0.5" />}
          <ul className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))]" aria-label={g.label ?? "Eventos"}>
            {g.events.map(ev => <li key={ev.id}><EventCard {...rowProps(ev)} /></li>)}
          </ul>
        </section>
      ))}
    </div>
  );

  const gridCols = showScore ? COLS_WITH_SCORE : COLS_NO_SCORE;
  const cols = COLUMNS.filter(c => showScore || c !== "score");
  return (
    // overflow-clip (e não hidden): o cabeçalho continua preso no topo ao rolar.
    <div role="table" aria-label="Eventos" className={cn(surfaceCls, "overflow-clip")}>
      <div role="rowgroup" className="sticky top-16 z-20">
        <div role="row" className="grid bg-card border-b border-border rounded-t-2xl" style={{ gridTemplateColumns: gridCols }}>
          {cols.map((col) => {
            const label = COLUMN_LABELS[col];
            const pad = col === "name" ? "pl-5 pr-3" : col === "score" ? "px-1 justify-center" : "px-3";
            if (col === "matrix") {
              return (
                <div key={col} role="columnheader" title={COLUMN_TITLES[col]} className={cn("flex items-center h-11", pad)}>
                  <Eyebrow as="span">{label}</Eyebrow>
                </div>
              );
            }
            const active = isColActive(sortBy, col);
            const asc = isColAsc(sortBy, col);
            const Icon = !active ? ArrowUpDown : asc ? ArrowUp : ArrowDown;
            return (
              <div key={col} role="columnheader" aria-sort={active ? (asc ? "ascending" : "descending") : "none"} className={cn("flex items-center h-11", col === "score" && "justify-center")}>
                <button
                  type="button"
                  onClick={() => setSortBy(nextColSort(sortBy, col))}
                  title={COLUMN_TITLES[col]}
                  aria-label={`Ordenar por ${label}${active ? (asc ? " (crescente)" : " (decrescente)") : ""}`}
                  className={cn(
                    "group/sort font-condensed h-11 inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.08em] leading-none select-none rounded-md transition-colors duration-150",
                    pad, FOCUS_RING, "focus-visible:ring-offset-0",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                  <Icon size={12} aria-hidden className={cn("transition-opacity duration-150", active ? "opacity-100" : "opacity-0 group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60")} />
                </button>
              </div>
            );
          })}
          <div role="columnheader" className="flex items-center h-11 px-3"><Eyebrow as="span">Status</Eyebrow></div>
          <div role="columnheader" className="h-11"><span className="sr-only">Ações</span></div>
        </div>
      </div>

      {groups.map(g => (
        <div role="rowgroup" key={g.key} aria-label={g.label ?? undefined}>
          {g.label && (
            <div role="row" className="bg-secondary/45 border-b border-border">
              <div role="cell" className="pl-5 pr-4 py-2.5">
                <GroupHeading g={g} currentSat={currentSat} summary={summary(g)} />
              </div>
            </div>
          )}
          {g.events.map(ev => <EventRow key={ev.id} gridCols={gridCols} {...rowProps(ev)} />)}
        </div>
      ))}
    </div>
  );
}

const LEGEND = [
  { cls: "bg-[var(--status-ok)]", label: "Publicado (final)" },
  { cls: "bg-foreground/60", label: "Avaliado" },
  { cls: "bg-[var(--status-warn)]", label: "Em andamento" },
  { cls: "bg-border", label: "Aguardando" },
  { cls: "bg-[var(--status-info)]", label: "Abre em DD/MM · Próximo ciclo" },
  { cls: "bg-[var(--status-danger)]", label: "Aguardando RH" },
];

/**
 * Legenda das cores da faixa lateral + "N de M eventos". `scopeLabel`: "no
 * ciclo" num ciclo, "em todos os ciclos" no Total geral. `afterEnd` = quantos
 * da lista são do próximo ciclo (mesma contagem do cabeçalho e de Ciclos).
 */
export function EventsLegend({ shown, total, scopeLabel = "no ciclo", afterEnd = 0 }: { shown: number; total: number; scopeLabel?: string; afterEnd?: number }) {
  const afterNote = afterEnd > 0 ? ` (${afterEnd} fora do período)` : "";
  return (
    <div className="mt-4 flex flex-col-reverse sm:flex-row sm:items-center gap-x-6 gap-y-3 px-1">
      <ul aria-label="Legenda da faixa lateral" className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {LEGEND.map(l => (
          <li key={l.label} className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <span aria-hidden className={cn("w-[3px] h-3.5 rounded-full shrink-0", l.cls)} />
            {l.label}
          </li>
        ))}
      </ul>
      <span data-testid="events-count" className="sm:ml-auto font-condensed text-[13px] font-bold uppercase tracking-[0.05em] tabular-nums text-muted-foreground whitespace-nowrap">
        {shown === total
          ? `${plural(total, "evento", "eventos")} ${scopeLabel}${afterNote}`
          : `${shown} de ${plural(total, "evento", "eventos")}${afterNote}`}
      </span>
    </div>
  );
}
