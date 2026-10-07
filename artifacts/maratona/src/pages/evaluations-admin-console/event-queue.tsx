import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { plural, todayBR, type getCycleWeekends } from "@/lib/utils";
import { Search, MapPin, UserX, CalendarClock, Calendar, ChevronDown, SlidersHorizontal } from "lucide-react";
import { CONDENSED, WARNING } from "@/lib/premium-theme";
import { HScroller } from "@/components/shared";
import { STATE_CFG, fieldStyle } from "./helpers";
import { NEXT_CYCLE_NOTICE } from "../events/rules";
import type { ConformityFilter, CritState, EnrichedEvent, QueueFilters, QueueSort, QueueTab } from "./types";

type SetState<T> = Dispatch<SetStateAction<T>>;

/** Coluna esquerda — fila de eventos (abas, busca, filtros e lista). */
export function EventQueue(props: {
  tab: QueueTab;
  setTab: (t: QueueTab) => void;
  todoCount: number;
  /** "A abrir": do próximo ciclo ou ainda não terminou (sem nada respondido). */
  waitingCount: number;
  doneCount: number;
  filters: QueueFilters;
  setQ: SetState<string>;
  setAreaFilter: SetState<string>;
  setEvaluatorFilter: SetState<string>;
  setFilterDateFrom: SetState<string>;
  setFilterDateTo: SetState<string>;
  setSort: SetState<QueueSort>;
  setConformityFilter: SetState<ConformityFilter>;
  setNoEvaluatorFilter: SetState<boolean>;
  areaOptions: string[];
  evaluatorOptions: string[];
  cycleWeekends: ReturnType<typeof getCycleWeekends>;
  queueEvents: EnrichedEvent[];
  baseTabCount: number;
  hasFilters: boolean;
  selectedId: number | null;
  setSelectedEventId: SetState<number | null>;
}) {
  const {
    tab, setTab, todoCount, waitingCount, doneCount, filters,
    setQ, setAreaFilter, setEvaluatorFilter, setFilterDateFrom, setFilterDateTo, setSort, setConformityFilter, setNoEvaluatorFilter,
    areaOptions, evaluatorOptions, cycleWeekends, queueEvents, baseTabCount, hasFilters, selectedId, setSelectedEventId,
  } = props;
  const { q, areaFilter, evaluatorFilter, filterDateFrom, filterDateTo, sort, conformityFilter, noEvaluatorFilter } = filters;
  // Filtros recolhidos por padrão; o contador mostra quantos estão ligados
  // (a busca e o fim de semana ficam sempre à vista).
  const activeFilterCount = [areaFilter, evaluatorFilter, sort !== "name", conformityFilter !== "all", noEvaluatorFilter].filter(Boolean).length;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const showFilters = filtersOpen;

  // Centra o carrossel no fim de semana atual (como na tela de Eventos).
  const weekendRowRef = useRef<HTMLDivElement>(null);
  const firstWeekend = cycleWeekends[0]?.sat;
  useEffect(() => {
    const row = weekendRowRef.current;
    if (!row || cycleWeekends.length === 0) return;
    const today = todayBR();
    const idx = cycleWeekends.findIndex(w => w.sun >= today);
    const chip = row.children[idx >= 0 ? idx : cycleWeekends.length - 1] as HTMLElement | undefined;
    // Só o trilho rola (scrollIntoView rolaria a página inteira).
    if (chip) row.scrollLeft = chip.offsetLeft - row.clientWidth / 2 + chip.clientWidth / 2;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstWeekend]);

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="p-3.5 pb-0">
        <p className="text-[11px] font-bold uppercase tracking-wide mb-2.5" style={{ color: "var(--muted-foreground)" }}>Eventos do ciclo</p>
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {([
            { key: "todo", label: "A fazer", count: todoCount, title: "Avaliação aberta (a partir do dia seguinte ao fim do evento) e ainda não concluída" },
            { key: "waiting", label: "A abrir", count: waitingCount, title: "Ainda não aceitam avaliação: o evento não terminou (abre no dia seguinte ao fim) ou é do próximo ciclo (abre quando o ciclo novo for criado)" },
            { key: "done", label: "Concluídos", count: doneCount, title: "Todos os critérios completos, evento fechado ou com publicação final" },
          ] as const).map((t, i) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} aria-pressed={tab === t.key} title={t.title} className="flex-1 min-w-0 px-1 py-2 text-[11px] font-bold uppercase whitespace-nowrap" style={{ fontFamily: CONDENSED, borderRight: i < 2 ? "1px solid var(--border)" : "none", backgroundColor: tab === t.key ? "var(--primary)" : "transparent", color: tab === t.key ? "var(--primary-foreground)" : "var(--muted-foreground)" }}>
              {t.label} · {t.count}
            </button>
          ))}
        </div>

        <div className="mt-2.5 flex flex-col gap-2 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={fieldStyle}>
              <Search size={14} className="shrink-0" style={{ color: "var(--muted-foreground)" }} aria-hidden />
              <input
                type="search"
                aria-label="Buscar evento na fila"
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Buscar evento..."
                className="border-0 outline-none flex-1 min-w-0 text-xs font-semibold bg-transparent"
                style={{ color: "var(--foreground)" }}
              />
            </div>
            {/* Filtros de área/avaliador/ordem/conformidade ficam recolhidos: a
                lista de eventos aparece já na primeira tela (1366 e celular). */}
            <button
              type="button"
              onClick={() => setFiltersOpen(v => !v)}
              aria-expanded={showFilters}
              aria-controls="queue-filters"
              data-testid="button-queue-filters"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase transition-colors"
              style={{ fontFamily: CONDENSED, border: "1px solid var(--border)", backgroundColor: showFilters ? "var(--secondary)" : "transparent", color: "var(--foreground)" }}
            >
              <SlidersHorizontal size={12} aria-hidden /> Filtros
              {activeFilterCount > 0 && (
                <span className="rounded-full px-1.5 text-[10px] leading-4" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>{activeFilterCount}</span>
              )}
              <ChevronDown size={12} aria-hidden className={showFilters ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>
          </div>
          {showFilters && (
          <div id="queue-filters" className="flex flex-col gap-2">
          <div className="flex gap-2">
            <select aria-label="Filtrar por área" value={areaFilter} onChange={e => setAreaFilter(e.target.value)} className="flex-1 min-w-0 rounded-lg px-2 py-1.5 text-[11px] font-bold uppercase" style={fieldStyle}>
              <option value="">Todas as áreas</option>
              {areaOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <select aria-label="Filtrar por avaliador" value={evaluatorFilter} onChange={e => setEvaluatorFilter(e.target.value)} className="flex-1 min-w-0 rounded-lg px-2 py-1.5 text-[11px] font-bold uppercase" style={fieldStyle}>
              <option value="">Todos avaliadores</option>
              {evaluatorOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <select aria-label="Ordenar eventos" value={sort} onChange={e => setSort(e.target.value as QueueSort)} className="rounded-lg px-2 py-1.5 text-[11px] font-bold uppercase" style={fieldStyle}>
            <option value="name">Ordenar · Nome</option>
            <option value="urgencia">Ordenar · Urgência</option>
            <option value="pct">Ordenar · Menor progresso</option>
            <option value="pending">Ordenar · Mais pendências</option>
            <option value="data">Ordenar · Data do evento</option>
          </select>
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase mb-1" style={{ color: "var(--muted-foreground)" }}>Conformidade</p>
              <div className="flex gap-1 flex-wrap">
                {([["all", "Todas"], ["pending", "Pend."], ["done", "Ok"]] as const).map(([f, label]) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setConformityFilter(f)}
                    className="rounded px-2 py-1 text-[11px] font-bold uppercase transition-colors"
                    style={{
                      backgroundColor: conformityFilter === f ? "var(--primary)" : "var(--secondary)",
                      color: conformityFilter === f ? "var(--primary-foreground)" : "var(--muted-foreground)",
                      border: "1px solid var(--border)",
                    }}
                  >{label}</button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase mb-1" style={{ color: "var(--muted-foreground)" }}>Sem avaliador</p>
              <button
                type="button"
                onClick={() => setNoEvaluatorFilter(v => !v)}
                className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-bold uppercase transition-colors whitespace-nowrap"
                style={{
                  backgroundColor: noEvaluatorFilter ? WARNING : "var(--secondary)",
                  color: noEvaluatorFilter ? "#fff" : "var(--muted-foreground)",
                  border: `1px solid ${noEvaluatorFilter ? WARNING : "var(--border)"}`,
                }}
              >
                <UserX size={9} /> {noEvaluatorFilter ? "Ativo" : "Filtrar"}
              </button>
            </div>
          </div>
          </div>
          )}
          {/* Fins de semana: o mesmo carrossel da tela de Eventos (uma linha,
              setas nas pontas), centrado no fim de semana atual — antes eram
              ~52 chips quebrando em 15 linhas acima da lista. */}
          {cycleWeekends.length > 0 && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-bold uppercase shrink-0 inline-flex items-center gap-1" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>
                <Calendar size={11} aria-hidden /> Fim de semana
              </span>
              <HScroller label="fins de semana" viewportRef={weekendRowRef} className="flex-1">
                {cycleWeekends.map(w => {
                  const active = filterDateFrom === w.sat && filterDateTo === w.sun;
                  return (
                    <button key={w.sat} type="button"
                      data-testid={`button-filter-weekend-${w.sat}`}
                      aria-pressed={active}
                      onClick={() => { if (active) { setFilterDateFrom(""); setFilterDateTo(""); } else { setFilterDateFrom(w.sat); setFilterDateTo(w.sun); } }}
                      className="px-2 py-1 rounded-lg text-[11px] font-bold uppercase whitespace-nowrap transition-colors shrink-0"
                      style={{ fontFamily: CONDENSED, backgroundColor: active ? "var(--primary)" : "var(--card)", color: active ? "var(--primary-foreground)" : "var(--muted-foreground)", border: active ? "1px solid var(--primary)" : "1px solid var(--border)" }}
                    >{w.label}</button>
                  );
                })}
              </HScroller>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>{queueEvents.length} de {plural(baseTabCount, "evento")}</span>
            {hasFilters && (
              <button type="button" onClick={() => { setQ(""); setAreaFilter(""); setEvaluatorFilter(""); setFilterDateFrom(""); setFilterDateTo(""); setConformityFilter("all"); setNoEvaluatorFilter(false); }} className="rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase transition-colors hover:opacity-80" style={{ border: "1px solid var(--border)" }}>
                Limpar filtros
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="p-3 flex flex-col gap-2.5 max-h-[600px] overflow-y-auto">
        {queueEvents.length === 0 ? (
          <div className="rounded-lg py-5 px-3.5 text-center text-[11px] font-bold uppercase" style={{ border: "1px dashed var(--border)", color: "var(--muted-foreground)" }}>
            Nenhum evento encontrado
          </div>
        ) : queueEvents.map(ev => {
          const st: CritState = ev.total === 0 ? "unassigned" : ev.isDone ? "done" : ev.done > 0 ? "partial" : "pending";
          const cfg = STATE_CFG[st];
          const isSel = selectedId === ev.id;
          return (
            <button
              key={ev.id}
              type="button"
              onClick={() => setSelectedEventId(ev.id)}
              className="block w-full text-left rounded-lg px-3 py-2.5 relative"
              style={{ border: "1px solid var(--border)", backgroundColor: isSel ? "var(--secondary)" : "var(--card)" }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: cfg.accent }} />
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold uppercase text-[13.5px] leading-tight min-w-0 break-words">{ev.name}</span>
                <span className="font-black text-xs shrink-0" style={{ fontFamily: CONDENSED, color: st === "pending" || st === "unassigned" && ev.total === 0 ? "var(--muted-foreground)" : cfg.accent }}>{ev.pct}%</span>
              </div>
              {ev.opensLabel && ev.queueTab === "waiting" && (
                <span data-testid={`queue-opens-${ev.id}`} title={ev.nextCycle ? NEXT_CYCLE_NOTICE : undefined} className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, backgroundColor: "var(--status-info-bg)", color: "var(--status-info-text)" }}>
                  <CalendarClock size={10} aria-hidden /> {ev.opensLabel}
                </span>
              )}
              <div className="flex items-center gap-1.5 my-1.5">
                <MapPin size={11} className="shrink-0" style={{ color: "var(--muted-foreground)" }} />
                <span className="text-[11px] font-bold uppercase truncate" style={{ color: "var(--muted-foreground)" }}>{[ev.city, ev.clientName].filter(Boolean).join(" · ") || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}>
                  <div className="h-full rounded-full" style={{ width: `${ev.pct}%`, background: cfg.accent }} />
                </div>
                <span className="text-[11px] font-bold shrink-0" style={{ color: "var(--muted-foreground)" }}>{ev.done}/{ev.total}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
