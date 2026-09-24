import type { Dispatch, SetStateAction } from "react";
import type { EventDetail } from "@workspace/api-client-react";
import { CheckCircle2, SlidersHorizontal, Info, Lock, Unlock, AlertCircle, Save, RefreshCw, UserCheck } from "lucide-react";
import { CONDENSED, WARNING, AMBER, GOOD, GOOD_TEXT, AMBER_TEXT, DANGER_TEXT } from "@/lib/premium-theme";
import { EventCombobox } from "./pickers";
import { CriteriaTable } from "./criteria-table";
import { CriteriaDialogs } from "./criteria-dialogs";
import type { CriteriaManagement } from "./use-criteria-management";
import type { EnrichedEvent } from "./types";

/** Aba Critérios — pesos, avaliadores por área e liberação da avaliação do evento selecionado. */
export function CriteriaView({ selected, selectedDetail, enrichedEvents, setSelectedEventId, mgmt, isAdmin }: {
  selected: EnrichedEvent;
  selectedDetail: EventDetail;
  enrichedEvents: EnrichedEvent[];
  setSelectedEventId: Dispatch<SetStateAction<number | null>>;
  mgmt: CriteriaManagement;
  isAdmin: boolean;
}) {
  const {
    primaryEvaluator, updateCriteria, confirmCriteriaMutation, resyncCriteria, updateAssignments,
    criteriaConfirmed, hasEvaluations, handleSaveCriteria, handleConfirmCriteria, weightsDirty,
    assignAreas, allAssigned, assignmentsDirty, handleSaveAssignments, handleSaveAllCriteria, handleConfirmAndRelease, confirmBusy,
  } = mgmt;
  return (
    <div className="space-y-4">
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 flex-wrap">
            <SlidersHorizontal size={16} style={{ color: "var(--accent-text)" }} />
            <span className="font-black uppercase tracking-tight text-xs shrink-0" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>Critérios, Pesos e Avaliadores —</span>
            <EventCombobox events={enrichedEvents} value={selected.id} onChange={setSelectedEventId} accentStyle />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {assignAreas.map(a => {
              const assigned = primaryEvaluator[a.areaId] != null;
              return (
                <span key={a.areaId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black uppercase" style={{ backgroundColor: assigned ? "rgba(154,176,0,0.14)" : "rgba(229,72,77,0.12)", color: assigned ? GOOD : WARNING }}>
                  {assigned ? <UserCheck size={10} /> : <AlertCircle size={10} />} {a.areaName}
                </span>
              );
            })}
            {criteriaConfirmed ? (
              <span data-testid="badge-criteria-confirmed" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
                <Lock size={12} /> Liberado
              </span>
            ) : (
              <span data-testid="badge-criteria-pending" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase" style={{ backgroundColor: "rgba(229,72,77,0.12)", color: DANGER_TEXT }}>
                <AlertCircle size={12} /> Não Liberado
              </span>
            )}
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3 rounded-lg px-4 py-3" style={{ backgroundColor: "var(--secondary)" }}>
            <Info size={16} className="shrink-0 mt-0.5" style={{ color: "var(--accent-text)" }} />
            <p className="text-xs">
              <strong>Fluxo:</strong> Defina o peso de cada critério e atribua um avaliador principal para cada área. Depois clique em <strong>Confirmar e Liberar Avaliação</strong> para que as áreas comecem a avaliar. Após liberado, os pesos continuam editáveis mas a estrutura fica bloqueada.
            </p>
          </div>

          {!criteriaConfirmed && (
            <div className="flex items-start gap-3 rounded-lg px-5 py-4" style={{ border: `1px solid ${allAssigned ? GOOD : AMBER}`, backgroundColor: allAssigned ? "rgba(154,176,0,0.08)" : "rgba(232,162,61,0.08)" }}>
              {allAssigned ? <Unlock size={18} className="shrink-0 mt-0.5" style={{ color: GOOD_TEXT }} /> : <Lock size={18} className="shrink-0 mt-0.5" style={{ color: AMBER_TEXT }} />}
              <div>
                <p className="text-xs font-black uppercase">
                  {allAssigned ? "Tudo pronto — clique em Confirmar e Liberar Avaliação abaixo" : "Pode liberar parcialmente"}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  {!allAssigned
                    ? `Ainda sem avaliador: ${assignAreas.filter(a => primaryEvaluator[a.areaId] == null).map(a => a.areaName).join(", ")}. Pode liberar mesmo assim — atribua quando a informação chegar.`
                    : "Use o botão abaixo para liberar as avaliações para as áreas."}
                </p>
              </div>
            </div>
          )}

          {hasEvaluations && (
            <div data-testid="notice-criteria-locked" className="flex items-center gap-2 rounded-lg px-4 py-3 text-xs font-bold uppercase" style={{ backgroundColor: "rgba(232,162,61,0.10)", color: AMBER_TEXT }}>
              <Lock size={14} className="shrink-0" /> Este evento já possui avaliações. Critérios e avaliadores estão bloqueados, mas os pesos continuam editáveis — ao salvar, o resultado é recalculado.
            </div>
          )}

          <CriteriaTable mgmt={mgmt} isAdmin={isAdmin} />

          <CriteriaDialogs mgmt={mgmt} selected={selected} selectedDetail={selectedDetail} />

          <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
            {hasEvaluations && (
              <span data-testid="text-criteria-locked" className="flex items-center gap-2 text-xs font-bold uppercase rounded-lg px-4 py-3" style={{ color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                <Lock size={14} /> Critérios bloqueados — pesos continuam editáveis
              </span>
            )}
            {!criteriaConfirmed ? (
              <>
                <button
                  data-testid="button-resync-criteria"
                  onClick={() => resyncCriteria.mutate({ id: selected.id })}
                  disabled={resyncCriteria.isPending}
                  title={hasEvaluations ? "Adiciona critérios novos do catálogo que ainda faltam neste evento (não toca critérios com avaliações, não reativa os que foram desligados de propósito)" : "Remove critérios que não fazem mais parte do catálogo ativo e adiciona os que faltam (não reativa os que foram desligados de propósito)"}
                  className="rounded-lg px-5 py-3 font-bold text-sm uppercase tracking-wide flex items-center gap-2 disabled:opacity-50 transition-colors hover:opacity-80"
                  style={{ border: "1px solid var(--border)" }}
                >
                  <RefreshCw size={16} /> {resyncCriteria.isPending ? "Sincronizando..." : "Sincronizar Critérios Ativos"}
                </button>
                <button
                  data-testid="button-save-criteria"
                  onClick={handleSaveAllCriteria}
                  disabled={updateCriteria.isPending || updateAssignments.isPending}
                  className="rounded-lg px-5 py-3 font-bold text-sm uppercase tracking-wide flex items-center gap-2 disabled:opacity-50 transition-colors hover:opacity-80"
                  style={{ border: "1px solid var(--border)" }}
                >
                  <Save size={16} /> {(updateCriteria.isPending || updateAssignments.isPending) ? "Salvando..." : "Salvar"}
                </button>
                <button
                  data-testid="button-confirm-criteria"
                  onClick={handleConfirmAndRelease}
                  disabled={confirmBusy}
                  title={(!hasEvaluations && !allAssigned) ? "Algumas áreas ainda não têm avaliador — pode liberar mesmo assim e atribuir depois" : undefined}
                  className="rounded-lg px-5 py-3 font-black text-sm uppercase tracking-wide flex items-center gap-2 disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  <CheckCircle2 size={16} /> {confirmBusy ? "Confirmando..." : "Confirmar e Liberar Avaliação"}
                </button>
              </>
            ) : (
              <>
                {assignmentsDirty && (
                  <button
                    data-testid="button-save-assignments"
                    onClick={handleSaveAssignments}
                    disabled={updateAssignments.isPending}
                    className="rounded-lg px-5 py-3 font-black text-sm uppercase tracking-wide flex items-center gap-2 disabled:opacity-50 transition-opacity hover:opacity-90"
                    style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                  >
                    <Save size={16} /> {updateAssignments.isPending ? "Salvando..." : "Salvar Avaliadores"}
                  </button>
                )}
                {weightsDirty && (
                  <button
                    data-testid="button-save-weights"
                    onClick={handleSaveCriteria}
                    disabled={updateCriteria.isPending}
                    className="rounded-lg px-5 py-3 font-black text-sm uppercase tracking-wide flex items-center gap-2 disabled:opacity-50 transition-opacity hover:opacity-90"
                    style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                  >
                    <Save size={16} /> {updateCriteria.isPending ? "Salvando..." : "Salvar Pesos"}
                  </button>
                )}
                {!hasEvaluations && (
                  <button
                    data-testid="button-reopen-criteria"
                    onClick={() => handleConfirmCriteria(false)}
                    disabled={confirmCriteriaMutation.isPending}
                    className="rounded-lg px-5 py-3 font-bold text-sm uppercase tracking-wide flex items-center gap-2 disabled:opacity-50 transition-opacity hover:opacity-90"
                    style={{ backgroundColor: WARNING, color: "#fff" }}
                  >
                    <Unlock size={16} /> Reabrir Edição dos Critérios
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
