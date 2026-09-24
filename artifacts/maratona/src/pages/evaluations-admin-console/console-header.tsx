import type { Dispatch, SetStateAction } from "react";
import { cn } from "@/lib/utils";
import { ClipboardCheck, Table2, Users, SlidersHorizontal } from "lucide-react";
import { CONDENSED, WARNING, AMBER, AMBER_TEXT } from "@/lib/premium-theme";
import type { ConsoleView, EnrichedEvent, QueueTab } from "./types";

/** Header: título + switcher de abas */
export function ConsoleHeader({ view, setView, isOperador }: {
  view: ConsoleView;
  setView: Dispatch<SetStateAction<ConsoleView>>;
  isOperador: boolean;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Central de Avaliações</h1>
        <p className="text-[11px] font-bold uppercase tracking-wide mt-0.5" style={{ color: "var(--muted-foreground)" }}>Acompanhe o progresso e atribua avaliadores</p>
      </div>
      <div className="flex rounded-lg overflow-hidden shrink-0" style={{ border: "1px solid var(--border)" }}>
        {(() => {
          const tabs = ([
            { key: "assign", label: "Atribuição", Icon: ClipboardCheck },
            { key: "criterios", label: "Critérios", Icon: SlidersHorizontal },
            { key: "table", label: "Tabela", Icon: Table2 },
            { key: "people", label: "Avaliadores", Icon: Users },
          ] as const)
            // "operador" só enxerga a aba de Atribuição — as demais expõem
            // edição de catálogo de critérios ou visões mais amplas fora do
            // escopo dele (confirmar equipe + enviar avaliação).
            .filter(v => !isOperador || v.key === "assign");
          return tabs.map((v, idx) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            className={cn(
              "px-3.5 py-2 text-[11px] font-bold uppercase flex items-center gap-1.5 transition-colors",
              idx < tabs.length - 1 && "border-r",
            )}
            style={{
              fontFamily: CONDENSED,
              borderColor: "var(--border)",
              backgroundColor: view === v.key ? "var(--primary)" : "transparent",
              color: view === v.key ? "var(--primary-foreground)" : "var(--muted-foreground)",
            }}
          >
            <v.Icon size={13} /> {v.label}
          </button>
          ));
        })()}
      </div>
    </div>
  );
}

/** KPI strip */
export function KpiStrip({ todoCount, selected, currentWeekendDoneCount, pendingEvaluatorsCount, noEvaluatorFilter, setNoEvaluatorFilter, setView, setTab }: {
  todoCount: number;
  selected: EnrichedEvent | null;
  currentWeekendDoneCount: number | null;
  pendingEvaluatorsCount: number;
  noEvaluatorFilter: boolean;
  setNoEvaluatorFilter: Dispatch<SetStateAction<boolean>>;
  setView: Dispatch<SetStateAction<ConsoleView>>;
  setTab: Dispatch<SetStateAction<QueueTab>>;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
      <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="text-3xl font-black leading-none" style={{ fontFamily: CONDENSED }}>{todoCount}</div>
        <div className="text-[11px] font-bold uppercase tracking-wide mt-1" style={{ color: "var(--muted-foreground)" }}>Eventos abertos</div>
      </div>
      <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="text-3xl font-black leading-none" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>{selected ? `${selected.pct}%` : "—"}</div>
        <div className="text-[11px] font-bold uppercase tracking-wide mt-1" style={{ color: "var(--muted-foreground)" }}>Concluído no evento</div>
        {currentWeekendDoneCount != null && (
          <div className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)", opacity: 0.7 }}>{currentWeekendDoneCount} do fim de semana atual</div>
        )}
      </div>
      <button
        type="button"
        onClick={() => { setNoEvaluatorFilter(v => !v); setView("assign"); setTab("todo"); }}
        className="rounded-xl p-3.5 text-left transition-opacity hover:opacity-80"
        style={{ backgroundColor: noEvaluatorFilter ? `rgba(232,162,61,0.14)` : pendingEvaluatorsCount > 0 ? `rgba(232,162,61,0.10)` : "var(--card)", border: noEvaluatorFilter ? `1px solid ${AMBER}` : pendingEvaluatorsCount > 0 ? `1px solid ${AMBER}44` : "1px solid var(--border)" }}
      >
        <div className="text-3xl font-black leading-none" style={{ fontFamily: CONDENSED, color: AMBER_TEXT }}>{pendingEvaluatorsCount}</div>
        <div className="text-[11px] font-bold uppercase tracking-wide mt-1" style={{ color: "var(--muted-foreground)" }}>Avaliadores pendentes</div>
        <div className="text-[11px] mt-0.5" style={{ color: noEvaluatorFilter ? AMBER : "var(--muted-foreground)", opacity: 0.8 }}>{noEvaluatorFilter ? "Filtro ativo — clique para limpar" : "Filtrar eventos →"}</div>
      </button>
      <button
        type="button"
        onClick={() => { setNoEvaluatorFilter(v => !v); setTab("todo"); }}
        className="rounded-xl p-3.5 text-left transition-opacity hover:opacity-80"
        style={{ backgroundColor: noEvaluatorFilter ? `rgba(229,72,77,0.12)` : (selected?.unassigned ?? 0) > 0 ? `rgba(229,72,77,0.06)` : "var(--card)", border: noEvaluatorFilter ? `1px solid ${WARNING}` : (selected?.unassigned ?? 0) > 0 ? `1px solid ${WARNING}44` : "1px solid var(--border)" }}
      >
        <div className="text-3xl font-black leading-none" style={{ fontFamily: CONDENSED, color: (selected?.unassigned ?? 0) > 0 ? WARNING : "var(--foreground)" }}>{selected?.unassigned ?? 0}</div>
        <div className="text-[11px] font-bold uppercase tracking-wide mt-1" style={{ color: "var(--muted-foreground)" }}>Critérios sem avaliador</div>
        <div className="text-[11px] mt-0.5" style={{ color: noEvaluatorFilter ? WARNING : "var(--muted-foreground)", opacity: 0.8 }}>{noEvaluatorFilter ? "Filtro ativo — clique para limpar" : "Filtrar eventos →"}</div>
      </button>
    </div>
  );
}
