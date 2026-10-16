// Critérios de Avaliação (somente leitura — a gestão fica em Avaliações):
// justificativas dos avaliadores, calibração e notas importadas (históricos).
import { useState } from "react";
import { Target } from "lucide-react";
import { AudioPlayer } from "@/components/audio-recorder";
import { cn, fmtNum, plural } from "@/lib/utils";
import { fmt, justificationsFor } from "./helpers";
import { Chip, Eyebrow, FOCUS_RING, Section } from "./detail-ui";
import type { Evaluation, EventTeamCriterion, ImportedCriterionScore } from "./types";
import { displayCriterionName, isCriterionCopyName } from "@/lib/criterion-name";

/**
 * Critério multiárea: a cópia por área ("Prazo (2)", peso 0) fica DENTRO do
 * critério de origem — uma linha por critério, com a resposta de cada área e a
 * média das áreas (antes eram 20 linhas, 15 com "Peso 0,0").
 */
function groupMultiArea(details: EventTeamCriterion[]) {
  const origins = details.filter(c => !(isCriterionCopyName(c.criterionName) && !(c.weight > 0)
    && details.some(o => o.weight > 0 && displayCriterionName(o.criterionName) === displayCriterionName(c.criterionName) && !isCriterionCopyName(o.criterionName))));
  const originIds = new Set(origins.map(o => o.criterionId));
  return origins.map(o => ({
    origin: o,
    members: [o, ...details.filter(c => !originIds.has(c.criterionId) && displayCriterionName(c.criterionName) === displayCriterionName(o.criterionName))],
  }));
}

function ExpandableComment({ comment }: { comment: string }) {
  const [expanded, setExpanded] = useState(false);
  const MAX = 160;
  if (comment.length <= MAX) {
    return <p className="mt-1 text-[14px] leading-relaxed whitespace-pre-wrap break-words text-foreground">{comment}</p>;
  }
  return (
    <div className="mt-1">
      <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words text-foreground">
        {expanded ? comment : comment.slice(0, MAX) + "…"}
      </p>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        className={cn("font-condensed mt-1 min-h-11 md:min-h-0 text-[13px] font-bold uppercase tracking-[0.05em] text-foreground underline underline-offset-2 rounded-sm", FOCUS_RING)}
      >
        {expanded ? "Ver menos" : "Ver mais"}
      </button>
    </div>
  );
}

/** Nota com o rótulo pequeno em cima (Avaliador × Calibrada). */
function ScoreStat({ label, children, title, emphasis }: { label: string; children: React.ReactNode; title?: string; emphasis?: boolean }) {
  return (
    <div className={cn("min-w-[84px] rounded-xl px-3 py-2.5 text-center", emphasis ? "bg-secondary/70" : "")} title={title}>
      <Eyebrow as="span" className={cn("block text-[11.5px]", emphasis && "text-foreground")}>{label}</Eyebrow>
      <span className="mt-1.5 block">{children}</span>
    </div>
  );
}

export type CriteriaSectionProps = {
  criteriaDetails: EventTeamCriterion[];
  evaluations: Evaluation[] | undefined;
  importedCriteriaMap: Map<number, ImportedCriterionScore>;
};

