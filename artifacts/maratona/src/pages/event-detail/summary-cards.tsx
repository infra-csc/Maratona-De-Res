// Cards de indicadores do topo: nota do evento, participantes, critérios
// avaliados e itens não conformes da Matriz.
import { CONDENSED, WARNING } from "@/lib/premium-theme";
import { CONFORMITY_ITEMS, fmt } from "./helpers";
import type { ConformityForm, EventDetail, EventTeamResult } from "./types";

export type SummaryCardsProps = {
  event: EventDetail;
  result: EventTeamResult | undefined;
  conformityForm: ConformityForm;
  activeCriteriaCount: number;
};

export function SummaryCards({ event, result, conformityForm, activeCriteriaCount }: SummaryCardsProps) {
  const displayScore = result && result.eventScore > 0
    ? (result.conformityScore != null ? result.conformityScore : result.eventScore) as number
    : null;
  const nonConformCount = CONFORMITY_ITEMS.filter(i => conformityForm[i.key] === false).length;
  const matrixAnswered = CONFORMITY_ITEMS.filter(i => conformityForm[i.key] !== null).length;
  const evaluatedCount = result?.evaluatedCriteria ?? 0;
  const criteriaTotal = result?.totalCriteria ?? activeCriteriaCount;
  const criteriaTooltip = `${evaluatedCount} de ${criteriaTotal} critérios com avaliação completa · Matriz ${matrixAnswered}/${CONFORMITY_ITEMS.length}`;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="font-black text-2xl leading-none" style={{ fontFamily: CONDENSED, color: displayScore != null ? "var(--accent)" : "var(--muted-foreground)" }}>{displayScore != null ? fmt(displayScore) : "—"}</div>
        <div className="text-[11px] font-bold uppercase tracking-wide mt-1.5" style={{ color: "var(--muted-foreground)" }}>Nota do Evento</div>
      </div>
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="font-black text-2xl leading-none" style={{ fontFamily: CONDENSED }}>{event.participants?.filter(p => p.countsForScore !== false).length ?? 0}</div>
        <div className="text-[11px] font-bold uppercase tracking-wide mt-1.5" style={{ color: "var(--muted-foreground)" }}>Participantes</div>
      </div>
      <div className="rounded-xl p-4" title={criteriaTooltip} style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="font-black text-2xl leading-none" style={{ fontFamily: CONDENSED }}>{evaluatedCount}/{criteriaTotal}</div>
        <div className="text-[11px] font-bold uppercase tracking-wide mt-1.5" style={{ color: "var(--muted-foreground)" }}>Critérios Avaliados</div>
      </div>
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="font-black text-2xl leading-none" style={{ fontFamily: CONDENSED, color: nonConformCount > 0 ? WARNING : "var(--foreground)" }}>{nonConformCount}</div>
        <div className="text-[11px] font-bold uppercase tracking-wide mt-1.5" style={{ color: "var(--muted-foreground)" }}>Itens Não Conformes</div>
      </div>
    </div>
  );
}
