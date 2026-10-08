import type { Dispatch, ReactNode, SetStateAction } from "react";
import { ArrowRight, ClipboardCheck, SlidersHorizontal, Table2, Users } from "lucide-react";
import { cn, plural } from "@/lib/utils";
import { Chip, Eyebrow, FOCUS_RING, Segmented, surfaceCls } from "./console-ui";
import type { ConsoleView, QueueTab } from "./types";

/**
 * Topo da tela (o único h1): título, abas da Central e o ciclo. Fixo no tablet
 * e no desktop, como nas telas de Avaliações e Calibração. No ciclo por área a
 * Central acompanha (ninguém é designado): aba "Eventos" no lugar de "Atribuição".
 */
export function ConsoleHeader({ view, setView, isOperador, areaMode = false, cycleName }: {
  view: ConsoleView;
  setView: Dispatch<SetStateAction<ConsoleView>>;
  isOperador: boolean;
  areaMode?: boolean;
  cycleName?: string | null;
}) {
  const tabs = ([
    { value: "assign", label: areaMode ? "Eventos" : "Atribuição", Icon: ClipboardCheck },
    { value: "table", label: "Tabela", Icon: Table2 },
    { value: "criterios", label: "Critérios", Icon: SlidersHorizontal },
    { value: "people", label: "Avaliadores", Icon: Users },
  ] as const)
    // "operador" só enxerga a aba de Atribuição — as demais expõem edição de
    // catálogo de critérios ou visões mais amplas fora do escopo dele.
    .filter(v => !isOperador || v.value === "assign");
  return (
    <div className="md:sticky md:top-0 z-30 bg-card border-b border-border px-4 md:px-6 py-3 lg:py-0 lg:h-16 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6">
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <h1 data-testid="text-page-title" className="font-condensed text-[26px] uppercase tracking-[-0.01em] font-black leading-none text-foreground">
            Central de Avaliações
          </h1>
          <p data-testid="console-subtitle" className="sr-only">
            {areaMode ? "Acompanhe o progresso das avaliações por área" : "Acompanhe o progresso e atribua avaliadores"}
          </p>
        </div>
        {cycleName && <Chip className="lg:hidden max-w-[45vw] truncate">{cycleName}</Chip>}
      </div>
      {tabs.length > 1 && (
        <Segmented<ConsoleView>
          label="Visão da Central"
          value={view}
          onChange={setView}
          className="w-full lg:w-auto"
          options={tabs.map(t => ({
            value: t.value,
            testId: `console-view-${t.value}`,
            label: <><t.Icon size={14} aria-hidden className="hidden sm:inline" /> {t.label}</>,
          }))}
        />
      )}
      <div className="hidden lg:flex items-center gap-2 ml-auto min-w-0">
        {areaMode && <Chip tone="info" title="Neste ciclo, qualquer avaliador da área responde; a primeira resposta da área vale.">Avaliação por área</Chip>}
        {cycleName && <Chip className="max-w-[220px] truncate">{cycleName}</Chip>}
      </div>
    </div>
  );
}

type CellTone = "neutral" | "warn" | "ok" | "danger";
const VALUE_TONE: Record<CellTone, string> = {
  neutral: "text-foreground",
  warn: "text-[var(--status-warn-text)]",
  ok: "text-[var(--status-ok-text)]",
  danger: "text-[var(--status-danger-text)]",
};

