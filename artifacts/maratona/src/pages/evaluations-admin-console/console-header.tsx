import type { Dispatch, SetStateAction } from "react";
import { cn } from "@/lib/utils";
import { ClipboardCheck, Table2, Users, SlidersHorizontal } from "lucide-react";
import { CONDENSED, WARNING, AMBER, AMBER_TEXT, DANGER_TEXT, GOOD_TEXT } from "@/lib/premium-theme";
import type { ConsoleView, EnrichedEvent, QueueTab } from "./types";

/**
 * Header: título + switcher de abas. No ciclo por área a Central acompanha
 * (ninguém é designado): subtítulo e aba "Eventos" no lugar de "Atribuição".
 */
export function ConsoleHeader({ view, setView, isOperador, areaMode = false }: {
  view: ConsoleView;
  setView: Dispatch<SetStateAction<ConsoleView>>;
  isOperador: boolean;
  areaMode?: boolean;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Central de Avaliações</h1>
        <p data-testid="console-subtitle" className="text-[11px] font-bold uppercase tracking-wide mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          {areaMode ? "Acompanhe o progresso das avaliações por área" : "Acompanhe o progresso e atribua avaliadores"}
        </p>
      </div>
      {/* No celular as abas dividem a largura (sem ícone) para caber as quatro. */}
      <div className="flex w-full md:w-auto rounded-lg overflow-hidden shrink-0" style={{ border: "1px solid var(--border)" }}>
        {(() => {
          const tabs = ([
            { key: "assign", label: areaMode ? "Eventos" : "Atribuição", Icon: ClipboardCheck },
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
            aria-pressed={view === v.key}
            className={cn(
              "flex-1 md:flex-none justify-center px-2 md:px-3.5 py-2 text-[11px] font-bold uppercase flex items-center gap-1.5 transition-colors",
              idx < tabs.length - 1 && "border-r",
            )}
            style={{
              fontFamily: CONDENSED,
              borderColor: "var(--border)",
              backgroundColor: view === v.key ? "var(--primary)" : "transparent",
              color: view === v.key ? "var(--primary-foreground)" : "var(--muted-foreground)",
            }}
          >
            <v.Icon size={13} className="hidden sm:inline" aria-hidden="true" /> {v.label}
          </button>
          ));
        })()}
      </div>
    </div>
  );
}