export function CriteriaSection({ criteriaDetails, evaluations, importedCriteriaMap }: CriteriaSectionProps) {
  const groups = groupMultiArea(criteriaDetails);
  return (
    <Section id="event-criteria" title="Critérios de avaliação" icon={Target} count={groups.length}
      description="Leitura do que cada área respondeu e da calibração. Critérios e avaliadores se ajustam em Avaliações.">
      <ul className="divide-y divide-border">
        {groups.map(({ origin: c, members }) => {
          const calibrated = c.calibratedScore != null;
          const multi = members.length > 1;
          // Uma área: as justificativas dela. Multiárea: as de cada área, com o nome da área.
          const justifications = members.flatMap(m => justificationsFor(evaluations, m.criterionId).map(j => ({ ...j, area: multi ? m.responsibleAreaLabel ?? null : null })));
          const pendingAreas = multi ? members.filter(m => justificationsFor(evaluations, m.criterionId).length === 0).map(m => m.responsibleAreaLabel ?? "Sem área") : [];
          const memberAvgs = members.map(m => m.averageScore).filter((v): v is number => v != null);
          const evaluatorAvg = multi ? (memberAvgs.length > 0 ? memberAvgs.reduce((a, b) => a + b, 0) / memberAvgs.length : null) : c.averageScore ?? null;
          const imp = !calibrated ? importedCriteriaMap.get(c.criterionId) : undefined;
          return (
            <li key={c.criterionId} data-testid={`row-criterion-detail-${c.criterionId}`} className="px-4 sm:px-5 py-4 flex flex-col md:flex-row md:items-start gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-condensed text-[18px] font-black uppercase leading-tight tracking-[-0.005em] text-foreground">{displayCriterionName(c.criterionName)}</h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {multi ? (
                    <Chip title={members.map(m => m.responsibleAreaLabel).filter(Boolean).join(", ")}>{plural(members.length, "área", "áreas")} · média das áreas</Chip>
                  ) : c.responsibleAreaLabel ? <Chip>{c.responsibleAreaLabel}</Chip> : null}
                  <span className="font-condensed text-[13px] font-bold uppercase tracking-[0.05em] text-muted-foreground">Peso {fmt(c.weight)}</span>
                </div>

                {justifications.length > 0 && (
                  <ul className="mt-3 space-y-2" data-testid={`justifications-${c.criterionId}`}>
                    {justifications.map((j, i) => (
                      <li key={i} className="rounded-xl border-l-[3px] border-border bg-secondary/45 px-3.5 py-2.5">
                        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px] text-muted-foreground">
                          {j.area && <span className="font-condensed text-[12.5px] font-bold uppercase tracking-[0.05em] text-foreground">{j.area}</span>}
                          <span>por <b className="font-semibold text-foreground">{j.name}</b></span>
                          <span className="ml-auto font-condensed text-[17px] font-black tabular-nums text-foreground">{fmtNum(j.score, 1)}</span>
                        </p>
                        {j.comment ? <ExpandableComment comment={j.comment} /> : null}
                        {j.audioUrl && <div className="mt-2"><AudioPlayer objectPath={j.audioUrl} /></div>}
                      </li>
                    ))}
                  </ul>
                )}
                {pendingAreas.length > 0 && (
                  <p className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
                    <span>Sem resposta ainda:</span>
                    {pendingAreas.map(a => <Chip key={a} tone="warn">{a}</Chip>)}
                  </p>
                )}
                {calibrated && c.calibrationReason && (
                  <div className="mt-3 rounded-xl bg-[var(--status-ok-bg)] px-3.5 py-2.5">
                    <Eyebrow as="p" className="text-[var(--status-ok-text)]">Motivo da calibração</Eyebrow>
                    <p className="mt-1 text-[14px] leading-relaxed text-foreground whitespace-pre-wrap">{c.calibrationReason}</p>
                  </div>
                )}
                {imp?.comment && (
                  <div className="mt-3 rounded-xl bg-secondary/60 px-3.5 py-2.5 text-[14px] leading-relaxed text-foreground">{imp.comment}</div>
                )}
              </div>
              <div className="flex gap-2 shrink-0 md:pt-0.5">
                <ScoreStat label="Avaliador" title={multi ? "Média das áreas que responderam" : undefined}>
                  <span className={cn("font-condensed text-[24px] font-black leading-none tabular-nums", evaluatorAvg != null ? "text-foreground" : "text-muted-foreground/60")}>{evaluatorAvg != null ? fmt(evaluatorAvg) : "—"}</span>
                </ScoreStat>
                <ScoreStat label="Calibrada" emphasis>
                  {calibrated ? (
                    <span className="font-condensed text-[24px] font-black leading-none tabular-nums text-[var(--status-ok-text)]">{fmt(c.calibratedScore as number)}</span>
                  ) : imp && !imp.excluded ? (
                    <span className="font-condensed text-[24px] font-black leading-none tabular-nums text-[var(--status-warn-text)]" title="Nota importada da planilha">{fmt(imp.score)}</span>
                  ) : (
                    <span className={cn("font-condensed font-bold uppercase leading-none", imp?.excluded ? "text-[13px] text-muted-foreground" : "text-[24px] text-muted-foreground/60")}>{imp?.excluded ? "Não avaliado" : "—"}</span>
                  )}
                </ScoreStat>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
