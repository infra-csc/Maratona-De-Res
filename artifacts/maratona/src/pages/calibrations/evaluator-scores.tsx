// Notas individuais dos avaliadores (com comentário expansível e atalho para
// copiar o comentário para a justificativa da calibração).
import type React from "react";
import { Clock, Copy } from "lucide-react";
import { GOOD_TEXT } from "@/lib/premium-theme";
import { formatDateTime } from "./helpers";
import type { AreaScore } from "./derive";

export type EvaluatorScoresProps = {
  criterionId: number;
  areaScores: AreaScore[];
  setCalReasons: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  expandedEvalComments: Set<string>;
  setExpandedEvalComments: React.Dispatch<React.SetStateAction<Set<string>>>;
};

export function EvaluatorScores({ criterionId, areaScores, setCalReasons, expandedEvalComments, setExpandedEvalComments }: EvaluatorScoresProps) {
  return (
    <>
                              {areaScores.map((s, i) => (
                                <div key={i} className="mt-2 pt-1.5" style={{ borderTop: "1px dashed var(--border)" }}>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[11px] font-black uppercase tracking-wider px-1 py-px" style={{ color: GOOD_TEXT, backgroundColor: "rgba(154,176,0,0.12)" }}>Avaliador</span>
                                    <span className="text-[11px] font-bold">{s.name}</span>
                                    {s.areaName && (
                                      <span className="text-[11px] font-bold uppercase px-1 py-px" style={{ color: "var(--muted-foreground)", backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>{s.areaName}</span>
                                    )}
                                    {s.respondedAt && (
                                      <span className="text-[11px] font-bold flex items-center gap-0.5" style={{ color: "var(--muted-foreground)" }} title={`Respondido em ${formatDateTime(s.respondedAt)}`}>
                                        <Clock size={8} /> {formatDateTime(s.respondedAt)}
                                      </span>
                                    )}
                                    {s.comment && (
                                      <button
                                        type="button"
                                        onClick={e => {
                                          e.stopPropagation();
                                          setCalReasons(prev => ({ ...prev, [criterionId]: s.comment }));
                                          setTimeout(() => {
                                            const el = document.querySelector(`[data-testid="input-cal-reason-inline-${criterionId}"]`) as HTMLTextAreaElement | null;
                                            if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
                                          }, 0);
                                        }}
                                        title="Copiar para justificativa da calibração"
                                        className="ml-auto h-4 w-4 flex items-center justify-center shrink-0 hover:opacity-70"
                                        style={{ color: GOOD_TEXT }}
                                      >
                                        <Copy size={9} />
                                      </button>
                                    )}
                                  </div>
                                  {s.comment && (() => {
                                    const expandKey = `${criterionId}-${i}`;
                                    const isExpanded = expandedEvalComments.has(expandKey);
                                    const isLong = s.comment.length > 140 || s.comment.split("\n").length > 3;
                                    return (
                                      <div className="mt-0.5">
                                        <p
                                          className={`text-[11px] leading-snug${!isExpanded && isLong ? " line-clamp-3" : ""}`}
                                          style={{ whiteSpace: "pre-wrap" }}
                                        >
                                          {s.comment}
                                        </p>
                                        {isLong && (
                                          <button
                                            type="button"
                                            onClick={e => {
                                              e.stopPropagation();
                                              setExpandedEvalComments(prev => {
                                                const n = new Set(prev);
                                                if (n.has(expandKey)) n.delete(expandKey); else n.add(expandKey);
                                                return n;
                                              });
                                            }}
                                            className="text-[11px] font-black uppercase mt-0.5"
                                            style={{ color: GOOD_TEXT }}
                                          >
                                            {isExpanded ? "▲ ver menos" : "▼ ver mais"}
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              ))}
    </>
  );
}
