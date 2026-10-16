// Um evento do histórico: situação da avaliação, local e data, a nota (com o
// desconto da Matriz de conformidade, quando houve) e a faixa daquele evento.
// Toque para abrir: os itens da Matriz não cumpridos e cada critério.
import { useId, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Clock, Hourglass, MapPin, XCircle } from "lucide-react";
import { cn, fmtDate, fmtDateTime, fmtNum } from "@/lib/utils";
import { CriterionDetailCard } from "./criterion-detail-card";
import { Chip, FaixaBadge, FOCUS_RING, n1, scoreInk } from "./mp-ui";
import type { EventSummary } from "./types";

const FULL: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };

export function EventCard({ event }: { event: EventSummary }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const visibleCriteria = event.criteriaDetails.filter(c => c.scoreUsed !== null && c.weight > 0);
  // "Avaliado" = feedbackReleased OU todos os quesitos com peso têm finalPublishedAt OU histórico.
  const allScoredAreFinal = visibleCriteria.length > 0 && (
    visibleCriteria.every(c => !!c.finalPublishedAt) ||
    !!event.isHistorical
  );
  const isFinal = event.feedbackReleased || allScoredAreFinal;
  // "Parcial" = algum critério já tem publicação parcial (mas não final total).
  const hasAnyPartial = visibleCriteria.some(c => !!c.partialPublishedAt) || !!event.partialPublishedAt;
  const isPartial = !isFinal && hasAnyPartial;
  const isEvaluating = !isFinal && !isPartial && !!event.criteriaConfirmed;
  // Data do "Avaliado": feedback liberado ou a publicação final mais recente.
  const finalDate: string | null = isFinal
    ? (event.feedbackReleasedAt
        ?? ([...visibleCriteria].map(c => c.finalPublishedAt).filter((d): d is string => !!d).sort().at(-1) ?? null))
    : null;
  const penalty = event.conformityPenalty ?? 0;
  const failed = event.conformityFailedItems ?? [];
  const hasScore = event.eventScore > 0;
  const place = event.city ? `${event.city}${event.state ? `/${event.state}` : ""}` : event.location;

  return (
    <article className={cn("rounded-2xl border bg-card overflow-hidden transition-[border-color,box-shadow] duration-150", open ? "border-foreground/25 shadow-sm" : "border-border")}
      data-testid={`event-card-${event.eventId}`}>
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-controls={panelId}
        className={cn("w-full text-left px-4 py-4 sm:px-5 flex items-start gap-3 sm:gap-4 transition-colors duration-150 hover:bg-secondary/40", FOCUS_RING, "focus-visible:ring-inset focus-visible:ring-offset-0")}>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5">
            {isFinal ? <Chip tone="ok" icon={CheckCircle2}>Avaliado</Chip>
              : isPartial ? <Chip tone="info" icon={Clock}>Nota parcial</Chip>
              : isEvaluating ? <Chip tone="warn" icon={Hourglass}>Em avaliação</Chip>
              : <Chip icon={Hourglass}>Aguardando</Chip>}
            {!event.countsForScore && (
              <Chip tone="danger" title="Participação só para registro: não entra na sua média nem na meta de eventos.">Não conta para a nota</Chip>
            )}
          </p>
          <h3 className="mt-2 text-[16px] font-bold leading-snug text-foreground break-words">{event.eventName}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted-foreground">
            {place && <span className="inline-flex items-center gap-1 min-w-0"><MapPin size={12} aria-hidden className="shrink-0" /><span className="break-words">{place}</span></span>}
            {event.startDate && <span className="tabular-nums">{fmtDate(event.startDate, FULL)}</span>}
            <span className="tabular-nums">{visibleCriteria.length} de {event.criteriaDetails.length} critérios</span>
          </p>
          {finalDate && <p className="mt-1 text-[12.5px] text-muted-foreground tabular-nums">Nota final publicada em {fmtDateTime(finalDate)}</p>}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5 text-right">
          {hasScore ? (
            <>
              <span className="font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Nota</span>
              <span className={cn("font-condensed text-[32px] font-black leading-[0.85] tabular-nums", scoreInk(event.eventScore))}>{n1(event.eventScore)}</span>
              {penalty > 0 && <Chip tone="danger" icon={AlertTriangle} title="Desconto da Matriz de conformidade">Matriz −{fmtNum(penalty, 1)}</Chip>}
              {event.projectedPlatoon && <FaixaBadge name={event.projectedPlatoon} color={event.projectedPlatoonColor} size="sm" />}
            </>
          ) : (
            <span className="text-[13px] font-semibold text-muted-foreground">Sem nota ainda</span>
          )}
          <ChevronDown size={18} aria-hidden className={cn("mt-1 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div id={panelId} className="border-t border-border bg-secondary/40 px-4 py-4 sm:px-5 space-y-4 motion-safe:animate-in motion-safe:fade-in-0 duration-200">
          {hasScore && penalty > 0 && (
            <div className="rounded-xl border border-[var(--status-danger)]/30 bg-card p-4" data-testid={`my-conformity-${event.eventId}`}>
              <p className="font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--status-danger-text)]">Matriz de conformidade</p>
              <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[14px] text-foreground tabular-nums">
                <span>Nota da equipe <strong className="font-condensed text-[18px] font-black">{n1(event.rawTeamScore ?? event.eventScore + penalty)}</strong></span>
                <span className="text-muted-foreground">−</span>
                <span>desconto <strong className="font-condensed text-[18px] font-black text-[var(--status-danger-text)]">{fmtNum(penalty, 1)}</strong></span>
                <span className="text-muted-foreground">=</span>
                <span>sua nota <strong className="font-condensed text-[18px] font-black">{n1(event.eventScore)}</strong></span>
              </p>
              {failed.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {failed.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13.5px] leading-snug">
                      <XCircle size={15} aria-hidden className="mt-0.5 shrink-0 text-[var(--status-danger-text)]" />
                      <span className="min-w-0">
                        <span className="font-semibold text-foreground">Não cumprido: {item.label}</span>
                        {item.comment && <span className="block mt-0.5 text-muted-foreground break-words">“{item.comment}”</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {visibleCriteria.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {visibleCriteria.map(c => <CriterionDetailCard key={c.criterionId} event={event} c={c} />)}
            </div>
          ) : (
            <p className="text-[13.5px] text-muted-foreground">As notas dos critérios aparecem aqui assim que forem publicadas.</p>
          )}
        </div>
      )}
    </article>
  );
}
