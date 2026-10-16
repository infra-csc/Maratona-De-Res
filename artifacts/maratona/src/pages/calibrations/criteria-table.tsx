// Lista de critérios da calibração: cabeçalho com os filtros e os critérios
// (ou aviso quando o filtro não retorna nada).
import type React from "react";
import { FilterX, Loader2, Wand2 } from "lucide-react";
import { plural } from "@/lib/utils";
import { Eyebrow, btnGhost, btnSmall } from "../evaluations/ui";
import { Segmented } from "./cal-ui";
import { CriterionRow, type CriterionRowSharedProps } from "./criterion-row";
import type { CriterionFilter, EventCriterion } from "./types";

export type CriteriaTableProps = {
  filteredActiveCriteria: EventCriterion[];
  displayActiveCount: number;
  calibratedCount: number;
  pendingPublishCount: number;
  rowProps: CriterionRowSharedProps;
  criterionFilter: CriterionFilter;
  setCriterionFilter: React.Dispatch<React.SetStateAction<CriterionFilter>>;
  /** "Usar nota dos avaliadores": salva como calibração a nota das áreas nos critérios sem calibração (não publica). */
  autoFillableCount: number;
  canAutoFill: boolean;
  autoFillBusy: boolean;
  savingAutoFill: boolean;
  onAutoFill: () => void;
};

export function CriteriaTable({ filteredActiveCriteria, displayActiveCount, calibratedCount, pendingPublishCount, rowProps, criterionFilter, setCriterionFilter, autoFillableCount, canAutoFill, autoFillBusy, savingAutoFill, onAutoFill }: CriteriaTableProps) {
  const n = (v: number) => <span className="tabular-nums opacity-70">{v}</span>;
  const options = [
    { value: "all" as const, label: <>Todos {n(displayActiveCount)}</> },
    { value: "uncalibrated" as const, label: <>Pendentes {n(displayActiveCount - calibratedCount)}</> },
    { value: "calibrated" as const, label: <>Calibrados {n(calibratedCount)}</> },
    ...(pendingPublishCount > 0 || criterionFilter === "pendingPub"
      ? [{ value: "pendingPub" as const, label: <>Falta publicar {n(pendingPublishCount)}</> }]
      : []),
  ];
  return (
    <section aria-labelledby="cal-criteria-title" className="@container rounded-2xl border border-border bg-card">
      <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-b border-border">
        <Eyebrow as="h2" id="cal-criteria-title" className="text-foreground">Critérios</Eyebrow>
        <div className="flex flex-wrap items-center gap-2 max-w-full">
          {autoFillableCount > 0 && canAutoFill && (
            <button
              data-testid="button-autofill-from-evaluator"
              type="button"
              disabled={autoFillBusy}
              onClick={onAutoFill}
              title={`Salva a nota das áreas (avaliadores) como calibração ${autoFillableCount === 1 ? "no critério" : "nos " + plural(autoFillableCount, "critério", "critérios")} sem calibração. Não publica.`}
              className={btnGhost}
            >
              {savingAutoFill ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Wand2 size={15} aria-hidden />}
              {savingAutoFill ? "Preenchendo…" : <>Usar nota das áreas <span className="tabular-nums">· {autoFillableCount}</span></>}
            </button>
          )}
          <Segmented label="Filtrar critérios" size="sm" value={criterionFilter} onChange={setCriterionFilter} options={options} className="max-w-full overflow-x-auto" />
        </div>
      </div>
      {filteredActiveCriteria.length === 0 && displayActiveCount > 0 ? (
        <div className="px-6 py-12 text-center">
          <span className="mx-auto w-11 h-11 rounded-full bg-secondary text-muted-foreground flex items-center justify-center"><FilterX size={20} aria-hidden /></span>
          <p className="font-condensed mt-3 text-[20px] font-black uppercase text-foreground">Nenhum critério neste filtro</p>
          <p className="text-[14px] text-muted-foreground mt-1">Os outros critérios continuam na lista completa.</p>
          <button type="button" onClick={() => setCriterionFilter("all")} className={`${btnSmall} mt-4`}>Ver todos</button>
        </div>
      ) : (
        <div role="list" aria-label="Critérios do evento" className="divide-y divide-border">
          {filteredActiveCriteria.map(c => (
            <CriterionRow key={c.criterionId} c={c} {...rowProps} />
          ))}
        </div>
      )}
    </section>
  );
}
