// Barra de filtros (busca, situação, período) e a faixa de fins de semana do
// ciclo. O estado vive no pai (e é espelhado na URL); aqui só se desenha.
import type { RefObject } from "react";
import { Search, CalendarRange, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HScroller } from "@/components/shared";
import { cn, fmtDate, getCycleWeekends } from "@/lib/utils";
import { Eyebrow, FOCUS_RING, FieldLabel, btnGhost, inputCls } from "./events-ui";

export const chipFilters: { key: string | null; label: string; title: string }[] = [
  { key: null,          label: "Todos",           title: "Todos os eventos do ciclo" },
  { key: "pendingRH",   label: "Aguardando RH",   title: "A avaliação já devia ter aberto (dia seguinte ao evento) e os critérios não foram confirmados" },
  { key: "unconfirmed", label: "Não confirmados", title: "Resultados não confirmados: ainda não contam na elegibilidade nem na nota" },
  { key: "inEval",      label: "Em avaliação",    title: "Avaliações em andamento, sem calibração salva" },
  { key: "pendingCal",  label: "Falta calibrar",  title: "Eventos encerrados sem nenhuma calibração ou publicação" },
  { key: "pendingPub",  label: "Falta publicar",  title: "Calibração salva e ainda não publicada: só vale na nota depois de publicar" },
  { key: "partialPub",  label: "Pub. parcial",    title: "Publicação parcial: nem todos os critérios têm publicação final" },
  { key: "fullyEval",   label: "Pub. final",      title: "Publicação final: todos os critérios publicados" },
];

type DateRangeProps = {
  filterDateFrom: string;
  filterDateTo: string;
  setFilterDateFrom: (v: string) => void;
  setFilterDateTo: (v: string) => void;
  hasDateFilter: boolean;
};

type EventsFilterBarProps = DateRangeProps & {
  search: string;
  setSearch: (v: string) => void;
  cardFilter: string | null;
  setCardFilter: (v: string | null) => void;
  datePopoverOpen: boolean;
  setDatePopoverOpen: (open: boolean) => void;
  /** Quantos eventos cada situação mostraria com a busca e o período atuais. */
  chipCounts: Record<string, number>;
};

const pill = (active: boolean) => cn(
  "font-condensed shrink-0 inline-flex items-center gap-1.5 min-h-11 lg:min-h-9 px-3 rounded-lg text-[13px] font-bold uppercase tracking-[0.04em] whitespace-nowrap",
  "transition-[background-color,color,border-color] duration-150", FOCUS_RING,
  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary",
);

