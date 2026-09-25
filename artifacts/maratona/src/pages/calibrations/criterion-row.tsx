// Linha da tabela de calibração: critério (notas dos avaliadores, justificativa,
// histórico e comentários), peso, média do avaliador, nota calibrada e status.
import type React from "react";
import { Check, Save } from "lucide-react";
import { CONDENSED, WARNING, GOOD } from "@/lib/premium-theme";
import { fieldStyle } from "./helpers";
import type { DerivedCriteria } from "./derive";
import { EvaluatorScores } from "./evaluator-scores";
import { CalibrationReasonEditor } from "./calibration-reason-editor";
import { CalibrationAuditTrail } from "./calibration-audit-trail";
import { CriterionComments } from "./criterion-comments";
import { PublishStatusCell } from "./publish-status-cell";
import { fmtNum } from "@/lib/utils";
import type {
  AddCommentMutation,
  CalibrationAuditItem,
  CalibrationCommentItem,
  DeleteCommentMutation,
  EventCriterion,
  PublishIntent,
  ToastFn,
} from "./types";

// Props comuns a todas as linhas (estado e ações vêm do componente pai).
export type CriterionRowSharedProps = {
  getAreaScores: DerivedCriteria["getAreaScores"];
  getAvgScore: DerivedCriteria["getAvgScore"];
  getCalibration: DerivedCriteria["getCalibration"];
  childCriterionIdsMap: DerivedCriteria["childCriterionIdsMap"];
  activeCriteria: EventCriterion[];
  calScores: Record<number, string>;
  setCalScores: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  calReasons: Record<number, string>;
  setCalReasons: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  savedReasonIds: Set<number>;
  setSavedReasonIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  savingCritId: number | null;
  savingAll: boolean;
  saveCalibration: (critId: number) => Promise<void>;
  expandedEvalComments: Set<string>;
  setExpandedEvalComments: React.Dispatch<React.SetStateAction<Set<string>>>;
  calAudit: CalibrationAuditItem[] | undefined;
  calComments: CalibrationCommentItem[] | undefined;
  newCommentTexts: Record<number, string>;
  setNewCommentTexts: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  canFinalize: boolean;
  addCommentMutation: AddCommentMutation;
  deleteCommentMutation: DeleteCommentMutation;
  toast: ToastFn;
  canEditWeights: boolean;
  weightEdits: Record<number, string>;
  setWeightEdits: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  savingWeightId: number | null;
  updateWeightPending: boolean;
  saveWeight: (critId: number, active: boolean) => void;
  publishIntents: Record<number, PublishIntent>;
  setPublishIntents: React.Dispatch<React.SetStateAction<Record<number, PublishIntent>>>;
};

export type CriterionRowProps = CriterionRowSharedProps & { c: EventCriterion };

