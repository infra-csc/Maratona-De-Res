import { useEffect, useId, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Search, CalendarClock, ChevronDown, SlidersHorizontal, SearchX, ShieldAlert, UserX, CheckCircle2, X, Inbox } from "lucide-react";
import { cn, fmtDate, plural, todayBR, type getCycleWeekends } from "@/lib/utils";
import { HScroller } from "@/components/shared";
import { NEXT_CYCLE_NOTICE } from "../events/rules";
import { Chip, Eyebrow, FOCUS_RING, Segmented, EmptyBlock, btnGhost, btnSmall, selectCls, surfaceCls, STATE_BAR } from "./console-ui";
import type { ConformityFilter, CritState, EnrichedEvent, QueueFilters, QueueSort, QueueTab } from "./types";

type SetState<T> = Dispatch<SetStateAction<T>>;
type Weekend = ReturnType<typeof getCycleWeekends>[number];

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Fim de semana da "semana do evento" (segunda a domingo) — agrupa a fila por data. */
function weekendOf(date: string | null, weekends: Weekend[]): Weekend | null {
  if (!date) return null;
  return weekends.find(w => addDays(w.sat, -5) <= date && date <= w.sun) ?? null;
}

const TABS: { key: QueueTab; label: string; title: string }[] = [
  { key: "todo", label: "A fazer", title: "Avaliação aberta (a partir do dia seguinte ao fim do evento) e ainda não concluída" },
  { key: "waiting", label: "A abrir", title: "Ainda não aceitam avaliação: o evento não terminou (abre no dia seguinte ao fim) ou é do próximo ciclo (abre quando o ciclo novo for criado)" },
  { key: "done", label: "Concluídos", title: "Todos os critérios completos, evento fechado ou com publicação final" },
];

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
  cycleWeekends: Weekend[];
  /** Sábado do fim de semana "atual" (o do panorama). */
  currentWeekendSat: string | null;
  queueEvents: EnrichedEvent[];
  baseTabCount: number;
  hasFilters: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** Ciclo por área: sem o filtro "Sem avaliador" (ninguém é designado). */
  areaMode: boolean;
}) {
  const {
    tab, setTab, todoCount, waitingCount, doneCount, filters,
    setQ, setAreaFilter, setEvaluatorFilter, setFilterDateFrom, setFilterDateTo, setSort, setConformityFilter, setNoEvaluatorFilter,
    areaOptions, evaluatorOptions, cycleWeekends, currentWeekendSat, queueEvents, baseTabCount, hasFilters, selectedId, onSelect, areaMode,
  } = props;
  const { q, areaFilter, evaluatorFilter, filterDateFrom, filterDateTo, sort, conformityFilter, noEvaluatorFilter } = filters;
  const ids = useId();
  // Filtros recolhidos por padrão; o contador mostra quantos estão ligados
  // (a busca e o fim de semana ficam sempre à vista).
  const activeFilterCount = [areaFilter, evaluatorFilter, sort !== "data", conformityFilter !== "all", noEvaluatorFilter].filter(Boolean).length;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const counts: Record<QueueTab, number> = { todo: todoCount, waiting: waitingCount, done: doneCount };
  const clearAll = () => { setQ(""); setAreaFilter(""); setEvaluatorFilter(""); setFilterDateFrom(""); setFilterDateTo(""); setConformityFilter("all"); setNoEvaluatorFilter(false); };

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

  // Ordem por data: a fila ganha divisórias por fim de semana.
  const grouped = sort === "data";
  const activeWeekend = cycleWeekends.find(w => filterDateFrom === w.sat && filterDateTo === w.sun) ?? null;

  return (
    <section aria-label="Fila de eventos" className={cn(surfaceCls, "overflow-hidden flex flex-col lg:max-h-[calc(100vh-96px)]")}>
      <div className="px-4 pt-4 pb-3 space-y-3 border-b border-border shrink-0">
        <div className="flex items-baseline justify-between gap-3">
          <Eyebrow as="h2">Eventos do ciclo</Eyebrow>
          <span className="font-condensed text-[13px] font-bold tabular-nums text-muted-foreground">{plural(todoCount + waitingCount + doneCount, "evento")}</span>
        </div>
        <Segmented<QueueTab>
          label="Situação dos eventos"
          value={tab}
          onChange={setTab}
          options={TABS.map(t => ({
            value: t.key,
            title: t.title,
            testId: `queue-tab-${t.key}`,
            label: <>{t.label} <span className={cn("ml-0.5 min-w-5 h-5 px-1 rounded-md inline-flex items-center justify-center text-[11.5px] tabular-nums", tab !== t.key ? "text-muted-foreground" : t.key === "todo" && counts.todo > 0 ? "bg-[var(--status-warn-bg)] text-[var(--status-warn-text)]" : "bg-secondary text-foreground")}>{counts[t.key]}</span></>,
          }))}
        />

        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search size={16} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <label htmlFor={`${ids}-q`} className="sr-only">Buscar evento na fila</label>
            <input
              id={`${ids}-q`}
              type="search"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar evento"
              className="w-full h-11 lg:h-10 rounded-lg border border-border bg-secondary/50 pl-9 pr-3 text-[14px] text-foreground placeholder:text-muted-foreground transition-[border-color,box-shadow,background-color] duration-150 focus:outline-none focus:bg-card focus:border-foreground/40 focus:ring-2 focus:ring-ring/30"
            />
          </div>
          {/* Filtros de área/avaliador/ordem/conformidade ficam recolhidos: a
              lista de eventos aparece já na primeira tela (1366 e celular). */}
          <button
            type="button"
            onClick={() => setFiltersOpen(v => !v)}
            aria-expanded={filtersOpen}
            aria-controls={`${ids}-filters`}
            data-testid="button-queue-filters"
            className={cn(btnSmall, "shrink-0 min-h-11 lg:min-h-10 px-3", filtersOpen && "bg-secondary")}
          >
            <SlidersHorizontal size={14} aria-hidden /> Filtros
            {activeFilterCount > 0 && <span className="min-w-5 h-5 px-1 rounded-md bg-primary text-primary-foreground text-[11.5px] inline-flex items-center justify-center tabular-nums">{activeFilterCount}</span>}
            <ChevronDown size={14} aria-hidden className={cn("transition-transform duration-150 motion-reduce:transition-none", filtersOpen && "rotate-180")} />
          </button>
        </div>

        {filtersOpen && (
          <div id={`${ids}-filters`} className="rounded-xl bg-secondary/50 p-3 grid grid-cols-2 gap-x-2.5 gap-y-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 duration-150">
            {areaOptions.length > 0 && (
              <div className={cn("min-w-0", evaluatorOptions.length === 0 && "col-span-2")}>
                <label htmlFor={`${ids}-area`} className="font-condensed block text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-1.5">Área</label>
                <select id={`${ids}-area`} value={areaFilter} onChange={e => setAreaFilter(e.target.value)} className={selectCls}>
                  <option value="">Todas</option>
                  {areaOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            )}
            {evaluatorOptions.length > 0 && (
              <div className={cn("min-w-0", areaOptions.length === 0 && "col-span-2")}>
                <label htmlFor={`${ids}-ev`} className="font-condensed block text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-1.5">{areaMode ? "Designado" : "Avaliador"}</label>
                <select id={`${ids}-ev`} value={evaluatorFilter} onChange={e => setEvaluatorFilter(e.target.value)} className={selectCls}>
                  <option value="">Todos</option>
                  {evaluatorOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            )}
            <div className="min-w-0 col-span-2">
              <label htmlFor={`${ids}-sort`} className="font-condensed block text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-1.5">Ordenar por</label>
              <select id={`${ids}-sort`} value={sort} onChange={e => setSort(e.target.value as QueueSort)} className={selectCls}>
                <option value="data">Data do evento</option>
                <option value="name">Nome</option>
                <option value="urgencia">Urgência</option>
                <option value="pct">Menor progresso</option>
                <option value="pending">Mais pendências</option>
              </select>
            </div>
            <div className="min-w-0 col-span-2">
              <Eyebrow as="span" className="block mb-1.5" id={`${ids}-conf`}>Matriz de conformidade</Eyebrow>
              <Segmented<ConformityFilter>
                label="Filtrar pela Matriz de conformidade"
                size="sm"
                value={conformityFilter}
                onChange={setConformityFilter}
                className="bg-card"
                options={[{ value: "all", label: "Todas" }, { value: "pending", label: "Pendente" }, { value: "done", label: "Completa" }].map(o => ({ ...o, activeCls: "bg-secondary text-foreground" })) as { value: ConformityFilter; label: string; activeCls: string }[]}
              />
            </div>
            {!areaMode && (
              <button
                type="button"
                aria-pressed={noEvaluatorFilter}
                onClick={() => setNoEvaluatorFilter(v => !v)}
                className={cn(btnSmall, "col-span-2 justify-start", noEvaluatorFilter && "border-[var(--status-danger)]/50 bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] enabled:hover:bg-[var(--status-danger-bg)]")}
              >
                <UserX size={14} aria-hidden /> Só eventos com critério sem avaliador
              </button>
            )}
          </div>
        )}

        {/* Fins de semana: o mesmo carrossel da tela de Eventos (uma linha,
            setas nas pontas), centrado no fim de semana atual. */}
        {cycleWeekends.length > 0 && (
          <div className="min-w-0">
            <HScroller label="fins de semana" viewportRef={weekendRowRef}>
              {cycleWeekends.map(w => {
                const active = filterDateFrom === w.sat && filterDateTo === w.sun;
                const isCurrent = w.sat === currentWeekendSat;
                return (
                  <button key={w.sat} type="button"
                    data-testid={`button-filter-weekend-${w.sat}`}
                    aria-pressed={active}
                    aria-label={`Fim de semana ${w.label}${isCurrent ? " (atual)" : ""}`}
                    title={isCurrent ? "Fim de semana atual" : undefined}
                    onClick={() => { if (active) { setFilterDateFrom(""); setFilterDateTo(""); } else { setFilterDateFrom(w.sat); setFilterDateTo(w.sun); } }}
                    className={cn(
                      "font-condensed relative shrink-0 inline-flex items-center gap-1.5 min-h-11 lg:min-h-8 px-2.5 rounded-lg text-[12.5px] font-bold uppercase tracking-[0.04em] whitespace-nowrap tabular-nums transition-colors duration-150",
                      FOCUS_RING,
                      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                    )}
                  >
                    {isCurrent && <span aria-hidden className={cn("w-1.5 h-1.5 rounded-full", active ? "bg-primary-foreground" : "bg-[var(--status-warn)]")} />}
                    {w.label}
                  </button>
                );
              })}
            </HScroller>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 min-h-7">
          <span className="text-[13px] text-muted-foreground" aria-live="polite">
            {activeWeekend ? <><b className="font-semibold text-foreground">{activeWeekend.label}</b> · </> : null}
            {queueEvents.length === baseTabCount ? plural(baseTabCount, "evento") : `${queueEvents.length} de ${plural(baseTabCount, "evento")}`}
          </span>
          {hasFilters && (
            <button type="button" onClick={clearAll} className={cn(btnGhost, "min-h-11 lg:min-h-7 px-2 -mr-2")}>
              <X size={13} aria-hidden /> Limpar filtros
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {queueEvents.length === 0 ? (
          baseTabCount === 0 ? (
            <EmptyBlock icon={Inbox} title={tab === "todo" ? "Nada a fazer agora" : tab === "waiting" ? "Nada a abrir" : "Nada concluído ainda"} className="py-10">
              {tab === "todo" ? "Nenhum evento aberto está esperando avaliação." : "Esta aba não tem eventos neste ciclo."}
            </EmptyBlock>
          ) : (
            <EmptyBlock icon={SearchX} title="Nenhum evento encontrado" className="py-10" testId="queue-no-results"
              action={<button type="button" onClick={clearAll} className={btnSmall}>Limpar filtros</button>}>
              Nenhum evento desta aba bate com a busca e os filtros.
            </EmptyBlock>
          )
        ) : (
          <ul>
            {groupQueue(queueEvents, grouped, cycleWeekends).map(g => (
              <li key={g.key}>
                {g.label && (
                  <div className="sticky top-0 z-[1] bg-card/95 backdrop-blur-sm px-4 pt-3 pb-1.5 flex items-center gap-2 border-b border-border/60">
                    <Eyebrow as="span">{g.label}</Eyebrow>
                    {g.sat != null && g.sat === currentWeekendSat && <Chip tone="warn" className="h-5 px-1.5 text-[11px]">Atual</Chip>}
                    <span className="ml-auto font-condensed text-[12px] font-bold tabular-nums text-muted-foreground">{g.events.length}</span>
                  </div>
                )}
                <ul>
                  {g.events.map(ev => <QueueItem key={ev.id} ev={ev} active={selectedId === ev.id} onSelect={() => onSelect(ev.id)} />)}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Grupos da fila: por fim de semana quando a ordem é por data; senão, um grupo só. */
function groupQueue(events: EnrichedEvent[], grouped: boolean, weekends: Weekend[]) {
  if (!grouped) return [{ key: "all", raw: "all", label: null as string | null, sat: null as string | null, events }];
  const out: { key: string; raw: string; label: string | null; sat: string | null; events: EnrichedEvent[] }[] = [];
  for (const ev of events) {
    const wk = weekendOf(ev.startDate, weekends);
    const key = wk?.sat ?? "other";
    const last = out.at(-1);
    if (last && last.raw === key) last.events.push(ev);
    else out.push({ key: `${key}-${out.length}`, raw: key, label: wk ? `Fim de semana ${wk.label}` : "Outras datas", sat: wk?.sat ?? null, events: [ev] });
  }
  return out;
}

function QueueItem({ ev, active, onSelect }: { ev: EnrichedEvent; active: boolean; onSelect: () => void }) {
  const st: CritState = ev.total === 0 ? "pending" : ev.isDone ? "done" : ev.done > 0 ? "partial" : "pending";
  const when = ev.startDate ? (ev.endDate && ev.endDate !== ev.startDate ? `${fmtDate(ev.startDate)}–${fmtDate(ev.endDate)}` : fmtDate(ev.startDate)) : null;
  const where = [ev.clientName, ev.city ? `${ev.city}${ev.state ? `/${ev.state}` : ""}` : null].filter(Boolean).join(" · ");
  const matrixPending = ev.conformityNeeded && !ev.conformityComplete && ev.queueTab !== "waiting";
  const published = ev.finalCalibratedCriteria > 0;
  return (
    <li>
      <button
        type="button"
        data-testid={`queue-event-${ev.id}`}
        aria-current={active ? "true" : undefined}
        onClick={onSelect}
        className={cn(
          "group relative w-full text-left px-4 py-3.5 flex flex-col gap-1.5 border-b border-border/60 transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          active ? "bg-secondary" : "hover:bg-secondary/55",
        )}
      >
        <span aria-hidden className={cn("absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full transition-opacity duration-150", active ? "bg-foreground opacity-100" : "opacity-0")} />
        <span className="font-condensed text-[16px] font-black uppercase leading-[1.1] text-foreground line-clamp-2">{ev.name}</span>
        <span className="text-[13px] text-muted-foreground truncate">{[when, where].filter(Boolean).join(" · ") || "—"}</span>
        <span className="flex items-center gap-2.5 mt-0.5">
          <span className="flex-1 h-1.5 bg-secondary group-hover:bg-card rounded-full overflow-hidden" aria-hidden>
            <span className={cn("block h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none", STATE_BAR[st === "pending" ? "pending" : st])} style={{ width: `${ev.pct}%` }} />
          </span>
          <span className="font-condensed text-[13px] font-bold text-muted-foreground shrink-0 tabular-nums" aria-label={`${ev.done} de ${ev.total} respondidos`}>{ev.done}/{ev.total}</span>
        </span>
        {(ev.opensLabel && ev.queueTab === "waiting" || matrixPending || ev.unassigned > 0 || published) && (
          <span className="flex flex-wrap items-center gap-1.5 mt-0.5">
            {ev.opensLabel && ev.queueTab === "waiting" && (
              <Chip tone="info" icon={CalendarClock} data-testid={`queue-opens-${ev.id}`} title={ev.nextCycle ? NEXT_CYCLE_NOTICE : "A avaliação abre sozinha no dia seguinte ao fim do evento."}>{ev.opensLabel}</Chip>
            )}
            {ev.unassigned > 0 && <Chip tone="danger" icon={UserX}>{plural(ev.unassigned, "sem avaliador", "sem avaliador")}</Chip>}
            {matrixPending && <Chip icon={ShieldAlert}>Matriz pendente</Chip>}
            {published && <Chip tone="ok" icon={CheckCircle2}>Publicação final</Chip>}
          </span>
        )}
      </button>
    </li>
  );
}