/** "05/10 – 12/10" (ou só uma ponta) para o botão do período. */
function rangeLabel(from: string, to: string) {
  if (from && to) return from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`;
  if (from) return `A partir de ${fmtDate(from)}`;
  if (to) return `Até ${fmtDate(to)}`;
  return "Período";
}

export function EventsFilterBar({
  search, setSearch, cardFilter, setCardFilter, datePopoverOpen, setDatePopoverOpen,
  filterDateFrom, filterDateTo, setFilterDateFrom, setFilterDateTo, hasDateFilter, chipCounts,
}: EventsFilterBarProps) {
  return (
    // Uma linha só a partir do lg: busca | situação (rola com setas quando não
    // cabe) | período. No celular e no tablet: busca e período em cima.
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 lg:flex lg:items-center lg:gap-3">
      <div className="relative min-w-0 lg:w-64 xl:w-72 lg:shrink-0">
        <Search size={15} aria-hidden className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          data-testid="input-search-events"
          type="search"
          aria-label="Buscar evento, cliente ou cidade"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar evento, cliente ou cidade…"
          className={cn(inputCls, "pl-10 lg:h-9 text-[14px]")}
        />
      </div>

      <HScroller label="filtros de situação" className="col-span-2 order-3 lg:order-none flex-1 min-w-0">
        {chipFilters.map((f) => {
          const active = cardFilter === f.key;
          const n = chipCounts[f.key ?? "all"] ?? 0;
          return (
            <button
              key={String(f.key)}
              type="button"
              title={f.title}
              aria-pressed={active}
              data-testid={`filter-status-${f.key ?? "all"}`}
              onClick={() => setCardFilter(f.key)}
              className={pill(active)}
            >
              {f.label}
              <span className={cn("tabular-nums text-[12px]", active ? "opacity-80" : n === 0 ? "opacity-50" : "text-foreground/70")}>{n}</span>
            </button>
          );
        })}
      </HScroller>

      <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid="button-filter-dates"
            aria-label={hasDateFilter ? `Período: ${rangeLabel(filterDateFrom, filterDateTo)}. Alterar` : "Filtrar por período"}
            className={cn(
              "font-condensed shrink-0 inline-flex items-center gap-2 min-h-11 lg:min-h-9 px-3 rounded-lg border text-[13px] font-bold uppercase tracking-[0.04em] whitespace-nowrap tabular-nums transition-colors duration-150",
              FOCUS_RING,
              hasDateFilter ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card text-foreground hover:bg-secondary",
            )}
          >
            <CalendarRange size={15} aria-hidden />
            <span className="max-w-[44vw] truncate">{rangeLabel(filterDateFrom, filterDateTo)}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="font-body w-[min(300px,calc(100vw-32px))] rounded-xl border-border bg-popover text-popover-foreground p-4 shadow-lg">
          <Eyebrow as="p" className="text-foreground">Período do evento</Eyebrow>
          <p className="mt-1 text-[12.5px] text-muted-foreground leading-snug">Mostra os eventos que acontecem dentro do intervalo.</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <div>
              <FieldLabel htmlFor="events-date-from">De</FieldLabel>
              <input id="events-date-from" type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className={cn(inputCls, "px-2.5 text-[14px]")} />
            </div>
            <div>
              <FieldLabel htmlFor="events-date-to">Até</FieldLabel>
              <input id="events-date-to" type="date" value={filterDateTo} min={filterDateFrom || undefined} onChange={e => setFilterDateTo(e.target.value)} className={cn(inputCls, "px-2.5 text-[14px]")} />
            </div>
          </div>
          {hasDateFilter && (
            <button type="button" onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }} className={cn(btnGhost, "mt-3 -ml-3")}>
              <X size={14} aria-hidden /> Limpar período
            </button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

type WeekendChipsRowProps = DateRangeProps & {
  weekends: ReturnType<typeof getCycleWeekends>;
  /** O pai rola o chip do fim de semana atual para o centro ao carregar o ciclo. */
  weekendRowRef: RefObject<HTMLDivElement | null>;
  /** Quantos eventos do ciclo caem em cada fim de semana. */
  countOf: (w: { sat: string; sun: string }) => number;
  /** Sábado do fim de semana atual (marcado com um ponto). */
  currentSat: string | null;
};

/** Faixa "Fins de semana": um clique filtra sáb–dom; clicar de novo limpa. */
export function WeekendChipsRow({ weekends, weekendRowRef, filterDateFrom, filterDateTo, setFilterDateFrom, setFilterDateTo, countOf, currentSat }: WeekendChipsRowProps) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <Eyebrow as="span" className="hidden sm:block shrink-0">Fins de semana</Eyebrow>
      <HScroller label="fins de semana" viewportRef={weekendRowRef} className="flex-1">
        {weekends.map(w => {
          const active = filterDateFrom === w.sat && filterDateTo === w.sun;
          const isCurrent = w.sat === currentSat;
          const n = countOf(w);
          return (
            <button
              key={w.sat}
              type="button"
              data-testid={`events-weekend-${w.sat}`}
              aria-pressed={active}
              aria-label={`Fim de semana ${w.label}: ${n} ${n === 1 ? "evento" : "eventos"}${isCurrent ? " (atual)" : ""}`}
              title={isCurrent ? "Fim de semana atual" : undefined}
              onClick={() => {
                if (active) { setFilterDateFrom(""); setFilterDateTo(""); }
                else { setFilterDateFrom(w.sat); setFilterDateTo(w.sun); }
              }}
              className={cn(pill(active), "px-2.5 tabular-nums", !active && n === 0 && "text-muted-foreground/70")}
            >
              {isCurrent && <span aria-hidden className={cn("w-1.5 h-1.5 rounded-full", active ? "bg-primary-foreground" : "bg-[var(--status-warn)]")} />}
              {w.label}
              {n > 0 && (
                <span aria-hidden className={cn("min-w-5 h-5 px-1 rounded-md inline-flex items-center justify-center text-[11.5px]", active ? "bg-primary-foreground/20" : "bg-secondary text-foreground")}>{n}</span>
              )}
            </button>
          );
        })}
      </HScroller>
    </div>
  );
}