export function CriterionRow({
  c,
  getAreaScores,
  getAvgScore,
  getCalibration,
  childCriterionIdsMap,
  activeCriteria,
  calScores,
  setCalScores,
  calReasons,
  setCalReasons,
  savedReasonIds,
  setSavedReasonIds,
  savingCritId,
  savingAll,
  saveCalibration,
  expandedEvalComments,
  setExpandedEvalComments,
  calAudit,
  calComments,
  newCommentTexts,
  setNewCommentTexts,
  canFinalize,
  addCommentMutation,
  deleteCommentMutation,
  toast,
  canEditWeights,
  weightEdits,
  setWeightEdits,
  savingWeightId,
  updateWeightPending,
  saveWeight,
  publishIntents,
  setPublishIntents,
}: CriterionRowProps) {
                        const areaScores = getAreaScores(c.criterionId);
                        const avg = getAvgScore(c.criterionId);
                        const cal = getCalibration(c.criterionId);
                        // Number(): o contrato diz number, mas colunas numeric do Postgres podem chegar como string.
                        const calVal = cal ? Number(cal.calibratedScore) : null;
                        const scoreVal = calScores[c.criterionId] ?? (calVal != null ? String(calVal) : "");
                        const isSaving = savingCritId === c.criterionId;
                        const isFinalPublished = !!c.finalPublishedAt;
                        const peso = c.weightOverride ?? c.originalWeight ?? 0;
                        const hasUnsaved = calScores[c.criterionId] !== undefined;
                        const savedScore = calVal;
                        const changedFromSaved = hasUnsaved && String(savedScore) !== calScores[c.criterionId];
                        const reasonVal = calReasons[c.criterionId] ?? (cal?.calibrationReason ?? "");
                        const reasonChanged = calReasons[c.criterionId] !== undefined && calReasons[c.criterionId] !== (cal?.calibrationReason ?? "");

                        return (
                          <tr
                            data-testid={`row-cal-${c.criterionId}`}
                            className="transition-colors group"
                            style={{ borderTop: "1px solid var(--border)" }}
                          >
                            {/* Critério */}
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black uppercase text-[12px] leading-tight" style={{ fontFamily: CONDENSED }}>{c.criterionName}</span>
                                {c.responsibleAreaName && (
                                  <span className="hidden lg:inline text-[11px] font-bold uppercase rounded px-1" style={{ color: "var(--muted-foreground)", backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>{c.responsibleAreaName}</span>
                                )}
                                {(childCriterionIdsMap.get(c.criterionId) ?? []).map(childId => {
                                  const childCrit = activeCriteria.find(ac => ac.criterionId === childId);
                                  return childCrit?.responsibleAreaName ? (
                                    <span key={childId} className="hidden lg:inline text-[11px] font-bold uppercase rounded px-1" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>+ {childCrit.responsibleAreaName}</span>
                                  ) : null;
                                })}
                              </div>
                              {/* ── Avaliadores: nota individual + comentário ── */}
                              <EvaluatorScores
                                criterionId={c.criterionId}
                                areaScores={areaScores}
                                setCalReasons={setCalReasons}
                                expandedEvalComments={expandedEvalComments}
                                setExpandedEvalComments={setExpandedEvalComments}
                              />
                              {/* ── Justificativa da calibração (editável) ── */}
                              <CalibrationReasonEditor
                                criterionId={c.criterionId}
                                cal={cal}
                                calVal={calVal}
                                reasonVal={reasonVal}
                                reasonChanged={reasonChanged}
                                isSaving={isSaving}
                                savedReasonIds={savedReasonIds}
                                setSavedReasonIds={setSavedReasonIds}
                                setCalReasons={setCalReasons}
                                saveCalibration={saveCalibration}
                              />

                              {/* ── Histórico de calibrações (sempre visível) ─ */}
                              <CalibrationAuditTrail criterionId={c.criterionId} calAudit={calAudit} />

                              {/* ── Comentários ─────────────────────────────── */}
                              <CriterionComments
                                criterionId={c.criterionId}
                                calComments={calComments}
                                newCommentTexts={newCommentTexts}
                                setNewCommentTexts={setNewCommentTexts}
                                canFinalize={canFinalize}
                                addCommentMutation={addCommentMutation}
                                deleteCommentMutation={deleteCommentMutation}
                                toast={toast}
                              />
                            </td>
                            {/* Peso */}
                            <td className="px-2 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                              {canEditWeights ? (
                                <div className="flex items-center justify-center gap-1">
                                  <input
                                    data-testid={`input-weight-${c.criterionId}`}
                                    aria-label={`Peso de ${c.criterionName}`}
                                    type="text"
                                    inputMode="decimal"
                                    value={weightEdits[c.criterionId] ?? String(peso)}
                                    onChange={e => setWeightEdits(prev => ({ ...prev, [c.criterionId]: e.target.value.replace(/[^0-9.,]/g, "") }))}
                                    className="h-6 w-10 px-1 rounded text-center text-xs font-black focus:outline-none"
                                    style={fieldStyle}
                                  />
                                  {weightEdits[c.criterionId] != null && Number(weightEdits[c.criterionId].replace(",", ".")) !== Number(peso) && (
                                    <button
                                      data-testid={`button-save-weight-${c.criterionId}`}
                                      type="button"
                                      disabled={savingWeightId === c.criterionId && updateWeightPending}
                                      onClick={() => saveWeight(c.criterionId, c.active)}
                                      title="Salvar peso"
                                      className="h-6 w-6 rounded flex items-center justify-center disabled:opacity-50 transition-opacity hover:opacity-90"
                                      style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                                    >
                                      {savingWeightId === c.criterionId && updateWeightPending ? "·" : <Check size={10} />}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs font-black">{peso}</span>
                              )}
                            </td>
                            {/* Nota Avaliador */}
                            <td className="px-2 py-2.5 text-center">
                              {/* Quando há múltiplos avaliadores, mostra breakdown por área */}
                              {areaScores.length > 1 && (
                                <div className="flex items-center justify-center gap-1 mb-0.5 flex-wrap">
                                  {areaScores.map((s, si) => (
                                    <span
                                      key={si}
                                      className="text-[11px] font-black px-1 py-px leading-none"
                                      style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)", fontFamily: CONDENSED }}
                                      title={`${s.name}${s.areaName ? ` · ${s.areaName}` : ""}: ${fmtNum(s.score, 1)}`}
                                    >
                                      {fmtNum(s.score, 1)}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <span className="text-sm font-black" style={{ color: calVal != null ? "var(--muted-foreground)" : "var(--foreground)", textDecoration: calVal != null ? "line-through" : "none" }}>
                                {avg != null ? fmtNum(avg, 2) : <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>—</span>}
                              </span>
                            </td>
                            {/* Nota Calibrada inline */}
                            <td className="px-2 py-2.5" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  data-testid={`input-cal-score-${c.criterionId}`}
                                  type="text"
                                  inputMode="numeric"
                                  value={scoreVal}
                                  onChange={e => setCalScores(prev => ({ ...prev, [c.criterionId]: e.target.value.replace(/[^0-9]/g, "") }))}
                                  placeholder="—"
                                  className="h-7 w-12 px-1 rounded text-center text-sm font-black focus:outline-none"
                                  style={{
                                    border: changedFromSaved ? `2px solid ${WARNING}` : calVal != null ? `2px solid ${GOOD}` : "2px solid var(--border)",
                                    backgroundColor: changedFromSaved ? "rgba(229,72,77,0.08)" : calVal != null ? "rgba(154,176,0,0.10)" : "var(--secondary)",
                                    color: "var(--foreground)",
                                  }}
                                />
                                {changedFromSaved && (
                                  <button
                                    data-testid={`button-save-cal-${c.criterionId}`}
                                    type="button"
                                    disabled={isSaving || savingAll}
                                    onClick={() => void saveCalibration(c.criterionId)}
                                    title="Salvar calibração"
                                    className="h-7 w-7 rounded flex items-center justify-center disabled:opacity-50 transition-opacity hover:opacity-90"
                                    style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                                  >
                                    {isSaving ? "·" : <Save size={11} />}
                                  </button>
                                )}
                              </div>
                            </td>
                            {/* Status + seletor de intenção de publicação */}
                            <PublishStatusCell
                              c={c}
                              cal={cal}
                              avg={avg}
                              isFinalPublished={isFinalPublished}
                              canFinalize={canFinalize}
                              publishIntents={publishIntents}
                              setPublishIntents={setPublishIntents}
                            />
                          </tr>
                        );
}
