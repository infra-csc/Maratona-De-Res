// Justificativa da calibração (editável), com indicadores "Salvo"/"Não salvo"
// e auto-save ao perder o foco quando já existe calibração.
import type React from "react";
import { AlertCircle, Check, Clock, Save } from "lucide-react";
import { AMBER, GOOD_TEXT, AMBER_TEXT } from "@/lib/premium-theme";
import { formatDateTime } from "./helpers";
import type { CalibrationRecord } from "./derive";
import { fmtNum } from "@/lib/utils";

export type CalibrationReasonEditorProps = {
  criterionId: number;
  cal: CalibrationRecord | undefined;
  calVal: number | null;
  reasonVal: string;
  reasonChanged: boolean;
  isSaving: boolean;
  savedReasonIds: Set<number>;
  setSavedReasonIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  setCalReasons: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  saveCalibration: (critId: number) => Promise<void>;
};

export function CalibrationReasonEditor({
  criterionId,
  cal,
  calVal,
  reasonVal,
  reasonChanged,
  isSaving,
  savedReasonIds,
  setSavedReasonIds,
  setCalReasons,
  saveCalibration,
}: CalibrationReasonEditorProps) {
  return (
                              <div onClick={e => e.stopPropagation()} className="mt-2 pt-1.5" style={{ borderTop: "1px dashed var(--border)" }}>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="text-[11px] font-black uppercase tracking-wider rounded px-1 py-px" style={{ color: "var(--muted-foreground)", backgroundColor: "var(--secondary)" }}>Calibração</span>
                                  {cal?.calibratedByName && (
                                    <span className="text-[11px] font-bold" style={{ color: "var(--muted-foreground)" }}>{cal.calibratedByName}</span>
                                  )}
                                  {calVal != null && (
                                    <span className="text-[11px] font-black" style={{ color: GOOD_TEXT }}>→ {fmtNum(calVal, 2)}</span>
                                  )}
                                  {cal?.calibratedAt && (
                                    <span className="text-[11px] flex items-center gap-0.5" style={{ color: "var(--muted-foreground)" }}>
                                      <Clock size={8} /> {formatDateTime(new Date(cal.calibratedAt))}
                                    </span>
                                  )}
                                  {/* ── Indicador de salvo ── */}
                                  {savedReasonIds.has(criterionId) && !reasonChanged && (
                                    <span className="ml-auto flex items-center gap-0.5 text-[11px] font-black uppercase" style={{ color: GOOD_TEXT }}>
                                      <Check size={9} /> Salvo
                                    </span>
                                  )}
                                  {/* ── Indicador de não salvo ── */}
                                  {reasonChanged && (
                                    <span className="ml-auto flex items-center gap-0.5 text-[11px] font-black uppercase" style={{ color: AMBER_TEXT }}>
                                      <AlertCircle size={9} /> Não salvo
                                    </span>
                                  )}
                                </div>
                                <textarea
                                  data-testid={`input-cal-reason-inline-${criterionId}`}
                                  rows={1}
                                  value={reasonVal}
                                  onClick={e => e.stopPropagation()}
                                  onChange={e => {
                                    setSavedReasonIds(prev => { const n = new Set(prev); n.delete(criterionId); return n; });
                                    setCalReasons(prev => ({ ...prev, [criterionId]: e.target.value }));
                                    e.target.style.height = "auto";
                                    e.target.style.height = e.target.scrollHeight + "px";
                                  }}
                                  onFocus={e => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                                  onBlur={e => {
                                    e.stopPropagation();
                                    // Auto-save ao perder foco quando há uma calibração existente e razão mudou.
                                    // O indicador "Salvo" é ligado por saveCalibration só após sucesso.
                                    if (reasonChanged && cal && !isSaving) {
                                      void saveCalibration(criterionId);
                                    }
                                  }}
                                  placeholder="Escreva a justificativa e clique fora para salvar…"
                                  className="w-full px-2 py-1.5 text-[11px] rounded resize-none leading-snug overflow-hidden transition-colors focus:outline-none"
                                  style={{
                                    border: reasonChanged ? `1px solid ${AMBER}` : "1px solid var(--border)",
                                    backgroundColor: reasonChanged ? "rgba(232,162,61,0.08)" : reasonVal ? "rgba(154,176,0,0.06)" : "var(--secondary)",
                                    color: "var(--foreground)",
                                  }}
                                />
                                {/* Ação manual quando não há calibração ainda ou usuário quer salvar explicitamente */}
                                {reasonChanged && (
                                  <div className="mt-1 flex items-center gap-2">
                                    {cal ? (
                                      <button
                                        type="button"
                                        disabled={isSaving}
                                        onClick={e => {
                                          e.stopPropagation();
                                          void saveCalibration(criterionId);
                                        }}
                                        className="px-2.5 py-1 rounded font-black uppercase text-[11px] disabled:opacity-50 transition-opacity hover:opacity-90 flex items-center gap-1"
                                        style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                                      >
                                        <Save size={10} /> Salvar justificativa
                                      </button>
                                    ) : (
                                      <p className="text-[11px] flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                                        <AlertCircle size={10} /> Salve a nota calibrada primeiro para gravar a justificativa.
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
  );
}
