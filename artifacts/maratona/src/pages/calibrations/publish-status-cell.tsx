// Publicação de um critério: o que está PUBLICADO (o que vale para o
// colaborador e na nota oficial), se a calibração SALVA ainda falta publicar e
// o seletor "Publicar como" Parcial/Final (só vale ao clicar em Publicar).
// Regra do dono (02/10/2026): salvar é calibrar; só PUBLICAR faz valer.
import type React from "react";
import { CheckCircle2, Clock, EyeOff } from "lucide-react";
import { cn, fmtNum } from "@/lib/utils";
import { Chip, Eyebrow } from "../evaluations/ui";
import { Segmented } from "./cal-ui";
import { formatDateTime } from "./helpers";
import type { CalibrationRecord } from "./derive";
import type { EventCriterion, PublishIntent } from "./types";

export type PublishStatusCellProps = {
  c: EventCriterion;
  cal: CalibrationRecord | undefined;
  avg: number | null;
  isFinalPublished: boolean;
  canFinalize: boolean;
  publishIntents: Record<number, PublishIntent>;
  setPublishIntents: React.Dispatch<React.SetStateAction<Record<number, PublishIntent>>>;
};

const score = (v: number | string | null | undefined) => (v == null ? "—" : fmtNum(Number(v), 2));

export function PublishStatusCell({ c, cal, avg, isFinalPublished, canFinalize, publishIntents, setPublishIntents }: PublishStatusCellProps) {
  const intent = publishIntents[c.criterionId] ?? "partial";
  return (
    <section aria-label="Publicação" className="mt-4 pt-4 border-t border-border">
      <Eyebrow as="p" className="mb-2.5">Publicação</Eyebrow>
      {cal ? (
        <div className="space-y-2.5">
          <PublishedBlock c={c} isFinalPublished={isFinalPublished} />
          {cal.pendingPublish && <PendingBlock cal={cal} c={c} />}
          {canFinalize && (
            <div className="flex items-center gap-2.5">
              <span className="font-condensed shrink-0 text-[12px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Publicar como</span>
              <Segmented
                label="Publicar como"
                size="sm"
                className="flex-1"
                value={intent}
                onChange={v => setPublishIntents(prev => ({ ...prev, [c.criterionId]: v }))}
                options={[
                  { value: "partial", label: "Parcial", title: "Publicar como parcial — só vale ao clicar em Publicar (Salvar não publica)" },
                  { value: "final", label: "Final", title: "Publicar como final — só vale ao clicar em Publicar (Salvar não publica)", activeCls: "bg-primary text-primary-foreground shadow-sm" },
                ]}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border px-3 py-2.5">
          <Chip tone="warn">{avg != null ? "Sem calibração" : "Sem nota"}</Chip>
          <p className="text-[12.5px] leading-snug text-muted-foreground mt-1.5">
            {avg != null ? "Salve uma nota calibrada para poder publicar." : "Nenhuma área respondeu. Dá para calibrar mesmo assim."}
          </p>
        </div>
      )}
    </section>
  );
}

/** O que está PUBLICADO: é o que o colaborador vê e o que vale na nota. */
function PublishedBlock({ c, isFinalPublished }: { c: EventCriterion; isFinalPublished: boolean }) {
  const at = isFinalPublished ? c.finalPublishedAt : c.partialPublishedAt;
  const by = isFinalPublished ? c.finalPublishedByUserName : c.partialPublishedByUserName;
  if (!at) {
    return (
      <div data-testid={`status-published-${c.criterionId}`} className="flex items-start gap-2.5">
        <span className="mt-0.5 w-7 h-7 shrink-0 rounded-full bg-secondary text-muted-foreground flex items-center justify-center"><EyeOff size={14} aria-hidden /></span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-foreground leading-tight">Não publicado</p>
          <p className="text-[12.5px] text-muted-foreground leading-snug">O colaborador ainda não vê.</p>
        </div>
      </div>
    );
  }
  return (
    <div data-testid={`status-published-${c.criterionId}`} className="flex items-start gap-2.5">
      <span className={cn("mt-0.5 w-7 h-7 shrink-0 rounded-full flex items-center justify-center",
        isFinalPublished ? "bg-[var(--status-ok-bg)] text-[var(--status-ok-text)]" : "bg-[var(--status-warn-bg)] text-[var(--status-warn-text)]")}>
        <CheckCircle2 size={14} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline justify-between gap-2">
          <span className="text-[14px] font-semibold text-foreground leading-tight">{isFinalPublished ? "Publicado final" : "Publicado parcial"}</span>
          {c.publishedScore != null && <span className="font-condensed text-[18px] font-black tabular-nums text-foreground leading-none">{score(c.publishedScore)}</span>}
        </p>
        <p className="text-[12.5px] text-muted-foreground leading-snug">
          {formatDateTime(new Date(at))}{by ? <> · por {by}</> : null}
        </p>
      </div>
    </div>
  );
}

/** Calibração SALVA depois da última publicação: ainda não vale. */
function PendingBlock({ cal, c }: { cal: CalibrationRecord; c: EventCriterion }) {
  return (
    <div data-testid="badge-criterion-pending-publish"
      className="rounded-lg bg-[var(--status-warn-bg)] px-3 py-2.5 motion-safe:animate-in motion-safe:fade-in-0 duration-200"
      title="Salva e ainda não publicada: o colaborador e a nota oficial só mudam depois de publicar">
      <p className="flex items-center justify-between gap-2">
        <span className="font-condensed inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.05em] text-[var(--status-warn-text)]">
          <Clock size={13} aria-hidden /> Falta publicar
        </span>
        <span className="font-condensed text-[18px] font-black tabular-nums text-foreground leading-none">{score(cal.calibratedScore)}</span>
      </p>
      <p className="text-[12.5px] leading-snug text-foreground/80 mt-1">
        Salva{cal.calibratedAt ? <> em {formatDateTime(new Date(cal.calibratedAt))}</> : null}. Até publicar, vale {c.publishedScore != null ? <>a publicada ({score(c.publishedScore)})</> : <>a média dos avaliadores</>}.
      </p>
    </div>
  );
}
