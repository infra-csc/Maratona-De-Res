import type { Dispatch, SetStateAction } from "react";
import type { EventDetail } from "@workspace/api-client-react";
import { CheckCircle2, SlidersHorizontal, Info, Lock, Unlock, AlertCircle, Save, RefreshCw, UserCheck, Users } from "lucide-react";
import { CONDENSED, WARNING, AMBER, GOOD, GOOD_TEXT, AMBER_TEXT } from "@/lib/premium-theme";
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
    primaryEvaluator, updateCriteria, resyncCriteria, updateAssignments,
    criteriaConfirmed, hasEvaluations, handleSaveCriteria, weightsDirty,
    assignAreas, allAssigned, assignmentsDirty, handleSaveAssignments, handleSaveAllCriteria, handleConfirmAndRelease, confirmBusy,
    applyAreaDefaults, areasLockedReason, handleApplyAreaDefaults,
  } = mgmt;
  // Ciclo com avaliação POR ÁREA: qualquer avaliador da área responde — não há
  // avaliador principal obrigatório (nem o vermelho "Sem avaliador principal").
  const areaMode = selected.areaMode;
  const missingAreas = assignAreas.filter(a => primaryEvaluator[a.areaId] == null).map(a => a.areaName);
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
            {!areaMode && assignAreas.map(a => {
              const assigned = primaryEvaluator[a.areaId] != null;
              return (
                <span key={a.areaId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black uppercase" style={{ backgroundColor: assigned ? "rgba(154,176,0,0.14)" : "rgba(229,72,77,0.12)", color: assigned ? GOOD : WARNING }}>
                  {assigned ? <UserCheck size={10} /> : <AlertCircle size={10} />} {a.areaName}
                </span>
              );
            })}
            {criteriaConfirmed ? (
              <span data-testid="badge-criteria-confirmed" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
                <Lock size={12} /> Critérios confirmados
              </span>
            ) : (
              // Não é pendência: a avaliação abre sozinha no dia seguinte ao evento
              // (e os critérios são confirmados junto). Por isso, sem vermelho.
              <span data-testid="badge-criteria-pending" title="A avaliação abre sozinha no dia seguinte ao fim do evento; os critérios são confirmados junto." className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                <Unlock size={12} /> Critérios em aberto
              </span>
            )}
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3 rounded-lg px-4 py-3" style={{ backgroundColor: "var(--secondary)" }}>
            <Info size={16} className="shrink-0 mt-0.5" style={{ color: "var(--accent-text)" }} />
            <p className="text-xs" data-testid="criteria-flow-help">
              <strong>Fluxo:</strong>{" "}
              {areaMode
                ? <>defina o peso de cada critério. A avaliação abre <strong>sozinha no dia seguinte ao fim do evento</strong> e, neste ciclo, qualquer avaliador da área do critério responde — não há avaliador principal a escolher. Confirmar os critérios antes só trava a estrutura; os pesos continuam editáveis.</>
                : <>defina o peso de cada critério e o avaliador principal de cada área. A avaliação abre <strong>sozinha no dia seguinte ao fim do evento</strong>, com os critérios confirmados junto; quem ainda não tiver avaliador pode ser atribuído depois. Os pesos continuam editáveis.</>}
            </p>
          </div>

          {!criteriaConfirmed && !areaMode && (
            <div className="flex items-start gap-3 rounded-lg px-5 py-4" style={{ border: `1px solid ${allAssigned ? GOOD : AMBER}`, backgroundColor: allAssigned ? "rgba(154,176,0,0.08)" : "rgba(232,162,61,0.08)" }}>
              {allAssigned ? <Unlock size={18} className="shrink-0 mt-0.5" style={{ color: GOOD_TEXT }} /> : <Lock size={18} className="shrink-0 mt-0.5" style={{ color: AMBER_TEXT }} />}
              <div>
                <p className="text-xs font-black uppercase">
                  {allAssigned ? "Avaliadores definidos" : "Faltam avaliadores principais"}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  {!allAssigned
                    ? `Ainda sem avaliador: ${missingAreas.join(", ")}. A avaliação abre mesmo assim no dia seguinte ao evento — atribua quando a informação chegar.`
                    : "Tudo certo: a avaliação abre sozinha no dia seguinte ao fim do evento."}
                </p>
              </div>
            </div>
          )}

          {hasEvaluations && (
            <div data-testid="notice-criteria-locked" className="flex items-center gap-2 rounded-lg px-4 py-3 text-xs font-bold uppercase" style={{ backgroundColor: "rgba(232,162,61,0.10)", color: AMBER_TEXT }}>
              <Lock size={14} className="shrink-0" /> Este evento já possui avaliações. Critérios e avaliadores estão bloqueados, mas os pesos continuam editáveis — ao salvar, o resultado é recalculado.
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p id="area-defaults-help" className="text-xs max-w-2xl" style={{ color: "var(--muted-foreground)" }}>
              <Users size={13} className="inline mr-1.5 -mt-0.5" aria-hidden="true" />
              Um critério pode ser respondido por várias áreas; a nota dele no evento é a média das áreas. Use <strong>Áreas</strong> em cada critério ou aplique o padrão do catálogo.
            </p>
            <button
              type="button"
              data-testid="button-apply-area-defaults"
              onClick={handleApplyAreaDefaults}
              disabled={areasLockedReason != null || applyAreaDefaults.isPending}
              title={areasLockedReason ?? "Cria as áreas que faltam neste evento conforme o padrão do catálogo de Critérios (não remove nenhuma)"}
              aria-describedby="area-defaults-help"
              className="rounded-lg px-4 py-2 font-bold text-xs uppercase tracking-wide flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:opacity-80"
              style={{ border: "1px solid var(--border)" }}
            >
              <Users size={14} aria-hidden="true" /> {applyAreaDefaults.isPending ? "Aplicando..." : "Aplicar áreas do padrão"}
            </button>
          </div>
          {areasLockedReason && (
            <p className="text-[11px] -mt-2 text-right" style={{ color: "var(--muted-foreground)" }}>{areasLockedReason}</p>
          )}

          <CriteriaTable mgmt={mgmt} isAdmin={isAdmin} areaMode={areaMode} />

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
                  title="Salva e trava a estrutura de critérios agora. Não é obrigatório: a avaliação abre sozinha no dia seguinte ao fim do evento, com os critérios confirmados junto."
                  className="rounded-lg px-5 py-3 font-black text-sm uppercase tracking-wide flex items-center gap-2 disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  <CheckCircle2 size={16} /> {confirmBusy ? "Confirmando..." : "Confirmar critérios"}
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
