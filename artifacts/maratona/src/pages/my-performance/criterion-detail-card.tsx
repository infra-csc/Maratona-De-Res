// Um critério dentro do evento aberto: nota de 0 a 10, situação (avaliado,
// parcial ou pendente), o que a equipe escreveu e o motivo de um ajuste. Os
// nomes de quem avaliou nunca aparecem.
import type { MyPerformanceCriterion } from "@workspace/api-client-react";
import { CheckCircle2, Clock, MessageSquareQuote, SlidersHorizontal } from "lucide-react";
import { cn, fmtDateTime, fmtNum } from "@/lib/utils";
import { displayCriterionName } from "@/lib/criterion-name";
import { scoreBarColor } from "./helpers";
import { Chip, Meter, scoreInk } from "./mp-ui";
import type { EventSummary } from "./types";

export function CriterionDetailCard({ event, c }: { event: EventSummary; c: MyPerformanceCriterion }) {
  const final = event.feedbackReleased || !!c.finalPublishedAt;
  const finalAt = c.finalPublishedAt ?? event.feedbackReleasedAt ?? null;
  return (
    <div className="rounded-xl border border-border bg-card p-4 min-w-0" data-testid={`my-criterion-${event.eventId}-${c.criterionId}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14.5px] font-semibold leading-snug text-foreground break-words">{displayCriterionName(c.criterionName)}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {final ? (
              <Chip tone="ok" icon={CheckCircle2} title={finalAt ? `Nota final publicada em ${fmtDateTime(finalAt)}` : undefined}>Avaliado</Chip>
            ) : c.partialPublishedAt ? (
              <Chip tone="info" icon={Clock} title={`Nota parcial publicada em ${fmtDateTime(c.partialPublishedAt)}`}>Nota parcial</Chip>
            ) : null}
            <Chip title="Quanto este critério pesa na nota do evento">Peso {fmtNum(Number(c.weight), Number.isInteger(Number(c.weight)) ? 0 : 1)}</Chip>
          </p>
        </div>
        {c.scoreUsed !== null ? (
          <p className="shrink-0 flex items-baseline gap-1">
            <span className={cn("font-condensed text-[30px] font-black leading-none tabular-nums", scoreInk(c.scoreUsed * 10))}>{fmtNum(c.scoreUsed, 1)}</span>
            <span className="text-[12px] font-semibold text-muted-foreground">/10</span>
          </p>
        ) : (
          <Chip>Pendente</Chip>
        )}
      </div>
      {c.scoreUsed !== null && <Meter pct={(c.scoreUsed / 10) * 100} fill={scoreBarColor(c.scoreUsed * 10)} className="mt-3 h-1" />}

      {c.publicComments.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="flex items-center gap-1.5 font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            <MessageSquareQuote size={13} aria-hidden /> O que a equipe avaliadora disse
          </p>
          {c.publicComments.map((comment, i) => (
            <blockquote key={i} className="rounded-lg border-l-[3px] border-[var(--accent)] bg-secondary/70 px-3 py-2.5 text-[13.5px] leading-relaxed text-foreground break-words">
              “{comment}”
            </blockquote>
          ))}
        </div>
      )}
      {c.calibrationReason && (
        <div className="mt-4 space-y-2">
          <p className="flex items-center gap-1.5 font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            <SlidersHorizontal size={13} aria-hidden /> Por que a nota foi ajustada
          </p>
          <blockquote className="rounded-lg border-l-[3px] border-[var(--status-info)] bg-[var(--status-info-bg)] px-3 py-2.5 text-[13.5px] leading-relaxed text-foreground break-words">
            “{c.calibrationReason}”
          </blockquote>
        </div>
      )}
    </div>
  );
}