/** KPI strip */
export function KpiStrip({ openCount, selected, currentWeekendDoneCount, pendingEvaluatorsCount, noEvaluatorFilter, setNoEvaluatorFilter, setView, setTab, areaMode = false, toAnswerCount = 0, answeredCount = 0 }: {
  /** Eventos abertos pela regra única do app (isOpenEvent): o mesmo número de Eventos e de Ciclos. */
  openCount: number;
  selected: EnrichedEvent | null;
  currentWeekendDoneCount: number | null;
  pendingEvaluatorsCount: number;
  noEvaluatorFilter: boolean;
  setNoEvaluatorFilter: Dispatch<SetStateAction<boolean>>;
  setView: Dispatch<SetStateAction<ConsoleView>>;
  setTab: (t: QueueTab) => void;
  /** Ciclo por área: "Critérios a responder" e "Respondidos" no lugar de avaliadores/critérios sem avaliador. */
  areaMode?: boolean;
  /** Critérios ainda sem resposta nos eventos abertos. */
  toAnswerCount?: number;
  /** Critérios já respondidos nos eventos abertos. */
  answeredCount?: number;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3.5">
      <div className="rounded-xl p-3 md:p-3.5" data-testid="kpi-open-events" title="Ainda não fechados, do período do ciclo e com a avaliação já aberta (a partir do dia seguinte ao fim do evento)" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="text-2xl md:text-3xl font-black leading-none" style={{ fontFamily: CONDENSED }}>{openCount}</div>
        <div className="text-[11px] font-bold uppercase tracking-wide mt-1" style={{ color: "var(--muted-foreground)" }}>Eventos abertos</div>
      </div>
      <div className="rounded-xl p-3 md:p-3.5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="text-2xl md:text-3xl font-black leading-none" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>{selected ? `${selected.pct}%` : "—"}</div>
        <div className="text-[11px] font-bold uppercase tracking-wide mt-1" style={{ color: "var(--muted-foreground)" }}>Concluído no evento</div>
        {currentWeekendDoneCount != null && (
          <div className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)", opacity: 0.7 }}>{currentWeekendDoneCount} do fim de semana atual</div>
        )}
      </div>
      {areaMode ? (
        <>
          <button
            type="button"
            data-testid="kpi-to-answer"
            onClick={() => { setView("assign"); setTab("todo"); }}
            title="Critérios dos eventos abertos que ainda não têm resposta enviada — qualquer avaliador da área responde"
            className="rounded-xl p-3 md:p-3.5 text-left transition-opacity hover:opacity-80"
            style={{ backgroundColor: toAnswerCount > 0 ? "rgba(232,162,61,0.10)" : "var(--card)", border: toAnswerCount > 0 ? `1px solid ${AMBER}44` : "1px solid var(--border)" }}
          >
            <div className="text-2xl md:text-3xl font-black leading-none" style={{ fontFamily: CONDENSED, color: toAnswerCount > 0 ? AMBER_TEXT : "var(--foreground)" }}>{toAnswerCount}</div>
            <div className="text-[11px] font-bold uppercase tracking-wide mt-1" style={{ color: "var(--muted-foreground)" }}>Critérios a responder</div>
            <div className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)", opacity: 0.8 }}>Nos eventos abertos · ver A fazer →</div>
          </button>
          <div data-testid="kpi-answered" className="rounded-xl p-3 md:p-3.5" title="Critérios dos eventos abertos com resposta enviada pela área" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="text-2xl md:text-3xl font-black leading-none" style={{ fontFamily: CONDENSED, color: answeredCount > 0 ? GOOD_TEXT : "var(--foreground)" }}>{answeredCount}</div>
            <div className="text-[11px] font-bold uppercase tracking-wide mt-1" style={{ color: "var(--muted-foreground)" }}>Respondidos</div>
            <div className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)", opacity: 0.8 }}>Nos eventos abertos</div>
          </div>
        </>
      ) : (
      <>
      <button
        type="button"
        onClick={() => { setNoEvaluatorFilter(v => !v); setView("assign"); setTab("todo"); }}
        className="rounded-xl p-3 md:p-3.5 text-left transition-opacity hover:opacity-80"
        style={{ backgroundColor: noEvaluatorFilter ? `rgba(232,162,61,0.14)` : pendingEvaluatorsCount > 0 ? `rgba(232,162,61,0.10)` : "var(--card)", border: noEvaluatorFilter ? `1px solid ${AMBER}` : pendingEvaluatorsCount > 0 ? `1px solid ${AMBER}44` : "1px solid var(--border)" }}
      >
        <div className="text-2xl md:text-3xl font-black leading-none" style={{ fontFamily: CONDENSED, color: AMBER_TEXT }}>{pendingEvaluatorsCount}</div>
        <div className="text-[11px] font-bold uppercase tracking-wide mt-1" style={{ color: "var(--muted-foreground)" }}>Avaliadores pendentes</div>
        <div className="text-[11px] mt-0.5" style={{ color: noEvaluatorFilter ? AMBER_TEXT : "var(--muted-foreground)", opacity: 0.8 }}>{noEvaluatorFilter ? "Filtro ativo — clique para limpar" : "Filtrar eventos →"}</div>
      </button>
      <button
        type="button"
        onClick={() => { setNoEvaluatorFilter(v => !v); setTab("todo"); }}
        className="rounded-xl p-3 md:p-3.5 text-left transition-opacity hover:opacity-80"
        style={{ backgroundColor: noEvaluatorFilter ? `rgba(229,72,77,0.12)` : (selected?.unassigned ?? 0) > 0 ? `rgba(229,72,77,0.06)` : "var(--card)", border: noEvaluatorFilter ? `1px solid ${WARNING}` : (selected?.unassigned ?? 0) > 0 ? `1px solid ${WARNING}44` : "1px solid var(--border)" }}
      >
        <div className="text-2xl md:text-3xl font-black leading-none" style={{ fontFamily: CONDENSED, color: (selected?.unassigned ?? 0) > 0 ? DANGER_TEXT : "var(--foreground)" }}>{selected?.unassigned ?? 0}</div>
        <div className="text-[11px] font-bold uppercase tracking-wide mt-1" style={{ color: "var(--muted-foreground)" }}>Critérios sem avaliador</div>
        <div className="text-[11px] mt-0.5" style={{ color: noEvaluatorFilter ? DANGER_TEXT : "var(--muted-foreground)", opacity: 0.8 }}>{noEvaluatorFilter ? "Filtro ativo — clique para limpar" : "Filtrar eventos →"}</div>
      </button>
      </>
      )}
    </div>
  );
}
