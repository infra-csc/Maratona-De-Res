import type { PublicEvalCriterion } from "@workspace/api-client-react";
import { Check, Lock, AlertCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ScoreButton } from "../evaluations/score-button";
import { Chip, Eyebrow } from "../evaluations/ui";
import { displayCriterionName, fmtDT } from "../evaluations/helpers";
import { scoreLabels } from "./helpers";
import { fieldCls } from "./ui";
import type { CriterionAnswer } from "./types";

type MarkState = "todo" | "done" | "locked";

/** Número do critério (vira ✓ quando pronto, cadeado quando já respondido). */
function IndexMark({ n, state }: { n: number; state: MarkState }) {
  return (
    <span
      aria-hidden
      className={cn(
        "font-condensed mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[16px] font-black leading-none transition-colors duration-200",
        state === "todo" && "border border-border bg-card text-muted-foreground",
        state === "done" && "bg-primary text-primary-foreground",
        state === "locked" && "bg-secondary text-muted-foreground",
      )}
    >
      {state === "done" ? <Check size={16} strokeWidth={3} className="motion-safe:animate-in motion-safe:zoom-in-50 duration-200" /> : state === "locked" ? <Lock size={14} /> : n}
    </span>
  );
}

/** Um critério a responder: escala 0–10 da equipe + comentário obrigatório. */
export function CriterionCard({ c, n, ans, setScore, setComments, showErrors }: {
  c: PublicEvalCriterion;
  /** Posição do critério na lista do link (1, 2, 3…). */
  n: number;
  ans: CriterionAnswer | undefined;
  setScore: (criterionId: number, score: number) => void;
  setComments: (criterionId: number, comments: string) => void;
  /** Já tentou enviar: aponta o que está vazio. */
  showErrors: boolean;
}) {
  const name = displayCriterionName(c.criterionName);
  const score = ans?.score ?? null;
  const comment = ans?.comments ?? "";
  const hasComment = comment.trim().length > 0;
  const ready = score !== null && hasComment;
  // Nota escolhida sem comentário: avisa na hora. Nada escolhido: só depois de tentar enviar.
  const commentMissing = !hasComment && (score !== null || showErrors);
  const scoreMissing = showErrors && score === null;
  const titleId = `crit-${c.criterionId}-titulo`;
  const commentId = `crit-${c.criterionId}-comment`;
  const hintId = `crit-${c.criterionId}-hint`;
  const description = c.criterionDescription?.trim();

  return (
    <article id={`crit-${c.criterionId}`} aria-labelledby={titleId} className="@container px-4 py-6 sm:px-7 sm:py-7 scroll-mt-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <IndexMark n={n} state={ready ? "done" : "todo"} />
          <div className="min-w-0">
            <h2 id={titleId} className="font-condensed text-[22px] md:text-[24px] font-black uppercase leading-[1.05] tracking-[-0.01em] text-foreground break-words">
              <span className="sr-only">{n}. </span>{name}
            </h2>
            {description && <p className="mt-1.5 max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">{description}</p>}
          </div>
        </div>
        <div className="hidden shrink-0 text-right sm:block" aria-hidden>
          <Eyebrow className="whitespace-nowrap">Nota da equipe</Eyebrow>
          {score !== null ? (
            <p className="font-condensed mt-1 font-black leading-none tabular-nums text-foreground">
              <span className="text-[40px]">{score}</span><span className="text-[16px] font-bold text-muted-foreground">/10</span>
            </p>
          ) : (
            <p className="mt-2 text-[13px] font-semibold text-muted-foreground">Sem nota</p>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-6 sm:pl-11">
        {/* Escala 0–10: 11 numa linha quando cabe; no celular 6 + 5, botões de 48 px. */}
        <div data-pending-box className="-m-2 rounded-xl p-2">
          <div className="mb-2.5 flex items-end justify-between gap-3">
            <Eyebrow as="span" className={scoreMissing ? "text-[var(--status-danger-text)]" : "text-foreground"}>
              Escolha de 0 a 10{scoreMissing ? " · falta a nota" : ""}
            </Eyebrow>
            <span className="font-condensed text-[15px] font-black leading-none tabular-nums text-foreground sm:hidden" aria-hidden>
              {score !== null ? <>{score}<span className="text-[12px] font-bold text-muted-foreground">/10</span></> : <span className="text-[13px] font-semibold normal-case text-muted-foreground">Sem nota</span>}
            </span>
          </div>
          <div
            id={`crit-${c.criterionId}-score`}
            role="group"
            aria-label={`Nota do critério ${name}`}
            className="grid grid-cols-6 gap-1.5 @lg:grid-cols-11"
          >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
              <ScoreButton key={s} score={s} current={score} label={scoreLabels[s]} onClick={() => setScore(c.criterionId, s)} disabled={false} />
            ))}
          </div>
          <div className="mt-2 flex items-start justify-between gap-4 text-[12px] leading-snug text-muted-foreground">
            <span><b className="font-condensed text-[13px] font-black text-foreground">0</b> · {scoreLabels[0]}</span>
            <span className="text-right">{scoreLabels[10]} · <b className="font-condensed text-[13px] font-black text-foreground">10</b></span>
          </div>
        </div>

        {/* Comentário: SEMPRE obrigatório. */}
        <div data-pending-box className="-m-2 rounded-xl p-2">
          <label htmlFor={commentId} className="font-condensed mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-foreground">
            Comentário <span className="text-[var(--status-danger-text)]">obrigatório</span>
          </label>
          <Textarea
            id={commentId}
            rows={3}
            value={comment}
            aria-invalid={commentMissing || undefined}
            aria-describedby={hintId}
            onChange={(e) => setComments(c.criterionId, e.target.value)}
            placeholder="O que a equipe fez bem ou deixou de fazer neste critério?"
            className={cn(fieldCls, "min-h-24 resize-y px-3.5 py-3 shadow-none", commentMissing && "border-[var(--status-warn)]")}
          />
          <p id={hintId} className={cn("mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug", commentMissing ? "font-semibold text-[var(--status-warn-text)]" : "text-muted-foreground")}>
            {commentMissing
              ? <><AlertCircle size={14} aria-hidden className="mt-px shrink-0" /> Escreva o comentário — sem ele a nota não pode ser enviada.</>
              : "Conte o que você viu em campo. Uma ou duas frases bastam."}
          </p>
        </div>
      </div>
    </article>
  );
}

/** Critério que a área já respondeu (ou que é de outra área): só leitura, não é cobrado. */
export function ClosedCriterionRow({ c, n }: { c: PublicEvalCriterion; n: number }) {
  const name = displayCriterionName(c.criterionName);
  return (
    <article id={`crit-${c.criterionId}`} className="px-4 py-5 sm:px-7" data-testid={`public-closed-${c.criterionId}`}>
      <div className="flex items-start gap-3">
        <IndexMark n={n} state="locked" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h2 className="font-condensed text-[20px] font-black uppercase leading-[1.05] tracking-[-0.01em] text-muted-foreground break-words">
              <span className="sr-only">{n}. </span>{name}
            </h2>
            <Chip icon={Lock}>{c.closedReason ? "Outra área" : "Já respondido"}</Chip>
          </div>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
            {c.closedReason
              ? c.closedReason
              : <><span className="font-semibold text-foreground">{c.closedByName ? `Já respondido por ${c.closedByName}` : "Já respondido pela área"}{c.closedAt ? ` em ${fmtDT(c.closedAt)}` : ""}.</span> Não precisa responder.</>}
          </p>
        </div>
      </div>
    </article>
  );
}
