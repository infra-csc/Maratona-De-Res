// Histórico de calibrações de um critério (sempre visível quando há registros).
import { History } from "lucide-react";
import { GOOD, AMBER, GOOD_TEXT } from "@/lib/premium-theme";
import { formatDateTime } from "./helpers";
import type { CalibrationAuditItem } from "./types";

export type CalibrationAuditTrailProps = {
  criterionId: number;
  calAudit: CalibrationAuditItem[] | undefined;
};

export function CalibrationAuditTrail({ criterionId, calAudit }: CalibrationAuditTrailProps) {
                                const auditEntries = (calAudit ?? []).filter(a => a.criterionId === criterionId);
                                if (!auditEntries.length) return null;
                                return (
                                  <div className="mt-1.5 space-y-0.5" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center gap-1 mb-0.5">
                                      <History size={8} style={{ color: "var(--muted-foreground)" }} />
                                      <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                                        Histórico ({auditEntries.length})
                                      </span>
                                    </div>
                                    {auditEntries.map(entry => {
                                      const before = entry.beforeJson ? (() => { try { return JSON.parse(entry.beforeJson); } catch { return null; } })() : null;
                                      const after  = entry.afterJson  ? (() => { try { return JSON.parse(entry.afterJson);  } catch { return null; } })() : null;
                                      const isRecal = entry.action === "recalibrate_released";
                                      const scoreText = after?.score != null
                                        ? (before?.score != null ? `${before.score} → ${after.score}` : `→ ${after.score}`)
                                        : null;
                                      return (
                                        <div key={entry.id} className="flex items-center gap-1.5 flex-wrap px-1.5 py-1 rounded"
                                          style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>
                                          <span className="shrink-0 text-[11px] font-black uppercase px-1 py-px rounded"
                                            style={{ backgroundColor: isRecal ? "rgba(232,162,61,0.18)" : "rgba(154,176,0,0.14)", color: isRecal ? AMBER : GOOD }}>
                                            {isRecal ? "Recal. pós-lib." : "Calibrou"}
                                          </span>
                                          <span className="text-[11px] font-bold">{entry.userName ?? "?"}</span>
                                          {scoreText && (
                                            <span className="text-[11px] font-black" style={{ color: GOOD_TEXT }}>{scoreText}</span>
                                          )}
                                          <span className="text-[11px] ml-auto" style={{ color: "var(--muted-foreground)" }}>
                                            {formatDateTime(new Date(entry.createdAt))}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
}
