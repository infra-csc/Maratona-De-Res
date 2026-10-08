import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { AdminPublicToken, useGenerateCriterionAssignments } from "@/lib/routing-api";
import { Info, Link2, Loader2, RefreshCw, UserCheck } from "lucide-react";
import { cn, plural } from "@/lib/utils";
import { NEXT_CYCLE_NOTICE } from "../events/rules";
import { AreaBoard, GROUP_LABEL, boardCounts, boardGroups, type AreaBoardMode } from "./area-board";
import { STATE_CFG, computeCriteriaFilter } from "./helpers";
import { BulkAssign, LegacyCriteriaList } from "./legacy-criteria-list";
import { EventPanelHero } from "./event-panel-hero";
import { Eyebrow, Notice, Segmented, btnSmall, surfaceCls } from "./console-ui";
import type { ConfirmResultsMutation, ToastFn } from "./use-event-mutations";
import type { CriteriaManagement } from "./use-criteria-management";
import type { CritFilter, CritRow, EnrichedEvent } from "./types";

type SetState<T> = Dispatch<SetStateAction<T>>;

/** Coluna direita da aba Eventos/Atribuição — o evento selecionado. */
export function EventAssignmentPanel(props: {
  selected: EnrichedEvent;
  canManage: boolean;
  canViewSubmissions: boolean;
  todayStr: string;
  toast: ToastFn;
  confirmResults: ConfirmResultsMutation;
  resyncCriteria: CriteriaManagement["resyncCriteria"];
  generateAssignments: ReturnType<typeof useGenerateCriterionAssignments>;
  batchRunning: boolean;
  handleGenerateAllLinks: () => void;
  critFilter: CritFilter;
  setCritFilter: SetState<CritFilter>;
  bulkAssignAreaId: number | null;
  setBulkAssignAreaId: SetState<number | null>;
  bulkBusy: boolean;
  handleBulkAssign: (areaId: number, userId: number) => void;
  openPickerCriterionId: number | null;
  setOpenPickerCriterionId: SetState<number | null>;
  handleAssign: (criterionId: number, userId: number) => void;
  openLinkDialog: (c: CritRow) => void;
  setViewEvalCrit: SetState<CritRow | null>;
  /** Bloco "Matriz de conformidade" (renderizado ao final do corpo). */
  conformitySection: ReactNode;
  /** Links do evento (quem respondeu "via link"). */
  allTokens: AdminPublicToken[] | undefined;
  /** Celular/tablet: volta para a fila. */
  onBack: () => void;
}) {
  const {
    selected, canManage, canViewSubmissions, todayStr, toast, confirmResults, resyncCriteria, generateAssignments,
    batchRunning, handleGenerateAllLinks, critFilter, setCritFilter, bulkAssignAreaId, setBulkAssignAreaId, bulkBusy, handleBulkAssign,
    openPickerCriterionId, setOpenPickerCriterionId, handleAssign, openLinkDialog, setViewEvalCrit, conformitySection, allTokens, onBack,
  } = props;
  const { filteredCriteria, critPillCounts: criteriaCounts } = computeCriteriaFilter(selected, critFilter);
  // Ciclo por área: quadro por ÁREA (ou por critério de origem) — os filtros e
  // contadores passam a contar grupos, não critérios soltos.
  const [boardMode, setBoardMode] = useState<AreaBoardMode>("area");
  const allGroups = selected.areaMode ? boardGroups(selected, boardMode) : [];
  const critPillCounts = selected.areaMode ? boardCounts(allGroups) : criteriaCounts;
  const visibleGroups = critFilter === "all" || critFilter === "unassigned" ? allGroups : allGroups.filter(g => g.state === critFilter);
  const waiting = selected.queueTab === "waiting" && !!selected.opensLabel;
  // Avaliação por área: ninguém precisa ser designado — sem "Sem avaliador",
  // sem "Atribuir"; designação antiga aparece só como informação.
  const areaMode = selected.areaMode;
  // Link para freela: no ciclo por área sai em nome de um avaliador da área
  // (escolhido no diálogo) — vale para todo critério ainda aberto; fora dele,
  // segue a designação. Evento do próximo ciclo: a API recusa (409 EVENT_NEXT_CYCLE).
  const canLink = (c: CritRow) => !selected.nextCycle && (c.areaMode ? c.state !== "done" && c.areaId != null : c.assignedToId != null);
  const showGenerateAll = !selected.nextCycle && (areaMode
    ? selected.criteria.some(c => c.state !== "done" && c.areaId != null)
    : (selected.total - critPillCounts.unassigned) > 0);
  const pillLabel = (k: CritFilter) => areaMode
    ? { all: "Todos", unassigned: "", pending: "Pendentes", partial: GROUP_LABEL.partial, done: "Completos" }[k]
    : { all: "Todos", unassigned: STATE_CFG.unassigned.label, pending: STATE_CFG.pending.label, partial: STATE_CFG.partial.label, done: STATE_CFG.done.label }[k];
  const pills = (["all", "unassigned", "pending", "partial", "done"] as const).filter(k => !(areaMode && k === "unassigned"));

  return (
    <section aria-label="Evento selecionado" className={cn(surfaceCls, "@container min-w-0 overflow-hidden")} data-testid="event-panel">
      <EventPanelHero selected={selected} canManage={canManage} todayStr={todayStr} confirmResults={confirmResults} onBack={onBack} />

      <div className="border-t border-border px-4 sm:px-5 lg:px-6 py-4 space-y-3">
        {waiting && (
          <Notice icon={Info} tone="info" testId="panel-opens-help">
            {selected.nextCycle
              ? NEXT_CYCLE_NOTICE
              : areaMode
                ? "A avaliação abre sozinha no dia seguinte ao fim do evento. Dá para preparar critérios e o responsável da Matriz."
                : "A avaliação abre sozinha no dia seguinte ao fim do evento. Dá para preparar critérios e avaliadores."}
          </Notice>
        )}

        {/* Barra do quadro: agrupar + ações do evento; abaixo, o filtro de situação. */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {areaMode ? (
            <Segmented<AreaBoardMode>
              label="Agrupar"
              value={boardMode}
              onChange={setBoardMode}
              options={[
                { value: "area", label: "Por área", testId: "board-mode-area" },
                { value: "criterion", label: "Por critério", testId: "board-mode-criterion" },
              ]}
            />
          ) : (
            <Eyebrow as="h3">Critérios do evento</Eyebrow>
          )}
          {canManage && (
            <div className="flex flex-wrap items-center gap-1.5">
              {critPillCounts.unassigned > 0 && (
                <button
                  type="button"
                  data-testid="button-apply-default-evaluators"
                  disabled={generateAssignments.isPending}
                  onClick={() => generateAssignments.mutate(undefined, {
                    onSuccess: (r) => toast({ title: r.generated > 0 ? `Avaliadores padrão aplicados a ${plural(r.generated, "critério")}` : "Nenhum critério pendente para aplicar" }),
                    onError: (e) => toast({ title: "Erro ao aplicar avaliadores", description: e.message, variant: "destructive" }),
                  })}
                  className={cn(btnSmall, "bg-primary text-primary-foreground border-transparent enabled:hover:bg-primary enabled:hover:opacity-90")}
                  title="Preenche cada critério sem avaliador com o Avaliador Padrão cadastrado nos Critérios"
                >
                  {generateAssignments.isPending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <UserCheck size={14} aria-hidden />}
                  {generateAssignments.isPending ? "Aplicando..." : "Aplicar avaliadores padrão"}
                </button>
              )}
              {showGenerateAll && (
                <button
                  type="button"
                  data-testid="button-generate-all-links"
                  disabled={batchRunning}
                  onClick={handleGenerateAllLinks}
                  className={btnSmall}
                  title={areaMode
                    ? "Gera um link por área, em nome do avaliador da área que você escolher (Cenografia já vem com a Matriz de Conformidade)"
                    : "Gera um link por avaliador (Cenografia já vem com a Matriz de Conformidade no mesmo questionário)"}
                >
                  {batchRunning ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Link2 size={14} aria-hidden />}
                  {batchRunning ? "Gerando..." : "Gerar todos os links"}
                </button>
              )}
              <button
                type="button"
                data-testid="button-sync-criteria-assign"
                disabled={resyncCriteria.isPending}
                onClick={() => resyncCriteria.mutate({ id: selected.id })}
                className={btnSmall}
                title="Adiciona a este evento os critérios do catálogo que estão faltando. É aditivo — não remove critérios já avaliados. Só afeta ESTE evento."
              >
                <RefreshCw size={14} aria-hidden className={resyncCriteria.isPending ? "animate-spin" : ""} />
                {resyncCriteria.isPending ? "Sincronizando..." : "Sincronizar critérios"}
              </button>
            </div>
          )}
        </div>

        <div className="-mx-1 px-1 overflow-x-auto">
          <Segmented<CritFilter>
            label="Filtrar por situação"
            size="sm"
            value={critFilter}
            onChange={setCritFilter}
            className="w-max min-w-full sm:min-w-0"
            options={pills.map(k => ({
              value: k,
              testId: `crit-filter-${k}`,
              label: <>{pillLabel(k)} <span className="tabular-nums text-muted-foreground">{critPillCounts[k]}</span></>,
            }))}
          />
        </div>

        {areaMode && (
          <p data-testid="notice-area-mode-admin" className="flex items-start gap-2 text-[13px] leading-snug text-muted-foreground">
            <Info size={14} className="shrink-0 mt-[2px]" aria-hidden />
            <span><b className="font-semibold text-foreground">No ciclo por área, só o avaliador da área responde</b> — a primeira resposta da área vale. Ajustes na Calibração.</span>
          </p>
        )}

        {canManage && selected.unassigned > 0 && (critFilter === "all" || critFilter === "unassigned") && (
          <BulkAssign selected={selected} bulkAssignAreaId={bulkAssignAreaId} setBulkAssignAreaId={setBulkAssignAreaId} bulkBusy={bulkBusy} handleBulkAssign={handleBulkAssign} />
        )}

        {areaMode ? (
          <AreaBoard
            selected={selected}
            groups={visibleGroups}
            mode={boardMode}
            canManage={canManage}
            canViewSubmissions={canViewSubmissions}
            tokens={allTokens}
            openLinkDialog={openLinkDialog}
            setViewEvalCrit={setViewEvalCrit}
          />
        ) : (
          <LegacyCriteriaList
            criteria={filteredCriteria}
            canManage={canManage}
            canViewSubmissions={canViewSubmissions}
            canLink={canLink}
            openPickerCriterionId={openPickerCriterionId}
            setOpenPickerCriterionId={setOpenPickerCriterionId}
            handleAssign={handleAssign}
            openLinkDialog={openLinkDialog}
            setViewEvalCrit={setViewEvalCrit}
          />
        )}

        {conformitySection}
      </div>
    </section>
  );
}
