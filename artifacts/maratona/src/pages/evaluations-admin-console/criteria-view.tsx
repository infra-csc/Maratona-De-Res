import type { Dispatch, SetStateAction } from "react";
import type { EventDetail } from "@workspace/api-client-react";
import { CheckCircle2, Info, Lock, Unlock, AlertCircle, Save, RefreshCw, UserCheck, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EventCombobox } from "./pickers";
import { CriteriaTable } from "./criteria-table";
import { CriteriaDialogs } from "./criteria-dialogs";
import { Chip, Eyebrow, Notice, btnPrimary, btnSecondary, btnSmall, surfaceCls } from "./console-ui";
import type { CriteriaManagement } from "./use-criteria-management";
import type { EnrichedEvent } from "./types";

/** Aba Critérios — pesos, áreas e avaliadores do evento selecionado (e a confirmação dos critérios). */
export function CriteriaView({ selected, selectedDetail, enrichedEvents, setSelectedEventId, mgmt, isAdmin }: {
  selected: EnrichedEvent;
  selectedDetail: EventDetail;
  enrichedEvents: EnrichedEvent[];
  setSelectedEventId: Dispatch<SetStateAction<number | null>>;
  mgmt: CriteriaManagement;
  isAdmin: boolean;
}) {
  const {
    primaryEvaluator, updateCriteria, resyncCriteria, updateAssignments,
    criteriaConfirmed, hasEvaluations, handleSaveCriteria, weightsDirty,
    assignAreas, allAssigned, assignmentsDirty, handleSaveAssignments, handleSaveAllCriteria, handleConfirmAndRelease, confirmBusy,
    applyAreaDefaults, areasLockedReason, handleApplyAreaDefaults,
  } = mgmt;
  // Ciclo com avaliação POR ÁREA: qualquer avaliador da área responde — não há
  // avaliador principal obrigatório (nem o vermelho "Sem avaliador principal").
  const areaMode = selected.areaMode;
  const missingAreas = assignAreas.filter(a => primaryEvaluator[a.areaId] == null).map(a => a.areaName);
  const saving = updateCriteria.isPending || updateAssignments.isPending;
  const spin = <Loader2 size={15} className="animate-spin" aria-hidden />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <EventCombobox events={enrichedEvents} value={selected.id} onChange={setSelectedEventId} />
        {criteriaConfirmed ? (
          <Chip tone="brand" icon={Lock} data-testid="badge-criteria-confirmed">Critérios confirmados</Chip>
        ) : (
          // Não é pendência: a avaliação abre sozinha no dia seguinte ao evento
          // (e os critérios são confirmados junto). Por isso, sem vermelho.
          <Chip icon={Unlock} data-testid="badge-criteria-pending" title="A avaliação abre sozinha no dia seguinte ao fim do evento; os critérios são confirmados junto.">Critérios em aberto</Chip>
        )}
        {!areaMode && assignAreas.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Avaliador principal por área">
            {assignAreas.map(a => {
              const assigned = primaryEvaluator[a.areaId] != null;
              return <Chip key={a.areaId} tone={assigned ? "ok" : "danger"} icon={assigned ? UserCheck : AlertCircle}>{a.areaName}</Chip>;
            })}
          </div>
        )}
      </div>

      <section className={cn(surfaceCls, "overflow-hidden")} aria-label="Critérios, pesos e avaliadores">
        <div className="px-4 sm:px-5 py-4 space-y-3 border-b border-border">
          <Notice icon={Info} tone="neutral" testId="criteria-flow-help">
            <b className="font-semibold text-foreground">Fluxo:</b>{" "}
            {areaMode
              ? <>defina o peso de cada critério. A avaliação abre <b className="font-semibold text-foreground">sozinha no dia seguinte ao fim do evento</b> e, neste ciclo, qualquer avaliador da área do critério responde — não há avaliador principal a escolher. Confirmar os critérios antes só trava a estrutura; os pesos continuam editáveis.</>
              : <>defina o peso de cada critério e o avaliador principal de cada área. A avaliação abre <b className="font-semibold text-foreground">sozinha no dia seguinte ao fim do evento</b>, com os critérios confirmados junto; quem ainda não tiver avaliador pode ser atribuído depois. Os pesos continuam editáveis.</>}
          </Notice>

          {!criteriaConfirmed && !areaMode && (
            <Notice icon={allAssigned ? Unlock : Lock} tone={allAssigned ? "ok" : "warn"}>
              <b className="font-semibold">{allAssigned ? "Avaliadores definidos" : "Faltam avaliadores principais"}</b>
              <span className="block mt-0.5 text-muted-foreground">
                {!allAssigned
                  ? `Ainda sem avaliador: ${missingAreas.join(", ")}. A avaliação abre mesmo assim no dia seguinte ao evento — atribua quando a informação chegar.`
                  : "Tudo certo: a avaliação abre sozinha no dia seguinte ao fim do evento."}
              </span>
            </Notice>
          )}

          {hasEvaluations && (
            <Notice icon={Lock} tone="warn" testId="notice-criteria-locked">
              Este evento já possui avaliações. Critérios e avaliadores estão bloqueados, mas os pesos continuam editáveis — ao salvar, o resultado é recalculado.
            </Notice>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p id="area-defaults-help" className="text-[13px] leading-snug max-w-2xl text-muted-foreground">
              Um critério pode ser respondido por várias áreas; a nota dele no evento é a média das áreas. Use <b className="font-semibold text-foreground">Áreas</b> em cada critério ou aplique o padrão do catálogo.
            </p>
            <button
              type="button"
              data-testid="button-apply-area-defaults"
              onClick={handleApplyAreaDefaults}
              disabled={areasLockedReason != null || applyAreaDefaults.isPending}
              title={areasLockedReason ?? "Cria as áreas que faltam neste evento conforme o padrão do catálogo de Critérios (não remove nenhuma)"}
              aria-describedby="area-defaults-help"
              className={btnSmall}
            >
              {applyAreaDefaults.isPending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Users size={14} aria-hidden />}
              {applyAreaDefaults.isPending ? "Aplicando..." : "Aplicar áreas do padrão"}
            </button>
          </div>
          {areasLockedReason && <p className="text-[12.5px] text-right text-muted-foreground">{areasLockedReason}</p>}
        </div>

        <CriteriaTable mgmt={mgmt} isAdmin={isAdmin} areaMode={areaMode} />
        <CriteriaDialogs mgmt={mgmt} selected={selected} selectedDetail={selectedDetail} />

        <div className="border-t border-border bg-secondary/30 px-4 sm:px-5 py-3.5 flex flex-wrap items-center justify-end gap-2">
          {hasEvaluations && (
            <span data-testid="text-criteria-locked" className="mr-auto inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Lock size={14} aria-hidden /> Critérios bloqueados — pesos continuam editáveis
            </span>
          )}
          {!hasEvaluations && <Eyebrow as="span" className="mr-auto hidden sm:block">{criteriaConfirmed ? "Salve o que mudar" : "Salvar não confirma; confirmar trava a estrutura"}</Eyebrow>}
          {!criteriaConfirmed ? (
            <>
              <button
                type="button"
                data-testid="button-resync-criteria"
                onClick={() => resyncCriteria.mutate({ id: selected.id })}
                disabled={resyncCriteria.isPending}
                title={hasEvaluations ? "Adiciona critérios novos do catálogo que ainda faltam neste evento (não toca critérios com avaliações, não reativa os que foram desligados de propósito)" : "Remove critérios que não fazem mais parte do catálogo ativo e adiciona os que faltam (não reativa os que foram desligados de propósito)"}
                className={btnSecondary}
              >
                {resyncCriteria.isPending ? spin : <RefreshCw size={15} aria-hidden />} {resyncCriteria.isPending ? "Sincronizando..." : "Sincronizar critérios ativos"}
              </button>
              <button type="button" data-testid="button-save-criteria" onClick={handleSaveAllCriteria} disabled={saving} className={btnSecondary}>
                {saving ? spin : <Save size={15} aria-hidden />} {saving ? "Salvando..." : "Salvar"}
              </button>
              <button
                type="button"
                data-testid="button-confirm-criteria"
                onClick={handleConfirmAndRelease}
                disabled={confirmBusy}
                title="Salva e trava a estrutura de critérios agora. Não é obrigatório: a avaliação abre sozinha no dia seguinte ao fim do evento, com os critérios confirmados junto."
                className={btnPrimary}
              >
                {confirmBusy ? spin : <CheckCircle2 size={15} aria-hidden />} {confirmBusy ? "Confirmando..." : "Confirmar critérios"}
              </button>
            </>
          ) : (
            <>
              {assignmentsDirty && (
                <button type="button" data-testid="button-save-assignments" onClick={handleSaveAssignments} disabled={updateAssignments.isPending} className={btnPrimary}>
                  {updateAssignments.isPending ? spin : <Save size={15} aria-hidden />} {updateAssignments.isPending ? "Salvando..." : "Salvar avaliadores"}
                </button>
              )}
              {weightsDirty && (
                <button type="button" data-testid="button-save-weights" onClick={handleSaveCriteria} disabled={updateCriteria.isPending} className={btnPrimary}>
                  {updateCriteria.isPending ? spin : <Save size={15} aria-hidden />} {updateCriteria.isPending ? "Salvando..." : "Salvar pesos"}
                </button>
              )}
              {!assignmentsDirty && !weightsDirty && (
                <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground"><CheckCircle2 size={14} aria-hidden /> Tudo salvo</span>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
