// Critérios de Avaliação (somente leitura — a gestão fica em Avaliações):
// justificativas dos avaliadores, calibração e notas importadas (históricos).
import { useState } from "react";
import { AudioPlayer } from "@/components/audio-recorder";
import { fmtNum } from "@/lib/utils";
import { CONDENSED, AMBER_TEXT } from "@/lib/premium-theme";
import { fmt, justificationsFor } from "./helpers";
import type { Evaluation, EventTeamCriterion, ImportedCriterionScore } from "./types";

function ExpandableComment({ comment }: { comment: string }) {
  const [expanded, setExpanded] = useState(false);
  const MAX = 120;
  if (comment.length <= MAX) {
    return <p className="text-[11px] leading-snug whitespace-pre-wrap break-words mt-0.5">{comment}</p>;
  }
  return (
    <div className="mt-0.5">
      <p className="text-[11px] leading-snug whitespace-pre-wrap break-words">
        {expanded ? comment : comment.slice(0, MAX) + "…"}
      </p>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="text-[11px] font-bold uppercase mt-0.5 hover:underline"
        style={{ color: "var(--accent-text)" }}
      >
        {expanded ? "Ver menos" : "Ver mais"}
      </button>
    </div>
  );
}

export type CriteriaSectionProps = {
  criteriaDetails: EventTeamCriterion[];
  evaluations: Evaluation[] | undefined;
  importedCriteriaMap: Map<number, ImportedCriterionScore>;
};

export function CriteriaSection({ criteriaDetails, evaluations, importedCriteriaMap }: CriteriaSectionProps) {
  return (
    <section className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="font-black uppercase tracking-tight text-xs" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>Critérios de Avaliação</span>
      </div>
      <div className="flex flex-col">
        {criteriaDetails.map(c => {
          const calibrated = c.calibratedScore != null;
          const justifications = justificationsFor(evaluations, c.criterionId);
          const imp = !calibrated ? importedCriteriaMap.get(c.criterionId) : undefined;
          return (
            <div key={c.criterionId} data-testid={`row-criterion-detail-${c.criterionId}`} className="px-5 py-3.5 flex justify-between items-start gap-4 flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold uppercase text-sm">{c.criterionName}</span>
                  {c.responsibleAreaLabel && (
                    <span className="text-[11px] font-bold uppercase rounded px-2 py-0.5" style={{ color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>{c.responsibleAreaLabel}</span>
                  )}
                  <span className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Peso {fmt(c.weight)}</span>
                </div>
                {justifications.length > 0 && (
                  <div className="mt-2 space-y-1.5" data-testid={`justifications-${c.criterionId}`}>
                    {justifications.map((j, i) => (
                      <div key={i} className="rounded-lg px-3 py-2" style={{ backgroundColor: "var(--secondary)" }}>
                        <p className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Avaliado por <span style={{ color: "var(--foreground)" }}>{j.name}</span> — {fmtNum(j.score, 1)}</p>
                        {j.comment ? <ExpandableComment comment={j.comment} /> : null}
                        {j.audioUrl && <div className="mt-1.5"><AudioPlayer objectPath={j.audioUrl} /></div>}
                      </div>
                    ))}
                  </div>
                )}
                {calibrated && c.calibrationReason && (
                  <>
                    <p className="mt-2 text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Calibração</p>
                    <div className="mt-1 rounded-lg px-3 py-2 text-[12px]" style={{ backgroundColor: "rgba(154,176,0,0.10)", border: "1px solid rgba(154,176,0,0.25)" }}>{c.calibrationReason}</div>
                  </>
                )}
                {imp?.comment && (
                  <div className="mt-1 rounded-lg px-3 py-2 text-[12px]" style={{ backgroundColor: "var(--secondary)" }}>{imp.comment}</div>
                )}
              </div>
              <div className="flex gap-6 items-center shrink-0">
                <div className="text-center">
                  <span className="block text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Avaliador</span>
                  <span className="font-black text-base" style={{ fontFamily: CONDENSED }}>{c.averageScore != null ? fmt(c.averageScore) : "—"}</span>
                </div>
                <div className="text-center">
                  <span className="block text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Calibrada</span>
                  {calibrated ? (
                    <span className="font-black text-lg" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>{fmt(c.calibratedScore as number)}</span>
                  ) : imp && !imp.excluded ? (
                    <span className="font-black text-lg" style={{ fontFamily: CONDENSED, color: AMBER_TEXT }}>{fmt(imp.score)}</span>
                  ) : (
                    <span className="text-sm font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>{imp?.excluded ? "Não avaliado" : "—"}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
