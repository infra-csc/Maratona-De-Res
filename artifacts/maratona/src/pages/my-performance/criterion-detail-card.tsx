import type { MyPerformanceCriterion } from "@workspace/api-client-react";
import { CheckCircle2 } from "lucide-react";
import { fmtDateTime, fmtNum } from "@/lib/utils";
import { INFO } from "@/lib/premium-theme";
import { scoreColor, scoreBarColor } from "./helpers";
import type { EventSummary } from "./types";

/** Cartão de um quesito no detalhamento aberto do EventCard. */
export function CriterionDetailCard({ event, c }: { event: EventSummary; c: MyPerformanceCriterion }) {
  return (
    <div className="p-4 rounded-xl relative overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex justify-between items-start gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[11px] font-bold uppercase text-muted-foreground px-2 py-0.5 rounded" style={{ backgroundColor: "var(--muted)" }}>Peso {c.weight}</span>
            {event.feedbackReleased || c.finalPublishedAt ? (
              <span
                title={c.finalPublishedAt ? `Avaliado em ${fmtDateTime(c.finalPublishedAt)}` : event.feedbackReleasedAt ? `Avaliado em ${fmtDateTime(event.feedbackReleasedAt)}` : undefined}
                className="text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-[#191c1e] text-[#ccff00] flex items-center gap-1"
              >
                <CheckCircle2 size={11}/> Avaliado{c.finalPublishedAt ? ` · ${fmtDateTime(c.finalPublishedAt)}` : ""}
              </span>
            ) : c.partialPublishedAt ? (
              <span
                title={`Publicação parcial em ${fmtDateTime(c.partialPublishedAt)}`}
                className="text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-[#ccff00] text-[#191c1e]"
              >
                Projeção Parcial
              </span>
            ) : null}
          </div>
          <p className="font-bold text-[13px] text-foreground leading-tight">{c.criterionName}</p>
        </div>

        <div className="text-right shrink-0 flex flex-col items-end gap-1">
          {c.scoreUsed !== null ? (
            <div className="flex items-end gap-1">
              <span className="font-black text-2xl leading-none" style={{ color: scoreColor(c.scoreUsed * 10) }}>{fmtNum(c.scoreUsed, 1)}</span>
              <span className="text-xs font-bold text-muted-foreground pb-1">/10</span>
            </div>
          ) : (
            <span className="text-[11px] font-bold uppercase px-2 py-1 rounded text-muted-foreground" style={{ backgroundColor: "var(--muted)" }}>Pendente</span>
          )}
        </div>
      </div>
      {c.scoreUsed !== null && (
        <div className="h-[4px] rounded-full overflow-hidden mb-3" style={{ backgroundColor: "var(--muted)" }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(c.scoreUsed / 10) * 100}%`, backgroundColor: scoreBarColor(c.scoreUsed * 10) }} />
        </div>
      )}

      {c.publicComments.length > 0 && (
        <div className="mt-4 space-y-2 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-[11px] font-black uppercase text-muted-foreground">Feedbacks da equipe avaliadora</p>
          {c.publicComments.map((comment, i) => (
            <div key={i} className="text-xs text-foreground p-3 rounded border-l-2 border-[var(--accent)]" style={{ backgroundColor: "var(--muted)" }}>
              <span className="italic leading-relaxed">"{comment}"</span>
            </div>
          ))}
        </div>
      )}
      {c.calibrationReason && (
        <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-[11px] font-black uppercase text-muted-foreground mb-2">Comentário de calibração</p>
          <div className="text-xs text-foreground p-3 rounded border-l-2" style={{ backgroundColor: "var(--muted)", borderLeftColor: INFO }}>
            <span className="italic leading-relaxed">"{c.calibrationReason}"</span>
          </div>
        </div>
      )}
    </div>
  );
}
