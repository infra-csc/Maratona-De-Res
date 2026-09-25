import type { Dispatch, SetStateAction } from "react";
import type { getCycleWeekends } from "@/lib/utils";
import { Search, MapPin, UserX } from "lucide-react";
import { CONDENSED, WARNING } from "@/lib/premium-theme";
import { STATE_CFG, fieldStyle } from "./helpers";
import type { ConformityFilter, CritState, EnrichedEvent, QueueFilters, QueueSort, QueueTab } from "./types";

type SetState<T> = Dispatch<SetStateAction<T>>;

/** Coluna esquerda — fila de eventos (abas, busca, filtros e lista). */
export function EventQueue(props: {
  tab: QueueTab;
  setTab: SetState<QueueTab>;
  todoCount: number;
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
    tab, setTab, todoCount, doneCount, filters,
    setQ, setAreaFilter, setEvaluatorFilter, setFilterDateFrom, setFilterDateTo, setSort, setConformityFilter, setNoEvaluatorFilter,
    areaOptions, evaluatorOptions, cycleWeekends, queueEvents, baseTabCount, hasFilters, selectedId, setSelectedEventId,
  } = props;
  const { q, areaFilter, evaluatorFilter, filterDateFrom, filterDateTo, sort, conformityFilter, noEvaluatorFilter } = filters;
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="p-3.5 pb-0">
        <p className="text-[11px] font-bold uppercase tracking-wide mb-2.5" style={{ color: "var(--muted-foreground)" }}>Eventos do ciclo</p>
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <button type="button" onClick={() => setTab("todo")} className="flex-1 py-2 text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, borderRight: "1px solid var(--border)", backgroundColor: tab === "todo" ? "var(--primary)" : "transparent", color: tab === "todo" ? "var(--primary-foreground)" : "var(--muted-foreground)" }}>
            Em aberto · {todoCount}
          </button>
          <button type="button" onClick={() => setTab("done")} className="flex-1 py-2 text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, backgroundColor: tab === "done" ? "var(--primary)" : "transparent", color: tab === "done" ? "var(--primary-foreground)" : "var(--muted-foreground)" }}>
            Concluídos · {doneCount}
          </button>
        </div>

        <div className="mt-2.5 flex flex-col gap-2 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={fieldStyle}>
            <Search size={14} className="shrink-0" style={{ color: "var(--muted-foreground)" }} />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar evento..."
              className="border-0 outline-none flex-1 min-w-0 text-xs font-semibold bg-transparent"
              style={{ color: "var(--foreground)" }}
            />
          </div>
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
          {cycleWeekends.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Fim de semana:</span>
              {cycleWeekends.map(w => {
                const active = filterDateFrom === w.sat && filterDateTo === w.sun;
                return (
                  <button key={w.sat} type="button"
                    data-testid={`button-filter-weekend-${w.sat}`}
                    onClick={() => { if (active) { setFilterDateFrom(""); setFilterDateTo(""); } else { setFilterDateFrom(w.sat); setFilterDateTo(w.sun); } }}
                    className="px-1.5 py-0.5 rounded text-[11px] font-bold uppercase transition-colors"
                    style={{ backgroundColor: active ? "var(--primary)" : "transparent", color: active ? "var(--primary-foreground)" : "var(--muted-foreground)", border: active ? "1px solid var(--primary)" : "1px solid var(--border)" }}
                  >{w.label}</button>
                );
              })}
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>{queueEvents.length} de {baseTabCount} evento(s)</span>
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
                <span className="font-black text-xs shrink-0" style={{ fontFamily: CONDENSED, color: cfg.accent }}>{ev.pct}%</span>
              </div>
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
