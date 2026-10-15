// Barra de ferramentas da lista: busca, natureza (com contagem), evento e
// período. Abaixo, o resumo do que está na tela, os filtros ativos e a
// alternância Lançamentos × Por pessoa.
import { useState } from "react";
import type { Event } from "@workspace/api-client-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Check, ChevronsUpDown, User, X } from "lucide-react";
import { cn, fmtDate } from "@/lib/utils";
import { FOCUS_RING, SearchField, Segmented, btnGhost, selectCls } from "./absences-ui";
import type { AbsenceFilters } from "./use-absence-filters";
import type { FilterKind, ListView } from "./types";

const dateCls = cn(selectCls, "w-full pl-10 pr-2 tabular-nums font-medium");
const datePrefix = "font-condensed absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-bold uppercase tracking-[0.06em] text-muted-foreground pointer-events-none";

export function AbsencesToolbar({ filters, events }: { filters: AbsenceFilters; events: Event[] | undefined }) {
  const { search, setSearch, filterKind, setFilterKind, kindCounts, filterEventId, setFilterEventId, filterDateFrom, setFilterDateFrom, filterDateTo, setFilterDateTo } = filters;
  const [eventOpen, setEventOpen] = useState(false);
  const eventLabel = filterEventId === "__all" ? "Todos os eventos"
    : filterEventId === "__none" ? "Sem evento (no ciclo)"
    : ((events ?? []).find(e => String(e.id) === filterEventId)?.name ?? "Evento");
  const count = (n: number) => <span className="tabular-nums font-semibold opacity-70">{n}</span>;

  return (
    <div className="flex flex-col lg:flex-row lg:flex-wrap xl:flex-nowrap lg:items-center gap-2.5">
      <SearchField value={search} onChange={setSearch} label="Buscar por colaborador, tipo, evento ou observação" placeholder="Buscar colaborador ou tipo"
        testId="input-search-absences" className="flex-1 lg:min-w-[260px] xl:max-w-[360px]" />
      <Segmented<FilterKind>
        label="Filtrar por natureza"
        value={filterKind}
        onChange={setFilterKind}
        size="sm"
        className="lg:w-auto"
        options={[
          { value: "all", label: <>Todos {count(kindCounts.all)}</>, testId: "filter-kind-all" },
          { value: "penalty", label: <>Penalidades {count(kindCounts.penalty)}</>, testId: "filter-kind-penalty" },
          { value: "merit", label: <>Méritos {count(kindCounts.merit)}</>, testId: "filter-kind-merit" },
        ]}
      />
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2.5 lg:contents">
        <Popover open={eventOpen} onOpenChange={setEventOpen}>
          <PopoverTrigger asChild>
            <button type="button" role="combobox" aria-expanded={eventOpen} aria-label={`Evento: ${eventLabel}`} data-testid="filter-event"
              className={cn(selectCls, "w-full lg:w-[240px] flex items-center gap-2 text-left pr-3", filterEventId !== "__all" && "border-foreground/40", FOCUS_RING)}>
              <span className="flex-1 min-w-0 truncate">{eventLabel}</span>
              <ChevronsUpDown size={14} aria-hidden className="shrink-0 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[min(340px,calc(100vw-24px))] rounded-xl border-border" align="start">
            <Command filter={(value, q) => (value.toLowerCase().includes(q.toLowerCase()) ? 1 : 0)}>
              <CommandInput placeholder="Buscar evento…" />
              <CommandList className="max-h-[300px]">
                <CommandEmpty className="py-6 text-center text-[13px] text-muted-foreground">Nenhum evento com esse nome.</CommandEmpty>
                <CommandGroup>
                  {[["__all", "Todos os eventos"], ["__none", "Sem evento (no ciclo)"]].map(([v, l]) => (
                    <CommandItem key={v} value={l} onSelect={() => { setFilterEventId(v); setEventOpen(false); }} className="data-[selected=true]:bg-secondary data-[selected=true]:text-foreground gap-2 min-h-11 lg:min-h-9">
                      <Check size={14} aria-hidden className={filterEventId === v ? "opacity-100" : "opacity-0"} />{l}
                    </CommandItem>
                  ))}
                </CommandGroup>
                {(events ?? []).length > 0 && <CommandSeparator />}
                <CommandGroup heading="Eventos do ciclo">
                  {(events ?? []).map(e => (
                    <CommandItem key={e.id} value={`${e.name} ${e.id}`} onSelect={() => { setFilterEventId(String(e.id)); setEventOpen(false); }} className="data-[selected=true]:bg-secondary data-[selected=true]:text-foreground gap-2 min-h-11 lg:min-h-9 items-start py-2">
                      <Check size={14} aria-hidden className={cn("mt-0.5 shrink-0", filterEventId === String(e.id) ? "opacity-100" : "opacity-0")} />
                      <span className="min-w-0">
                        <span className="block leading-snug">{e.name}</span>
                        <span className="block text-[12px] text-muted-foreground tabular-nums">{fmtDate(e.startDate)}{e.endDate && e.endDate !== e.startDate ? ` a ${fmtDate(e.endDate)}` : ""}</span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <fieldset className="grid grid-cols-2 gap-2 lg:w-[340px] min-w-0">
          <legend className="sr-only">Período da ocorrência</legend>
          <label className="relative min-w-0">
            <span aria-hidden className={datePrefix}>De</span>
            <input type="date" value={filterDateFrom} max={filterDateTo || undefined} onChange={e => setFilterDateFrom(e.target.value)}
              data-testid="filter-date-from" aria-label="Ocorrências a partir de" className={cn(dateCls, filterDateFrom && "border-foreground/40")} />
          </label>
          <label className="relative min-w-0">
            <span aria-hidden className={datePrefix}>Até</span>
            <input type="date" value={filterDateTo} min={filterDateFrom || undefined} onChange={e => setFilterDateTo(e.target.value)}
              data-testid="filter-date-to" aria-label="Ocorrências até" className={cn(dateCls, filterDateTo && "border-foreground/40")} />
          </label>
        </fieldset>
      </div>
    </div>
  );
}

/** "Mostrando 4 de 12 · −150 / +25 pts", o colaborador filtrado e a alternância de visão. */
export function ListMeta({ filters, total, employeeName, view, onView, shownPeople }: {
  filters: AbsenceFilters;
  total: number;
  employeeName: string | null;
  view: ListView;
  onView: (v: ListView) => void;
  shownPeople: number;
}) {
  const { filteredAbsences, totalPenaltyPoints, totalMeritPoints, hasActiveFilters, clearFilters, setFilterEmployeeId } = filters;
  const shown = filteredAbsences.length;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
      <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-muted-foreground" aria-live="polite">
        <span className="tabular-nums" data-testid="absences-count">
          {view === "people"
            ? <>{shownPeople.toLocaleString("pt-BR")} {shownPeople === 1 ? "pessoa" : "pessoas"} · {shown.toLocaleString("pt-BR")} {shown === 1 ? "lançamento" : "lançamentos"}</>
            : hasActiveFilters ? <>Mostrando {shown.toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")}</> : <>{total.toLocaleString("pt-BR")} {total === 1 ? "lançamento" : "lançamentos"} no ciclo</>}
          {shown > 0 && (
            <> · <span className="font-semibold text-[var(--status-danger-text)]">−{totalPenaltyPoints.toLocaleString("pt-BR")}</span>
              {" / "}<span className="font-semibold text-[var(--status-ok-text)]">+{totalMeritPoints.toLocaleString("pt-BR")}</span> pts</>
          )}
        </span>
        {employeeName && (
          <span className="inline-flex items-center gap-1 h-7 pl-2 pr-0.5 rounded-md bg-secondary text-foreground font-semibold" data-testid="filter-employee-chip">
            <User size={13} aria-hidden className="text-muted-foreground" />{employeeName}
            <button type="button" onClick={() => setFilterEmployeeId(null)} aria-label={`Tirar o filtro de ${employeeName}`}
              className={cn("w-7 h-7 -my-0.5 rounded inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors duration-150", FOCUS_RING)}>
              <X size={13} aria-hidden />
            </button>
          </span>
        )}
        {hasActiveFilters && (
          <button type="button" onClick={clearFilters} data-testid="button-clear-filters" className={cn(btnGhost, "min-h-9 md:min-h-8 px-2 -ml-1 text-[12.5px]")}>
            <X size={13} aria-hidden /> Limpar filtros
          </button>
        )}
      </div>
      <Segmented<ListView>
        label="Organizar a lista"
        value={view}
        onChange={onView}
        size="sm"
        className="sm:w-auto shrink-0"
        options={[
          { value: "entries", label: "Lançamentos", testId: "view-entries" },
          { value: "people", label: "Por pessoa", testId: "view-people" },
        ]}
      />
    </div>
  );
}
