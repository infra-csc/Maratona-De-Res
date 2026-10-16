// Seletor de eventos do topo: situação, busca, fins de semana do ciclo e lista.
import type React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Loader2, Search, X } from "lucide-react";
import { cn, formatEventSubtitle, fmtDate } from "@/lib/utils";
import { HScroller } from "@/components/shared";
import { Chip, Eyebrow } from "../evaluations/ui";
import { calibrationEventChip, filterCalibratableEvents } from "./helpers";
import { FOCUS_RING } from "./cal-ui";
import type { ApiEvent, CycleWeekend, EventStatusFilter } from "./types";

export type EventPickerProps = {
  eventPickerOpen: boolean;
  setEventPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /** Lista de eventos ainda carregando. */
  eventsLoading: boolean;
  calibratableEvents: ApiEvent[];
  filteredCalibratableEvents: ApiEvent[];
  pickedEvent: ApiEvent | undefined;
  selectedEventId: number | null;
  onSelectEvent: (eventId: number) => void;
  eventStatusFilter: EventStatusFilter;
  setEventStatusFilter: React.Dispatch<React.SetStateAction<EventStatusFilter>>;
  eventSearchText: string;
  setEventSearchText: React.Dispatch<React.SetStateAction<string>>;
  cycleWeekends: CycleWeekend[];
  filterDateFrom: string;
  setFilterDateFrom: React.Dispatch<React.SetStateAction<string>>;
  filterDateTo: string;
  setFilterDateTo: React.Dispatch<React.SetStateAction<string>>;
};

const STATUS_TABS = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Aguardando" },
  { value: "inProgress", label: "Em avaliação" },
  { value: "done", label: "Fechados" },
] as const;

function eventDate(ev: ApiEvent) {
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit" };
  if (!ev.startDate) return null;
  return !ev.endDate || ev.endDate === ev.startDate ? fmtDate(ev.startDate, opts) : `${fmtDate(ev.startDate, opts)}–${fmtDate(ev.endDate, opts)}`;
}

