// Barra de filtros (busca, chips de status, período) e a faixa de fins de semana
// do ciclo. O estado vive no pai (e é espelhado na URL); aqui só se desenha.
import type { RefObject } from "react";
import { Search, Calendar, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getCycleWeekends } from "@/lib/utils";
import { CONDENSED } from "@/lib/premium-theme";
import { inputStyle } from "./form-bits";

const chipFilters: { key: string | null; label: string; title: string }[] = [
  { key: null,          label: "Todos",           title: "Todos os eventos do ciclo" },
  { key: "pendingRH",   label: "Aguardando RH",   title: "Aguardando o RH confirmar os critérios do evento" },
  { key: "unconfirmed", label: "Não Confirmados", title: "Resultados não confirmados: ainda não contam na elegibilidade nem na nota" },
  { key: "inEval",      label: "Em Avaliação",    title: "Avaliações em andamento, sem calibração salva" },
  { key: "pendingCal",  label: "Falta calibrar",  title: "Eventos encerrados sem nenhuma calibração ou publicação" },
  { key: "partialPub",  label: "Pub. Parcial",    title: "Publicação parcial: nem todos os critérios têm publicação final" },
  { key: "fullyEval",   label: "Pub. Final",      title: "Publicação final: todos os critérios publicados" },
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
};

export function EventsFilterBar({
  search, setSearch, cardFilter, setCardFilter, datePopoverOpen, setDatePopoverOpen,
  filterDateFrom, filterDateTo, setFilterDateFrom, setFilterDateTo, hasDateFilter,
}: EventsFilterBarProps) {
  return (
    <div className="px-6 py-3 flex items-center gap-2 shrink-0 flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
      {/* Search */}
      <div className="flex items-center gap-2 rounded-lg px-3 py-2 w-72 shrink-0" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>
        <Search size={13} className="shrink-0" style={{ color: "var(--muted-foreground)" }} />
        <input
          data-testid="input-search-events"
          type="search"
          aria-label="Buscar evento, cliente ou cidade"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar evento, cliente ou cidade…"
          className="text-xs bg-transparent outline-none w-full"
          style={{ color: "var(--foreground)" }}
        />
      </div>

      {/* Status chip filters */}
      {chipFilters.map((f) => {
        const active = cardFilter === f.key;
        return (
          <button
            key={String(f.key)}
            type="button"
            title={f.title}
            aria-pressed={active}
            onClick={() => setCardFilter(f.key)}
            className="h-8 px-3 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-colors shrink-0"
            style={{
              fontFamily: CONDENSED,
              backgroundColor: active ? "var(--primary)" : "transparent",
              color: active ? "var(--primary-foreground)" : "var(--muted-foreground)",
              border: active ? "1px solid var(--primary)" : "1px solid var(--border)",
            }}
          >
            {f.label}
          </button>
        );
      })}

      {/* Date filter popover */}
      <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
        <PopoverTrigger asChild>
          <button
            className="ml-auto h-8 px-3.5 rounded-lg text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5 transition-colors shrink-0"
            style={{
              fontFamily: CONDENSED,
              backgroundColor: hasDateFilter ? "var(--primary)" : "transparent",
              color: hasDateFilter ? "var(--primary-foreground)" : "var(--muted-foreground)",
              border: hasDateFilter ? "1px solid var(--primary)" : "1px solid var(--border)",
            }}
          >
            <SlidersHorizontal size={12} />
            {hasDateFilter ? "Datas ●" : "Filtrar Datas"}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--muted-foreground)" }}>Filtrar por data</p>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide block mb-1" style={{ color: "var(--muted-foreground)" }}>De</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)}
              className="w-full h-9 px-2 text-xs rounded-lg font-bold focus:outline-none"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide block mb-1" style={{ color: "var(--muted-foreground)" }}>Até</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)}
              className="w-full h-9 px-2 text-xs rounded-lg font-bold focus:outline-none"
              style={inputStyle}
            />
          </div>
          {hasDateFilter && (
            <button
              type="button"
              onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
              className="w-full text-[11px] font-bold uppercase text-left hover:opacity-70"
              style={{ color: "var(--muted-foreground)" }}
            >
              × Limpar datas
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
};

/** Faixa "Fim de Semana": um clique filtra sáb–dom; clicar de novo limpa. */
export function WeekendChipsRow({ weekends, weekendRowRef, filterDateFrom, filterDateTo, setFilterDateFrom, setFilterDateTo, hasDateFilter }: WeekendChipsRowProps) {
  return (
    <div className="px-6 py-2.5 flex items-center gap-3 shrink-0" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
      <span className="text-[11px] font-black uppercase tracking-widest shrink-0 flex items-center gap-1.5" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>
        <Calendar size={12} />
        Fim de Semana
      </span>
      <div ref={weekendRowRef} className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {weekends.map(w => {
          const active = filterDateFrom === w.sat && filterDateTo === w.sun;
          return (
            <button
              key={w.sat}
              type="button"
              onClick={() => {
                if (active) { setFilterDateFrom(""); setFilterDateTo(""); }
                else { setFilterDateFrom(w.sat); setFilterDateTo(w.sun); }
              }}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase whitespace-nowrap transition-colors shrink-0"
              style={{
                fontFamily: CONDENSED,
                backgroundColor: active ? "var(--primary)" : "var(--card)",
                color: active ? "var(--primary-foreground)" : "var(--muted-foreground)",
                border: active ? "1px solid var(--primary)" : "1px solid var(--border)",
              }}
            >
              {w.label}
            </button>
          );
        })}
      </div>
      {hasDateFilter && filterDateFrom && filterDateTo && (
        <button
          type="button"
          onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
          className="ml-auto text-[11px] font-bold uppercase shrink-0 hover:opacity-70"
          style={{ color: "var(--muted-foreground)" }}
        >
          × limpar
        </button>
      )}
    </div>
  );
}
