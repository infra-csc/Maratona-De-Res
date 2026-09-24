// Seletor de eventos do cabeçalho: filtros de status, busca, fins de semana do ciclo e lista.
import type React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, X } from "lucide-react";
import { formatEventSubtitle } from "@/lib/utils";
import { CONDENSED, BODY } from "@/lib/premium-theme";
import { calibrationEventChip } from "./helpers";
import type { ApiEvent, CycleWeekend, EventStatusFilter, PickerPalette } from "./types";

export type EventPickerProps = {
  pk: PickerPalette;
  eventPickerOpen: boolean;
  setEventPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
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

export function EventPicker({
  pk,
  eventPickerOpen,
  setEventPickerOpen,
  calibratableEvents,
  filteredCalibratableEvents,
  pickedEvent,
  selectedEventId,
  onSelectEvent,
  eventStatusFilter,
  setEventStatusFilter,
  eventSearchText,
  setEventSearchText,
  cycleWeekends,
  filterDateFrom,
  setFilterDateFrom,
  filterDateTo,
  setFilterDateTo,
}: EventPickerProps) {
  return (
        <div className="flex-1 min-w-0">
          <Popover open={eventPickerOpen} onOpenChange={setEventPickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                role="combobox"
                data-testid="select-event"
                disabled={calibratableEvents.length === 0}
                className="w-full h-9 px-3 flex items-center justify-between gap-2 text-left transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed rounded-none"
                style={{ backgroundColor: "var(--secondary)", border: "2px solid var(--border)", color: "var(--foreground)" }}
              >
                {pickedEvent ? (
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-black uppercase text-[11px] truncate" style={{ fontFamily: CONDENSED }}>{pickedEvent.name}</span>
                    {formatEventSubtitle(pickedEvent) && (
                      <span className="text-[11px] font-bold truncate hidden md:inline" style={{ color: "var(--muted-foreground)" }}>{formatEventSubtitle(pickedEvent)}</span>
                    )}
                  </span>
                ) : (
                  <span className="font-black uppercase text-[11px] tracking-widest" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>
                    {calibratableEvents.length === 0 ? "Nenhum evento no ciclo" : "Selecionar evento..."}
                  </span>
                )}
                <ChevronsUpDown size={13} className="shrink-0" style={{ color: "var(--muted-foreground)" }} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="p-0 rounded-none w-[min(96vw,600px)]"
              style={{
                backgroundColor: pk.bg,
                border: `2px solid ${pk.border}`,
                color: pk.text,
                boxShadow: pk.shadow,
              }}
            >
              <Command
                shouldFilter={false}
                className="[&_[cmdk-input-wrapper]]:hidden [&_[cmdk-item]]:rounded-none [&_[cmdk-item]]:px-0 [&_[cmdk-group]]:px-0"
                style={{ backgroundColor: pk.bg, color: pk.text }}
              >
                {/* ── Status filter tabs ── */}
                <div className="flex" style={{ borderBottom: `2px solid ${pk.border}` }}>
                  {([
                    { value: "all", label: "Todos" },
                    { value: "pending", label: "Aguardando" },
                    { value: "inProgress", label: "Em Avaliação" },
                    { value: "done", label: "Fechado" },
                  ] as const).map((opt, i) => {
                    const active = eventStatusFilter === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        data-testid={`button-filter-status-${opt.value}`}
                        onClick={() => setEventStatusFilter(opt.value)}
                        className="flex-1 py-2.5 font-black uppercase text-[11px] tracking-widest transition-all"
                        style={{
                          fontFamily: CONDENSED,
                          backgroundColor: active ? pk.activeBg : "transparent",
                          color: active ? pk.activeFg : pk.muted,
                          borderRight: i < 3 ? `1px solid ${pk.border}` : undefined,
                        }}
                      >{opt.label}</button>
                    );
                  })}
                </div>

                {/* ── Search (plain input, no duplicate icon) ── */}
                <div className="flex items-center gap-2.5 px-3.5 py-2.5" style={{ borderBottom: `1px solid ${pk.border}`, backgroundColor: pk.card }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: pk.muted, flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input
                    data-testid="input-event-search"
                    type="text"
                    value={eventSearchText}
                    onChange={e => setEventSearchText(e.target.value)}
                    placeholder="Buscar evento ou cliente..."
                    className="flex-1 h-8 bg-transparent border-none outline-none font-bold text-[12px] placeholder:opacity-50"
                    style={{ color: pk.text, fontFamily: BODY }}
                    autoComplete="off"
                  />
                  {eventSearchText && (
                    <button type="button" onClick={() => setEventSearchText("")} className="shrink-0 hover:opacity-70 transition-opacity" style={{ color: pk.muted }}>
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* ── Date weekend chips (horizontal scroll) ── */}
                {cycleWeekends.length > 0 && (
                  <div className="flex items-center gap-0 px-3.5 py-2 overflow-x-auto" style={{ borderBottom: `1px solid ${pk.border}`, backgroundColor: pk.bg, scrollbarWidth: "none" }}>
                    <span className="text-[11px] font-black uppercase shrink-0 mr-2.5" style={{ color: pk.muted, fontFamily: CONDENSED }}>Fim de semana</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {cycleWeekends.map(w => {
                        const active = filterDateFrom === w.sat && filterDateTo === w.sun;
                        return (
                          <button key={w.sat} type="button"
                            onClick={() => { if (active) { setFilterDateFrom(""); setFilterDateTo(""); } else { setFilterDateFrom(w.sat); setFilterDateTo(w.sun); } }}
                            className="px-2.5 py-1 font-black uppercase text-[11px] tracking-wide transition-all shrink-0 whitespace-nowrap"
                            style={{
                              fontFamily: CONDENSED,
                              backgroundColor: active ? pk.activeBg : "transparent",
                              color: active ? pk.activeFg : pk.chipText,
                              border: active ? `1.5px solid ${pk.activeBg}` : `1.5px solid ${pk.chipBorder}`,
                            }}
                          >{w.label}</button>
                        );
                      })}
                      {(filterDateFrom || filterDateTo) && (
                        <button type="button" onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
                          className="text-[11px] font-black uppercase shrink-0 px-2 hover:opacity-70 transition-opacity"
                          style={{ color: pk.muted }}
                        >× Limpar</button>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Event list ── */}
                <CommandList className="max-h-[320px] overflow-y-auto" style={{ backgroundColor: pk.bg }}>
                  <CommandEmpty className="py-10 text-center font-black uppercase text-[11px] tracking-widest" style={{ color: pk.muted, fontFamily: CONDENSED }}>
                    Nenhum evento encontrado.
                  </CommandEmpty>
                  <CommandGroup className="p-0" style={{ backgroundColor: pk.bg }}>
                    {filteredCalibratableEvents.map((ev, idx) => {
                      const chip = calibrationEventChip(ev);
                      const isSelected = selectedEventId === ev.id;
                      return (
                        <CommandItem
                          key={ev.id}
                          value={`${ev.name} ${ev.clientName} ${ev.city} ${ev.state}`}
                          data-testid={`option-event-${ev.id}`}
                          onSelect={() => onSelectEvent(ev.id)}
                          className="cursor-pointer rounded-none flex items-stretch gap-0 aria-selected:bg-transparent"
                          style={{
                            borderTop: idx > 0 ? `1px solid ${pk.itemBorder}` : undefined,
                            backgroundColor: isSelected ? pk.itemSel : "transparent",
                          }}
                        >
                          {/* Selected indicator bar */}
                          <div className="w-[3px] shrink-0" style={{ backgroundColor: isSelected ? pk.activeBg : "transparent" }} />
                          <div className="flex items-center gap-3 px-3.5 py-2.5 flex-1 min-w-0">
                            <span className="flex flex-col min-w-0 flex-1 gap-0.5">
                              <span
                                className="font-black uppercase text-[13px] leading-tight"
                                style={{ fontFamily: CONDENSED, color: isSelected ? pk.activeBg : pk.text }}
                              >{ev.name}</span>
                              {formatEventSubtitle(ev) && (
                                <span className="text-[11px] font-bold uppercase" style={{ color: pk.muted }}>
                                  {formatEventSubtitle(ev)}
                                </span>
                              )}
                            </span>
                            <span
                              className="font-black text-[11px] uppercase tracking-wider shrink-0 px-2 py-0.5"
                              style={{
                                fontFamily: CONDENSED,
                                border: `1.5px solid ${chip.fg}`,
                                color: chip.fg,
                                backgroundColor: chip.bg,
                              }}
                            >{chip.label}</span>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
  );
}