export function EventPicker(p: EventPickerProps) {
  const {
    eventPickerOpen, setEventPickerOpen, eventsLoading, calibratableEvents, filteredCalibratableEvents, pickedEvent, selectedEventId,
    onSelectEvent, eventStatusFilter, setEventStatusFilter, eventSearchText, setEventSearchText, cycleWeekends,
    filterDateFrom, setFilterDateFrom, filterDateTo, setFilterDateTo,
  } = p;
  const hasDateFilter = !!(filterDateFrom || filterDateTo);
  const hasAnyFilter = hasDateFilter || !!eventSearchText.trim() || eventStatusFilter !== "all";
  // Quantos eventos cada aba mostraria com a busca e o fim de semana atuais.
  const countFor = (s: EventStatusFilter) => filterCalibratableEvents(calibratableEvents, s, filterDateFrom, filterDateTo, eventSearchText).length;
  const empty = !eventsLoading && calibratableEvents.length === 0;

  return (
    <Popover open={eventPickerOpen} onOpenChange={setEventPickerOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={eventPickerOpen}
          data-testid="select-event"
          aria-label={pickedEvent ? `Evento para calibrar: ${pickedEvent.name}` : "Evento para calibrar"}
          disabled={eventsLoading || empty}
          className={cn(
            "group w-full min-h-11 pl-3.5 pr-3 py-1.5 flex items-center gap-3 text-left rounded-lg border border-border bg-background",
            "transition-[border-color,background-color] duration-150 enabled:hover:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-60",
            "data-[state=open]:border-foreground/40 data-[state=open]:ring-2 data-[state=open]:ring-ring/20",
            FOCUS_RING,
          )}
        >
          {eventsLoading ? (
            <span className="flex items-center gap-2 text-[14px] text-muted-foreground"><Loader2 size={15} className="animate-spin" aria-hidden /> Carregando eventos…</span>
          ) : pickedEvent ? (
            <span className="flex flex-col min-w-0 flex-1 leading-tight">
              <span className="font-condensed text-[16px] font-black uppercase tracking-[0.01em] text-foreground truncate">{pickedEvent.name}</span>
              <span className="text-[12.5px] text-muted-foreground truncate">{[eventDate(pickedEvent), formatEventSubtitle(pickedEvent)].filter(Boolean).join(" · ")}</span>
            </span>
          ) : (
            <span className="flex-1 text-[14.5px] text-muted-foreground truncate">
              {empty ? "Nenhum evento no ciclo" : "Escolher evento para calibrar…"}
            </span>
          )}
          <ChevronsUpDown size={16} aria-hidden className="shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="font-body p-0 w-[min(calc(100vw-24px),620px)] rounded-xl border border-border bg-popover text-popover-foreground shadow-lg overflow-hidden"
      >
        <Command shouldFilter={false} className="bg-transparent [&_[cmdk-input-wrapper]]:hidden [&_[cmdk-group]]:p-0">
          <div className="p-3 space-y-2.5 border-b border-border">
            {/* Busca */}
            <div className="relative">
              <label htmlFor="cal-event-search" className="sr-only">Buscar evento, cliente ou cidade</label>
              <Search size={15} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                id="cal-event-search"
                data-testid="input-event-search"
                type="text"
                value={eventSearchText}
                onChange={e => setEventSearchText(e.target.value)}
                placeholder="Buscar evento, cliente ou cidade"
                autoComplete="off"
                autoFocus
                className="w-full h-11 rounded-lg border border-border bg-background pl-9 pr-10 text-[15px] text-foreground placeholder:text-muted-foreground transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-foreground/40 focus:ring-2 focus:ring-ring/25"
              />
              {eventSearchText && (
                <button type="button" onClick={() => setEventSearchText("")} aria-label="Limpar busca"
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary">
                  <X size={15} aria-hidden />
                </button>
              )}
            </div>

            {/* Situação */}
            <div role="group" aria-label="Filtrar eventos por situação" className="flex gap-0.5 p-0.5 rounded-lg bg-secondary overflow-x-auto">
              {STATUS_TABS.map(t => {
                const on = eventStatusFilter === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    aria-pressed={on}
                    data-testid={`button-filter-status-${t.value}`}
                    onClick={() => setEventStatusFilter(t.value)}
                    className={cn(
                      "font-condensed flex-auto whitespace-nowrap min-h-10 px-2 rounded-md text-[13px] font-bold uppercase tracking-[0.03em] leading-none",
                      "inline-flex items-center justify-center gap-1.5 transition-[background-color,color,box-shadow] duration-150",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t.label}
                    <span className="tabular-nums text-[12px] opacity-70">{countFor(t.value)}</span>
                  </button>
                );
              })}
            </div>

            {/* Fins de semana do ciclo */}
            {cycleWeekends.length > 0 && (
              <div className="flex items-center gap-2">
                <Eyebrow as="span" className="shrink-0">Fim de semana</Eyebrow>
                <HScroller label="fins de semana" className="flex-1 min-w-0">
                  {cycleWeekends.map(w => {
                    const on = filterDateFrom === w.sat && filterDateTo === w.sun;
                    return (
                      <button
                        key={w.sat}
                        type="button"
                        aria-pressed={on}
                        onClick={() => { if (on) { setFilterDateFrom(""); setFilterDateTo(""); } else { setFilterDateFrom(w.sat); setFilterDateTo(w.sun); } }}
                        className={cn(
                          "font-condensed shrink-0 whitespace-nowrap h-8 px-2.5 rounded-md border text-[13px] font-bold tracking-[0.02em] transition-colors duration-150",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          on ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                        )}
                      >{w.label}</button>
                    );
                  })}
                </HScroller>
                {hasDateFilter && (
                  <button type="button" onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
                    className="font-condensed shrink-0 h-8 px-2 rounded-md text-[12.5px] font-bold uppercase tracking-[0.04em] text-muted-foreground hover:text-foreground hover:bg-secondary">
                    Limpar
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Lista */}
          <CommandList className="max-h-[min(360px,50vh)] overflow-y-auto py-1">
            <CommandEmpty className="px-4 py-10 text-center">
              <p className="font-condensed text-[16px] font-black uppercase text-foreground">Nenhum evento encontrado</p>
              <p className="text-[13px] text-muted-foreground mt-1">Ajuste a busca ou os filtros.</p>
              {hasAnyFilter && (
                <button type="button"
                  onClick={() => { setEventSearchText(""); setEventStatusFilter("all"); setFilterDateFrom(""); setFilterDateTo(""); }}
                  className="font-condensed mt-3 h-9 px-3 rounded-lg border border-border text-[13px] font-bold uppercase tracking-[0.05em] text-foreground hover:bg-secondary">
                  Limpar filtros
                </button>
              )}
            </CommandEmpty>
            <CommandGroup>
              {/* Mais recentes primeiro: é onde a calibração costuma estar pendente. */}
              {[...filteredCalibratableEvents].sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? "")).map(ev => {
                const chip = calibrationEventChip(ev);
                const on = selectedEventId === ev.id;
                const when = eventDate(ev);
                return (
                  <CommandItem
                    key={ev.id}
                    value={`${ev.id} ${ev.name}`}
                    data-testid={`option-event-${ev.id}`}
                    onSelect={() => onSelectEvent(ev.id)}
                    className={cn(
                      "relative mx-1.5 my-0.5 rounded-lg px-3 py-2.5 flex items-center gap-3 cursor-pointer",
                      "data-[selected=true]:bg-secondary data-[selected=true]:text-foreground",
                      on && "bg-secondary/70",
                    )}
                  >
                    <span aria-hidden className={cn("absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full", on ? "bg-foreground" : "bg-transparent")} />
                    <span className="flex flex-col min-w-0 flex-1 gap-0.5">
                      <span className="font-condensed text-[15.5px] font-black uppercase leading-tight text-foreground">{ev.name}</span>
                      <span className="text-[12.5px] text-muted-foreground truncate">{[when, formatEventSubtitle(ev)].filter(Boolean).join(" · ")}</span>
                    </span>
                    <Chip tone={chip.tone} className="shrink-0">{chip.label}</Chip>
                    <Check size={15} aria-hidden className={cn("shrink-0", on ? "text-foreground" : "invisible")} />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
