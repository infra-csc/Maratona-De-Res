// Célula "Status" da tabela: estado de publicação do critério + toggle de intenção Parc./Final.
import type React from "react";
import { CheckCircle } from "lucide-react";
import { GOOD, AMBER, GOOD_TEXT, AMBER_TEXT } from "@/lib/premium-theme";
import { formatDateTime } from "./helpers";
import type { CalibrationRecord } from "./derive";
import type { EventCriterion, PublishIntent } from "./types";

export type PublishStatusCellProps = {
  c: EventCriterion;
  cal: CalibrationRecord | undefined;
  avg: number | null;
  isFinalPublished: boolean;
  canFinalize: boolean;
  publishIntents: Record<number, PublishIntent>;
  setPublishIntents: React.Dispatch<React.SetStateAction<Record<number, PublishIntent>>>;
};

export function PublishStatusCell({ c, cal, avg, isFinalPublished, canFinalize, publishIntents, setPublishIntents }: PublishStatusCellProps) {
  return (
                            <td className="px-1 py-2 text-center hidden sm:table-cell" onClick={e => e.stopPropagation()}>
                              {cal && canFinalize ? (
                                <div className="flex flex-col items-center gap-1">
                                  {/* Estado de publicação atual — badge prominente */}
                                  {isFinalPublished ? (
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span className="inline-flex items-center gap-0.5 text-[11px] font-black uppercase rounded px-1.5 py-0.5 whitespace-nowrap" style={{ backgroundColor: "rgba(154,176,0,0.18)", color: GOOD_TEXT, border: `1px solid ${GOOD}` }}>
                                        <CheckCircle size={8} /> Final pub.
                                      </span>
                                      <span className="text-[11px] leading-tight text-center" style={{ color: "var(--muted-foreground)" }}>
                                        {formatDateTime(new Date(c.finalPublishedAt!))}
                                      </span>
                                      {c.finalPublishedByUserName && (
                                        <span className="text-[11px] leading-tight text-center font-medium" style={{ color: GOOD_TEXT }}>
                                          {c.finalPublishedByUserName}
                                        </span>
                                      )}
                                    </div>
                                  ) : c.partialPublishedAt ? (
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span className="inline-flex items-center gap-0.5 text-[11px] font-black uppercase rounded px-1.5 py-0.5 whitespace-nowrap" style={{ backgroundColor: "rgba(232,162,61,0.18)", color: AMBER_TEXT, border: `1px solid ${AMBER}` }}>
                                        <CheckCircle size={8} /> Parcial pub.
                                      </span>
                                      <span className="text-[11px] leading-tight text-center" style={{ color: "var(--muted-foreground)" }}>
                                        {formatDateTime(new Date(c.partialPublishedAt))}
                                      </span>
                                      {c.partialPublishedByUserName && (
                                        <span className="text-[11px] leading-tight text-center font-medium" style={{ color: AMBER_TEXT }}>
                                          {c.partialPublishedByUserName}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 text-[11px] font-black uppercase rounded px-1.5 py-0.5 whitespace-nowrap" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                                      Não pub.
                                    </span>
                                  )}
                                  {/* Seletor de intenção: Parc. | Final */}
                                  <div className="flex items-stretch rounded overflow-hidden w-full max-w-[88px]" style={{ border: "1px solid var(--border)" }}>
                                    <button
                                      type="button"
                                      onClick={() => setPublishIntents(prev => ({ ...prev, [c.criterionId]: "partial" }))}
                                      className="flex-1 py-1 text-[11px] font-black uppercase transition-colors leading-none"
                                      style={{ backgroundColor: (publishIntents[c.criterionId] ?? "partial") === "partial" ? AMBER : "transparent", color: (publishIntents[c.criterionId] ?? "partial") === "partial" ? "#fff" : "var(--muted-foreground)" }}
                                    >
                                      Parc.
                                    </button>
                                    <span className="w-px shrink-0" style={{ backgroundColor: "var(--border)" }} />
                                    <button
                                      type="button"
                                      onClick={() => setPublishIntents(prev => ({ ...prev, [c.criterionId]: "final" }))}
                                      className="flex-1 py-1 text-[11px] font-black uppercase transition-colors leading-none"
                                      style={{ backgroundColor: (publishIntents[c.criterionId] ?? "partial") === "final" ? GOOD : "transparent", color: (publishIntents[c.criterionId] ?? "partial") === "final" ? "#fff" : "var(--muted-foreground)" }}
                                    >
                                      Final
                                    </button>
                                  </div>
                                </div>
                              ) : cal ? (
                                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold uppercase rounded px-1.5 py-0.5" style={{ backgroundColor: "rgba(154,176,0,0.14)", color: GOOD_TEXT, border: `1px solid ${GOOD}` }}>
                                  <CheckCircle size={9} /> Cal.
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold uppercase rounded px-1.5 py-0.5 whitespace-nowrap" style={{ backgroundColor: "rgba(232,162,61,0.14)", color: AMBER_TEXT, border: `1px solid ${AMBER}` }}>
                                  {avg != null ? "Pendente" : "Sem nota"}
                                </span>
                              )}
                            </td>
  );
}