/** Uma célula do panorama. Com `onClick` vira atalho (filtro/aba). */
function Cell({ label, value, unit, sub, tone = "neutral", onClick, pressed, testId, title, action }: {
  label: ReactNode; value: ReactNode; unit?: ReactNode; sub: ReactNode; tone?: CellTone;
  onClick?: () => void; pressed?: boolean; testId?: string; title?: string; action?: string;
}) {
  const body = (
    <>
      <Eyebrow as="span" className={cn("block", pressed && "text-foreground")}>{label}</Eyebrow>
      <span className="mt-2 flex items-baseline gap-1.5">
        <span className={cn("font-condensed text-[30px] lg:text-[34px] font-black leading-none tracking-[-0.02em] tabular-nums", VALUE_TONE[tone])}>{value}</span>
        {unit && <span className="font-condensed text-[14px] font-bold uppercase text-muted-foreground">{unit}</span>}
      </span>
      <span className="mt-1.5 block text-[12.5px] leading-snug text-muted-foreground">{sub}</span>
      {action && (
        <span className={cn("mt-2 inline-flex items-center gap-1 font-condensed text-[12px] font-bold uppercase tracking-[0.06em]", pressed ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
          {action} <ArrowRight size={12} aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </span>
      )}
    </>
  );
  const cls = "min-w-0 bg-card px-4 py-3.5 lg:px-5 lg:py-4 text-left";
  if (!onClick) return <div data-testid={testId} title={title} className={cls}>{body}</div>;
  return (
    <button type="button" data-testid={testId} title={title} onClick={onClick} aria-pressed={pressed}
      className={cn(cls, "group transition-colors duration-150 hover:bg-secondary/50", pressed && "bg-secondary/70 hover:bg-secondary/70", FOCUS_RING, "focus-visible:ring-inset focus-visible:ring-offset-0")}>
      {body}
    </button>
  );
}

export type WeekendPulse = { label: string; isNow: boolean; done: number; total: number; active: boolean } | null;

/**
 * Panorama do ciclo: responde "o que falta e quem já avaliou" num relance —
 * eventos abertos, critérios a responder × respondidos e o fim de semana atual.
 */
export function KpiStrip({ openCount, weekend, onWeekend, pendingEvaluatorsCount, selectedUnassigned, noEvaluatorFilter, setNoEvaluatorFilter, setView, setTab, areaMode = false, toAnswerCount = 0, answeredCount = 0 }: {
  /** Eventos abertos pela regra única do app (isOpenEvent): o mesmo número de Eventos e de Ciclos. */
  openCount: number;
  /** Fim de semana atual (ou o último): eventos concluídos × total. */
  weekend: WeekendPulse;
  /** Filtra a fila pelo fim de semana do panorama. */
  onWeekend: () => void;
  pendingEvaluatorsCount: number;
  /** Critérios sem avaliador no evento selecionado (fluxo antigo). */
  selectedUnassigned: number;
  noEvaluatorFilter: boolean;
  setNoEvaluatorFilter: Dispatch<SetStateAction<boolean>>;
  setView: Dispatch<SetStateAction<ConsoleView>>;
  setTab: (t: QueueTab) => void;
  areaMode?: boolean;
  /** Critérios ainda sem resposta nos eventos abertos. */
  toAnswerCount?: number;
  /** Critérios já respondidos nos eventos abertos. */
  answeredCount?: number;
}) {
  const weekendCell = (
    <Cell
      testId="kpi-weekend"
      label={weekend ? `${weekend.isNow ? "Este fim de semana" : "Último fim de semana"} · ${weekend.label}` : "Fim de semana"}
      value={weekend ? `${weekend.done}/${weekend.total}` : "—"}
      unit={weekend ? "concluídos" : undefined}
      sub={weekend ? (weekend.total === 0 ? "Nenhum evento neste fim de semana." : `${plural(weekend.total - weekend.done, "evento ainda aberto", "eventos ainda abertos")}.`) : "Sem fins de semana no ciclo."}
      tone={weekend && weekend.total > 0 && weekend.done === weekend.total ? "ok" : "neutral"}
      onClick={weekend ? onWeekend : undefined}
      pressed={weekend?.active}
      action={weekend ? (weekend.active ? "Filtro ativo · limpar" : "Ver na fila") : undefined}
    />
  );
  return (
    <section aria-label="Panorama do ciclo" className={cn(surfaceCls, "overflow-hidden grid grid-cols-2 lg:grid-cols-4 gap-px bg-border")}>
      {weekendCell}
      {areaMode ? (
        <>
          <Cell
            testId="kpi-to-answer"
            title="Critérios dos eventos abertos que ainda não têm resposta enviada — qualquer avaliador da área responde"
            label="Critérios a responder"
            value={toAnswerCount}
            tone={toAnswerCount > 0 ? "warn" : "ok"}
            sub="Nos eventos abertos, sem resposta da área."
            onClick={() => { setView("assign"); setTab("todo"); }}
            action="Ver A fazer"
          />
          <Cell
            testId="kpi-answered"
            title="Critérios dos eventos abertos com resposta enviada pela área"
            label="Respondidos"
            value={answeredCount}
            tone={answeredCount > 0 ? "ok" : "neutral"}
            sub="Nos eventos abertos, com resposta enviada."
          />
        </>
      ) : (
        <>
          <Cell
            testId="kpi-pending-evaluators"
            label="Avaliadores pendentes"
            value={pendingEvaluatorsCount}
            tone={pendingEvaluatorsCount > 0 ? "warn" : "neutral"}
            sub="Com critério ou Matriz ainda sem envio."
            onClick={() => { setNoEvaluatorFilter(v => !v); setView("assign"); setTab("todo"); }}
            pressed={noEvaluatorFilter}
            action={noEvaluatorFilter ? "Filtro ativo · limpar" : "Filtrar eventos"}
          />
          <Cell
            testId="kpi-unassigned"
            label="Critérios sem avaliador"
            value={selectedUnassigned}
            tone={selectedUnassigned > 0 ? "danger" : "neutral"}
            sub="No evento selecionado."
            onClick={() => { setNoEvaluatorFilter(v => !v); setTab("todo"); }}
            pressed={noEvaluatorFilter}
            action={noEvaluatorFilter ? "Filtro ativo · limpar" : "Filtrar eventos"}
          />
        </>
      )}
      <Cell
        testId="kpi-open-events"
        title="Ainda não fechados, do período do ciclo e com a avaliação já aberta (a partir do dia seguinte ao fim do evento)"
        label="Eventos abertos"
        value={openCount}
        sub="Avaliação aberta e evento ainda não fechado."
      />
    </section>
  );
}
