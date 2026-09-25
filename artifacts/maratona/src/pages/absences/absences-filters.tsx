import { useState } from "react";
import type { Event } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Search, AlertTriangle, Award, ChevronsUpDown, Check, X, Filter } from "lucide-react";
import { DANGER_TEXT } from "@/lib/premium-theme";
import type { AbsenceFilters } from "./use-absence-filters";
import type { FilterKind } from "./types";

/** Barra de filtros (colaborador, tipo, evento, período) + totais e "Limpar filtros". */
export function AbsencesFiltersBar({ filters, events }: { filters: AbsenceFilters; events: Event[] | undefined }) {
  const {
    search, setSearch, filterKind, setFilterKind, filterEventId, setFilterEventId,
    filterDateFrom, setFilterDateFrom, filterDateTo, setFilterDateTo,
    totalPenaltyPoints, totalMeritPoints, hasActiveFilters, clearFilters,
  } = filters;
  const [filterEventPickerOpen, setFilterEventPickerOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col md:flex-row gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10 w-full rounded-lg text-sm font-medium outline-none"
            style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
            placeholder="Buscar colaborador..."
            aria-label="Buscar colaborador nos lançamentos"
          />
        </div>
        <Select value={filterKind} onValueChange={v => setFilterKind(v as FilterKind)}>
          <SelectTrigger aria-label="Filtrar por tipo" className="h-10 rounded-lg w-[180px] text-xs font-bold uppercase" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
            <Filter size={13} style={{ color: "var(--muted-foreground)" }} className="shrink-0" />
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="penalty">Penalidades</SelectItem>
            <SelectItem value="merit">Méritos</SelectItem>
          </SelectContent>
        </Select>
        <Popover open={filterEventPickerOpen} onOpenChange={setFilterEventPickerOpen}>
          <PopoverTrigger asChild>
            <button
              className="h-10 rounded-lg px-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider shrink-0 transition-opacity hover:opacity-80"
              style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)", minWidth: 200, maxWidth: 280 }}
            >
              <Filter size={13} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
              <span className="flex-1 text-left truncate">
                {filterEventId === "__all"
                  ? "Todos os eventos"
                  : filterEventId === "__none"
                  ? "Sem evento (ciclo)"
                  : ((events ?? []).find(e => String(e.id) === filterEventId)?.name ?? "Evento")}
              </span>
              <ChevronsUpDown size={13} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[320px]" align="start">
            <Command filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
              <CommandInput placeholder="Buscar evento..." />
              <CommandList>
                <CommandEmpty>Nenhum evento encontrado.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="Todos os eventos"
                    onSelect={() => { setFilterEventId("__all"); setFilterEventPickerOpen(false); }}
                    className="flex items-center gap-2"
                  >
                    <Check size={13} className={filterEventId === "__all" ? "opacity-100" : "opacity-0"} />
                    Todos os eventos
                  </CommandItem>
                  <CommandItem
                    value="Sem evento ciclo"
                    onSelect={() => { setFilterEventId("__none"); setFilterEventPickerOpen(false); }}
                    className="flex items-center gap-2"
                  >
                    <Check size={13} className={filterEventId === "__none" ? "opacity-100" : "opacity-0"} />
                    Sem evento (ciclo)
                  </CommandItem>
                  {(events ?? []).map(e => (
                    <CommandItem
                      key={e.id}
                      value={e.name}
                      onSelect={() => { setFilterEventId(String(e.id)); setFilterEventPickerOpen(false); }}
                      className="flex items-center gap-2"
                    >
                      <Check size={13} className={filterEventId === String(e.id) ? "opacity-100" : "opacity-0"} />
                      {e.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="date"
            value={filterDateFrom}
            onChange={e => setFilterDateFrom(e.target.value)}
            className="h-10 rounded-lg px-3 text-sm outline-none w-[148px]"
            style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
            title="Data início"
            aria-label="Filtrar a partir da data"
          />
          <span className="font-bold text-xs" style={{ color: "var(--muted-foreground)" }}>–</span>
          <input
            type="date"
            value={filterDateTo}
            onChange={e => setFilterDateTo(e.target.value)}
            className="h-10 rounded-lg px-3 text-sm outline-none w-[148px]"
            style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
            title="Data fim"
            aria-label="Filtrar até a data"
          />
        </div>
      </div>
      <div className="flex gap-3 flex-wrap items-center">
        <div className="px-4 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 shrink-0" style={{ backgroundColor: "rgba(229,72,77,0.15)", color: DANGER_TEXT }}>
          <AlertTriangle size={13} /> Desconto: <span className="text-sm font-black">−{totalPenaltyPoints}</span> pts
        </div>
        <div className="px-4 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 shrink-0" style={{ backgroundColor: "rgba(154,176,0,0.15)", color: "var(--accent-text)" }}>
          <Award size={13} /> Bônus: <span className="text-sm font-black">+{totalMeritPoints}</span> pts
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-opacity hover:opacity-70"
            style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
          >
            <X size={12} /> Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}
