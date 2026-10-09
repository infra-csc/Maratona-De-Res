// Placar do evento (pé do cartão do topo): nota do evento, equipe, critérios
// avaliados e itens não conformes da Matriz. O operador não vê nota nem a
// Matriz: essas células saem para ele.
import type { ReactNode } from "react";
import { cn, plural } from "@/lib/utils";
import { conformityItemsFor, fmt } from "./helpers";
import { Eyebrow } from "./detail-ui";
import type { AreaResponseCount } from "../events/criteria-rules";
import type { ConformityForm, EventDetail, EventTeamResult } from "./types";

export type SummaryCardsProps = {
  event: EventDetail;
  result: EventTeamResult | undefined;
  conformityForm: ConformityForm;
  activeCriteriaCount: number;
  /** Admin/RH/diretoria: nota do evento e progresso das avaliações. */
  canViewResult?: boolean;
  /** Matriz de Conformidade visível (não para o operador). */
  showMatrix?: boolean;
  /** Ciclo por área: respostas por área (a mesma conta da lista e da Central). */
  areaCounts?: AreaResponseCount | null;
};

type Tone = "neutral" | "ok" | "warn" | "danger";
const VALUE: Record<Tone, string> = {
  neutral: "text-foreground",
  ok: "text-[var(--status-ok-text)]",
  warn: "text-[var(--status-warn-text)]",
  danger: "text-[var(--status-danger-text)]",
};

function Cell({ label, value, unit, sub, tone = "neutral", testId, title, highlight }: {
  label: ReactNode; value: ReactNode; unit?: ReactNode; sub: ReactNode; tone?: Tone; testId?: string; title?: string; highlight?: boolean;
}) {
  return (
    <div data-testid={testId} title={title} className={cn("min-w-0 bg-card px-4 py-3.5 sm:px-6 sm:py-4", highlight && "bg-secondary/50")}>
      <Eyebrow as="div" className={cn(highlight && "text-foreground")}>{label}</Eyebrow>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={cn("font-condensed text-[28px] lg:text-[34px] font-black leading-none tracking-[-0.02em] tabular-nums", VALUE[tone])}>{value}</span>
        {unit && <span className="font-condensed text-[15px] font-bold text-muted-foreground">{unit}</span>}
      </div>
      <p className="mt-1.5 text-[12.5px] leading-snug text-muted-foreground">{sub}</p>
    </div>
  );
}

export function SummaryCards({ event, result, conformityForm, activeCriteriaCount, canViewResult = true, showMatrix = true, areaCounts = null }: SummaryCardsProps) {
  const displayScore = result && result.eventScore > 0
    ? (result.conformityScore != null ? result.conformityScore : result.eventScore) as number
    : null;
  const items = conformityItemsFor(event);
  const nonConformCount = items.filter(i => conformityForm[i.key] === false).length;
  const matrixAnswered = items.filter(i => conformityForm[i.key] !== null).length;
  const evaluatedCount = result?.evaluatedCriteria ?? 0;
  const criteriaTotal = result?.totalCriteria ?? activeCriteriaCount;
  const criteriaTooltip = `${evaluatedCount} de ${criteriaTotal} critérios com avaliação completa · Matriz ${matrixAnswered}/${items.length}`;
  const participants = event.participants?.filter(p => p.countsForScore !== false).length ?? 0;
  const inactive = event.participants?.filter(p => p.confirmed === false).length ?? 0;

  const cells: ReactNode[] = [];
  if (canViewResult) {
    cells.push(
      <Cell key="score" highlight testId="event-summary-score" label="Nota do evento"
        value={displayScore != null ? fmt(displayScore) : <span className="text-muted-foreground">—</span>}
        unit={displayScore != null ? "/100" : undefined}
        tone={displayScore != null ? "ok" : "neutral"}
        sub={displayScore != null
          ? (result?.conformityScore != null ? "Já com o desconto da Matriz de Conformidade." : "Média ponderada dos critérios.")
          : "Sem nota ainda neste evento."} />,
    );
  }
  cells.push(
    <Cell key="team" testId="event-summary-team" label="Participantes" value={participants}
      sub={inactive > 0 ? `${plural(inactive, "inativo", "inativos")} (não compareceu).` : "Contam na nota e na elegibilidade."} />,
  );
  if (canViewResult) {
    cells.push(
      areaCounts && areaCounts.total > 0 ? (
        <Cell key="crit" testId="event-summary-criteria" label="Respostas das áreas" title={criteriaTooltip}
          value={`${areaCounts.done}/${areaCounts.total}`} tone={areaCounts.done === areaCounts.total ? "ok" : "neutral"}
          sub={`Critérios de origem: ${evaluatedCount}/${criteriaTotal} completos.`} />
      ) : (
        <Cell key="crit" testId="event-summary-criteria" label="Critérios avaliados" title={criteriaTooltip}
          value={`${evaluatedCount}/${criteriaTotal}`} tone={criteriaTotal > 0 && evaluatedCount === criteriaTotal ? "ok" : "neutral"}
          sub="Com avaliação enviada ou publicada." />
      ),
    );
  } else {
    cells.push(
      <Cell key="crit" testId="event-summary-criteria" label="Critérios" value={activeCriteriaCount}
        sub="Ativos neste evento. O andamento fica em Avaliações." />,
    );
  }
  if (showMatrix) {
    cells.push(
      <Cell key="matrix" testId="event-summary-matrix" label="Itens não conformes" value={nonConformCount}
        tone={nonConformCount > 0 ? "danger" : "neutral"}
        sub={`Matriz ${matrixAnswered}/${items.length} respondida${nonConformCount > 0 ? " · −10 pts por item" : ""}.`} />,
    );
  }
  const cols = cells.length >= 4 ? "lg:grid-cols-4" : cells.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2";
  return (
    <div aria-label="Placar do evento" role="group" className={cn("border-t border-border grid grid-cols-2 gap-px bg-border", cols)}>
      {cells}
    </div>
  );
}
