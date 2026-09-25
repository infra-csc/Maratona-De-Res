import { useState } from "react";
import { ChevronDown, ChevronRight, MapPin } from "lucide-react";
import { cn, fmtDate, fmtDateTime, fmtNum } from "@/lib/utils";
import { contrastingTextColor, scoreColor } from "./helpers";
import { CriterionDetailCard } from "./criterion-detail-card";
import type { EventSummary } from "./types";

export function EventCard({ event }: { event: EventSummary }) {
  const [open, setOpen] = useState(false);
  const visibleCriteria = event.criteriaDetails.filter(c => c.scoreUsed !== null && c.weight > 0);
  // "Avaliado" = feedbackReleased OU todos os quesitos com peso têm finalPublishedAt OU histórico.
  const allScoredAreFinal = visibleCriteria.length > 0 && (
    visibleCriteria.every(c => !!c.finalPublishedAt) ||
    !!event.isHistorical
  );
  const isAvaliadoFinal = event.feedbackReleased || allScoredAreFinal;
  // "Avaliado · Parcial" = algum critério já tem publicação parcial (mas não final total).
  const hasAnyPartial = visibleCriteria.some(c => !!c.partialPublishedAt) || !!event.partialPublishedAt;
  const isAvaliadoParcial = !isAvaliadoFinal && hasAnyPartial;
  const isEmAvaliacao = !isAvaliadoFinal && !isAvaliadoParcial && !!event.criteriaConfirmed;
  // Log do "Avaliado Final": data do feedbackReleased ou a data mais recente de finalPublishedAt.
  const avaliadoDate: string | null = isAvaliadoFinal
    ? (event.feedbackReleasedAt
        ?? ([...visibleCriteria]
            .map(c => c.finalPublishedAt)
            .filter((d): d is string => !!d)
            .sort()
            .at(-1)
            ?? null))
    : null;
  const publishLabel = isAvaliadoFinal
    ? `Avaliado · Final${avaliadoDate ? ` · ${fmtDateTime(avaliadoDate)}` : ""}`
    : isAvaliadoParcial
      ? "Avaliado · Parcial"
      : isEmAvaliacao
        ? "Em Avaliação"
        : "Aguardando";

  return (
    <div className="mb-3 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
      {/* Header do evento */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(v => !v)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen(v => !v); }}
        className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-[14px_18px] transition-colors text-left gap-4 cursor-pointer hover:brightness-95"
      >
        <div className="flex items-start gap-4 min-w-0 w-full">
          <div className="mt-1 shrink-0 p-1.5 rounded-md" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}>
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={cn(
                "text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full",
                isAvaliadoFinal
                  ? "bg-[#191c1e] text-[#ccff00]"
                  : isAvaliadoParcial
                    ? "bg-[#1a5c2e] text-[#4ade80]"
                    : isEmAvaliacao
                      ? "bg-[#506600] text-[#ccff00]"
                      : "text-muted-foreground"
              )} style={!isAvaliadoFinal && !isAvaliadoParcial && !isEmAvaliacao ? { backgroundColor: "var(--muted)" } : {}}>
                {publishLabel}
              </span>
              {!event.countsForScore && (
                <span
                  title="Participação apenas histórica/informativa — não entra na sua média nem na elegibilidade."
                  className="text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
                >
                  Não conta p/ nota
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-[13px] text-foreground">{event.eventName}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] font-bold text-muted-foreground">
              {(event.city || event.location) && (
                <span className="flex items-center gap-1"><MapPin size={11} /> {event.city ? `${event.city}${event.state ? `/${event.state}` : ""}` : event.location}</span>
              )}
              {event.startDate && <span>{fmtDate(event.startDate, { day: "2-digit", month: "2-digit", year: "numeric" })}</span>}
              <span className="px-2 py-0.5 rounded" style={{ backgroundColor: "var(--muted)" }}>Quesitos: {visibleCriteria.length}/{event.criteriaDetails.length}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0 pl-10 sm:pl-0 border-t sm:border-t-0 pt-3 sm:pt-0" style={{ borderColor: "var(--border)" }}>
          {event.eventScore > 0 && (
            <div className="flex flex-col items-end gap-1">
              {(event.conformityPenalty ?? 0) > 0 ? (
                <>
                  {/* Nota bruta riscada */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] uppercase font-bold text-muted-foreground">Nota time</span>
                    <span className="font-black text-[14px] leading-none line-through text-muted-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                      {fmtNum((event.rawTeamScore ?? event.eventScore + (event.conformityPenalty ?? 0)), 1)}
                    </span>
                  </div>
                  {/* Desconto Matriz + itens reprovados */}
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(192,57,43,0.12)", color: "var(--status-danger-text)" }}>
                      Matriz −{fmtNum((event.conformityPenalty ?? 0), 1)}
                    </span>
                    {(event.conformityFailedItems ?? []).map((item, i) => (
                      <span key={i} className="text-[11px] font-bold px-1.5 py-0.5 rounded text-right" style={{ backgroundColor: "rgba(192,57,43,0.07)", color: "var(--status-danger-text)" }}
                        title={item.comment ?? undefined}>
                        NÃO: {item.label}{item.comment ? " ⓘ" : ""}
                      </span>
                    ))}
                  </div>
                  {/* Nota final em destaque */}
                  <div className="text-right">
                    <span className="block text-[11px] uppercase font-bold text-muted-foreground mb-0.5">Nota final</span>
                    <span className="font-black text-[19px] leading-none" style={{ color: scoreColor(event.eventScore) }}>
                      {fmtNum(event.eventScore, 1)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-right">
                  <span className="block text-[11px] uppercase font-bold text-muted-foreground mb-0.5">Nota</span>
                  <span className="font-black text-[19px] leading-none" style={{ color: scoreColor(event.eventScore) }}>
                    {fmtNum(event.eventScore, 1)}
                  </span>
                </div>
              )}
              {event.projectedPlatoon && event.projectedPlatoonColor && (
                <span
                  className="text-[11px] font-black uppercase px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: event.projectedPlatoonColor, color: contrastingTextColor(event.projectedPlatoonColor) }}
                >
                  {event.projectedPlatoon}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Detalhamento dos critérios */}
      {open && (
        <div className="p-5 md:p-6 space-y-4" style={{ borderTop: "1px solid var(--border)", backgroundColor: "var(--muted)" }}>
          <h4 className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-2">Detalhamento dos Critérios</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {visibleCriteria.map(c => (
              <CriterionDetailCard key={c.criterionId} event={event} c={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
