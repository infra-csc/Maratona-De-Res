import type { PublicEvalCriterion } from "@workspace/api-client-react";
import { CONDENSED, WARNING, DANGER_TEXT } from "@/lib/premium-theme";
import { Card } from "./ui";
import { scoreLabels } from "./helpers";
import type { CriterionAnswer } from "./types";

/** Um critério: escala 0–10 (rótulo só nas pontas) + comentário obrigatório. */
export function CriterionCard({ c, ans, setScore, setComments }: {
  c: PublicEvalCriterion;
  ans: CriterionAnswer | undefined;
  setScore: (criterionId: number, score: number) => void;
  setComments: (criterionId: number, comments: string) => void;
}) {
  const selectedScore = ans?.score ?? null;
  const comment = ans?.comments ?? "";
  const commentMissing = selectedScore !== null && comment.trim().length === 0;
  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4" style={{ backgroundColor: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
        <p className="text-[11px] font-bold tracking-[0.15em] uppercase mb-0.5" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Critério</p>
        <p className="font-black uppercase text-lg" style={{ fontFamily: CONDENSED }}>{c.criterionName}</p>
        {c.criterionDescription && (
          <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{c.criterionDescription}</p>
        )}
      </div>
      <div className="p-5 space-y-4">
        {/* Score picker: 0-10, rótulo só nas pontas */}
        <div>
          <p className="text-[11px] font-bold tracking-[0.15em] uppercase mb-3" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>
            Nota <span style={{ color: DANGER_TEXT }}>*</span>
            {selectedScore !== null && scoreLabels[selectedScore] && (
              <span className="ml-2 normal-case font-semibold" style={{ color: "var(--accent-text)" }}>— {scoreLabels[selectedScore]}</span>
            )}
          </p>
          <div className="flex gap-1" id={`crit-${c.criterionId}-score`} role="group" aria-label={`Nota do critério ${c.criterionName}`}>
            {[0,1,2,3,4,5,6,7,8,9,10].map((s) => (
              <button
                key={s}
                type="button"
                aria-label={`Nota ${s}`}
                aria-pressed={selectedScore === s}
                onClick={() => setScore(c.criterionId, s)}
                className="flex-1 rounded-lg min-h-10 py-2.5 text-sm font-black transition-all"
                style={{
                  fontFamily: CONDENSED,
                  backgroundColor: selectedScore === s ? "var(--primary)" : "transparent",
                  color: selectedScore === s ? "var(--primary-foreground)" : "var(--muted-foreground)",
                  border: selectedScore === s ? "1px solid var(--primary)" : "1px solid var(--border)",
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[11px] font-medium max-w-[120px] leading-tight" style={{ color: "var(--muted-foreground)" }}>{scoreLabels[0]}</span>
            <span className="text-[11px] font-medium max-w-[120px] text-right leading-tight" style={{ color: "var(--muted-foreground)" }}>{scoreLabels[10]}</span>
          </div>
        </div>

        {/* Comentário SEMPRE obrigatório */}
        <div>
          <label className="block text-[11px] font-bold tracking-[0.15em] uppercase mb-1.5" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>
            Comentário <span style={{ color: DANGER_TEXT }}>*</span>
            <span className="ml-1 text-[11px] font-medium normal-case" style={{ color: "var(--muted-foreground)" }}>(obrigatório)</span>
          </label>
          <textarea
            id={`crit-${c.criterionId}-comment`}
            rows={3}
            value={comment}
            onChange={e => setComments(c.criterionId, e.target.value)}
            placeholder="Descreva o desempenho observado..."
            className="w-full rounded-lg px-4 py-2.5 text-sm outline-none resize-none transition-all"
            style={{
              backgroundColor: "var(--secondary)",
              color: "var(--foreground)",
              border: commentMissing ? `1px solid ${WARNING}` : "1px solid var(--border)",
            }}
          />
          {commentMissing && (
            <p className="text-[11px] font-bold mt-1" style={{ color: DANGER_TEXT }}>Preencha o comentário antes de enviar.</p>
          )}
        </div>
      </div>
    </Card>
  );
}
