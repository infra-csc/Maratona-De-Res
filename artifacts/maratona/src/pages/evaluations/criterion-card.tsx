import type { ReactNode } from "react";
import type { Evaluation, EventCriterion } from "@workspace/api-client-react";
import { Check, CheckCircle2, Clock, Save, CornerDownRight, Loader2, Lock, Link2, Mic, Trash2, AlertCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { AudioRecorder, AudioPlayer } from "@/components/audio-recorder";
import { cn } from "@/lib/utils";
import { SCORE_LABELS as labels } from "./constants";
import { ScoreButton } from "./score-button";
import { displayCriterionName, fmtDT } from "./helpers";
import { Chip, Eyebrow, btnSmall, btnGhost } from "./ui";
import type { CriterionAssignmentRow } from "./types";

export interface CriterionCardHandlers {
  onScoreClick: (criterionId: number, score: number) => void;
  onCommentChange: (criterionId: number, value: string) => void;
  onAudioChange: (criterionId: number, path: string | null) => void;
  onSaveDraft: (criterionId: number) => void;
  /** Descarta MEU rascunho de um critério que outra pessoa da área já fechou (a página confirma antes). */
  onDiscardDraft?: (evaluationId: number, criterionId: number) => void;
  isDiscarding?: boolean;
}

interface CriterionCardProps extends CriterionCardHandlers {
  criterion: EventCriterion;
  index: number;
  total: number;
  ev: Evaluation | undefined;
  score: number | null;
  comment: string;
  audio: string | null;
  // Registro de roteamento do critério (mostra o selo "De Fulano" quando redirecionado).
  assignment: CriterionAssignmentRow | undefined;
  /** Este critério está sendo salvo agora (rascunho). */
  isSaving: boolean;
  /** Algum rascunho está sendo salvo (trava o botão dos outros cartões). */
  anySaving?: boolean;
  // Outras áreas também respondem este critério no evento (nota = média das áreas).
  sharedWithOtherAreas?: boolean;
  // A área já respondeu por outra pessoa (primeira resposta fecha): só leitura.
  closedBy?: { name: string | null; at: string | null; viaLink: boolean; score?: number | null; comment?: string | null } | null;
  // Respondido por um freela pelo link que EU gerei (o feedback não é "meu").
  answeredByLinkName?: string | null;
}

const MAX_COMMENT = 300;

/** Número do critério dentro do título: o nome acessível continua "1. Nome". */
function IndexMark({ n, state }: { n: number; state: "todo" | "ready" | "done" | "locked" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "font-condensed relative mt-0.5 w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[16px] font-black leading-none transition-colors duration-200",
        state === "todo" && "border border-border text-muted-foreground bg-card",
        state === "ready" && "bg-accent text-accent-foreground",
        state === "done" && "bg-primary text-primary-foreground",
        state === "locked" && "bg-secondary text-muted-foreground",
      )}
    >
      {state === "done" ? <Check size={16} strokeWidth={3} /> : state === "locked" ? <Lock size={14} /> : n}
    </span>
  );
}

function CardTitle({ n, name, state, description, chips }: { n: number; name: string; state: "todo" | "ready" | "done" | "locked"; description?: string | null; chips?: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <IndexMark n={n} state={state} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h4 className="font-condensed text-[22px] md:text-[24px] font-black uppercase leading-[1.05] tracking-[-0.01em] text-foreground">
            <span className="sr-only">{n}. </span>{name}
          </h4>
          {chips}
        </div>
        {description && <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground max-w-[62ch]">{description}</p>}
      </div>
    </div>
  );
}

/** Nota grande (só leitura ou a escolhida). */
function ScoreReadout({ score, label, testId }: { score: number | null; label: string; testId?: string }) {
  return (
    <div className="shrink-0 text-right">
      <Eyebrow className="whitespace-nowrap">{label}</Eyebrow>
      {score != null ? (
        <p className="font-condensed mt-1 leading-none font-black text-foreground tabular-nums">
          <span className="text-[40px]" data-testid={testId}>{score}</span>
          <span className="text-[16px] text-muted-foreground font-bold">/10</span>
        </p>
      ) : (
        <p className="mt-2 text-[13px] font-semibold text-muted-foreground">Sem nota</p>
      )}
    </div>
  );
}

function Quote({ label, icon, children }: { label: ReactNode; icon?: ReactNode; children: ReactNode }) {
  return (
    <figure className="mt-4 border-l-2 border-border pl-4">
      <figcaption className="font-condensed flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{icon}{label}</figcaption>
      <blockquote className="mt-1 text-[15px] leading-relaxed text-foreground break-words">{children}</blockquote>
    </figure>
  );
}

// Cartão de um critério: número + estado, escala 0–10 da equipe, justificativa
// obrigatória, áudio opcional e rascunho.
export function CriterionCard({
  criterion: c, index, total, ev, score, comment, audio, assignment, isSaving, anySaving, sharedWithOtherAreas, closedBy, answeredByLinkName,
  onScoreClick, onCommentChange, onAudioChange, onSaveDraft, onDiscardDraft, isDiscarding,
}: CriterionCardProps) {
  const submitted = ev?.status === "submitted";
  const isDraft = ev?.status === "draft";
  const name = displayCriterionName(c.criterionName);
  const n = index + 1;
  void total;

  if (closedBy) {
    return (
      <article id={`crit-${c.criterionId}`} className="criterion-row scroll-mt-24" data-testid={`criterion-closed-${c.criterionId}`}>
        <div className="flex items-start justify-between gap-4">
          {/* Sem selo da área: quem avalia é a área do formulário (título acima); o selo
              "Produção" fazia o avaliador achar que avaliava a Produção (dono, 07/10). */}
          <CardTitle n={n} name={name} state="locked" chips={<Chip icon={Lock}>Já respondido</Chip>} />
          {closedBy.score != null && <ScoreReadout score={closedBy.score} label="Nota da área" testId={`closed-score-${c.criterionId}`} />}
        </div>
        <div className="pl-11">
          {closedBy.comment && <Quote label="Justificativa">“{closedBy.comment}”</Quote>}
          <p className="mt-4 text-[14px] font-semibold text-foreground">
            Respondido por {closedBy.name ?? "avaliador da área"}{closedBy.viaLink ? " (link para freela)" : ""}{closedBy.at ? ` em ${fmtDT(closedBy.at)}` : ""}
          </p>
          <p className="mt-0.5 text-[13px] text-muted-foreground leading-relaxed">
            A primeira resposta enviada fecha o critério neste evento. Se algo precisar mudar, fale com o RH.
          </p>
          {/* Sobrou um rascunho meu que não vai mais valer: dá para descartar (com confirmação). */}
          {isDraft && ev && onDiscardDraft && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--status-warn-bg)] px-4 py-3">
              <p className="text-[13px] text-[var(--status-warn-text)] font-semibold flex items-center gap-2">
                <Clock size={14} aria-hidden className="shrink-0" /> Você tinha um rascunho aqui. Ele não será usado.
              </p>
              <button
                type="button"
                data-testid={`button-discard-draft-${c.criterionId}`}
                disabled={isDiscarding}
                onClick={() => onDiscardDraft(ev.id, c.criterionId)}
                className={btnSmall}
              >
                {isDiscarding ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Trash2 size={14} aria-hidden />}
                {isDiscarding ? "Descartando..." : "Descartar rascunho"}
              </button>
            </div>
          )}
        </div>
      </article>
    );
  }

  const ready = submitted || (score != null && comment.trim().length > 0);
  const chips = (
    <>
      {/* Critério de várias áreas: a cópia da área tem peso 0 (a nota entra
          na média do critério) — o peso só aparece no critério de origem. */}
      {!c.eventScoped && !sharedWithOtherAreas && (
        Number(c.weightOverride ?? c.originalWeight ?? 0) === 0
          ? <Chip tone="danger">Peso 0 — não conta na média</Chip>
          : <Chip>Peso {c.weightOverride ?? c.originalWeight ?? 0}</Chip>
      )}
      {submitted && <Chip tone="ok" icon={CheckCircle2}>Lançado</Chip>}
      {isDraft && <Chip tone="warn" icon={Clock}>Rascunho</Chip>}
      {(() => {
        const a = assignment;
        if (!a?.redirectedFromId) return null;
        const date = a.updatedAt ? new Date(a.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : null;
        const fromFirst = a.redirectedFromName?.split(" ")[0] ?? "?";
        return (
          <Chip tone="info" icon={CornerDownRight} title={`Redirecionado de ${a.redirectedFromName ?? "?"}${date ? ` em ${date}` : ""}`}>
            De {fromFirst}{date ? ` · ${date}` : ""}
          </Chip>
        );
      })()}
    </>
  );
  const description = c.criterionDescription && c.criterionDescription.trim().length > 0
    ? c.criterionDescription
    : "Avalie o desempenho da equipe considerando este critério específico para o evento atual.";

  if (submitted) {
    return (
      <article id={`crit-${c.criterionId}`} className="criterion-row scroll-mt-24">
        <div className="flex items-start justify-between gap-4">
          <CardTitle n={n} name={name} state="done" description={description} chips={chips} />
          <ScoreReadout score={score} label="Nota da equipe" />
        </div>
        <div className="pl-11">
          {comment && (
            <Quote
              icon={answeredByLinkName ? <Link2 size={12} aria-hidden /> : undefined}
              label={answeredByLinkName ? `Feedback de ${answeredByLinkName} (link para freela)` : "Seu feedback"}
            >
              “{comment}”
            </Quote>
          )}
          {audio && (
            <div className="mt-4">
              <Eyebrow className="mb-2">Áudio da avaliação</Eyebrow>
              <AudioPlayer objectPath={audio} />
            </div>
          )}
        </div>
      </article>
    );
  }

  // Rascunho salvo e nada mudou desde então?
  const draftClean = isDraft && ev != null
    && score === Number(ev.score)
    && comment === (ev.comments ?? "")
    && (audio ?? null) === (ev.audioUrl ?? null);
  const missingComment = score != null && !comment.trim();
  const commentId = `justificativa-${c.criterionId}`;
  const hintId = `justificativa-hint-${c.criterionId}`;
  const scoreLabelId = `nota-label-${c.criterionId}`;

  return (
    <article id={`crit-${c.criterionId}`} className="criterion-row scroll-mt-24">
      <div className="flex items-start justify-between gap-4">
        <CardTitle n={n} name={name} state={ready ? "ready" : "todo"} description={description} chips={chips} />
        <div className="hidden sm:block"><ScoreReadout score={score} label="Nota da equipe" /></div>
      </div>

      <div className="sm:pl-11 mt-5 space-y-5">
        {/* Escala 0–10 (vale para a equipe avaliada). 11 numa linha quando cabe; senão 6 + 5. */}
        <div role="group" aria-labelledby={scoreLabelId}>
          <div className="flex items-end justify-between gap-3 mb-2.5">
            <Eyebrow as="span" id={scoreLabelId} className="text-foreground">Escolha de 0 a 10</Eyebrow>
            <span className="sm:hidden font-condensed text-[15px] font-black leading-none tabular-nums text-foreground" aria-hidden>
              {score != null ? <>{score}<span className="text-muted-foreground text-[12px] font-bold">/10</span></> : <span className="text-[13px] font-semibold text-muted-foreground normal-case">Sem nota</span>}
            </span>
          </div>
          <div className="grid grid-cols-6 @2xl:grid-cols-11 gap-1.5" data-testid={`score-grid-${c.criterionId}`}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
              <ScoreButton key={val} score={val} current={score} label={labels[val]} onClick={() => onScoreClick(c.criterionId, val)} disabled={false} />
            ))}
          </div>
          <div className="mt-2 flex items-start justify-between gap-4 text-[12px] leading-snug text-muted-foreground">
            <span><b className="font-condensed text-[13px] font-black text-foreground">0</b> · {labels[0]}</span>
            <span className="text-right">{labels[10]} · <b className="font-condensed text-[13px] font-black text-foreground">10</b></span>
          </div>
        </div>

        {/* Justificativa (obrigatória) */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <label htmlFor={commentId} className="font-condensed flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-foreground">
              Justificativa <span className="text-[var(--status-danger-text)]">obrigatória</span>
            </label>
            <span className={cn("text-[12px] font-semibold tabular-nums shrink-0", comment.length >= MAX_COMMENT ? "text-[var(--status-warn-text)]" : "text-muted-foreground")} aria-live="polite">
              {comment.length}/{MAX_COMMENT}
            </span>
          </div>
          <Textarea
            id={commentId}
            aria-describedby={hintId}
            aria-invalid={missingComment || undefined}
            placeholder="O que a equipe fez bem ou deixou de fazer neste critério? O texto chega à equipe sem o seu nome."
            value={comment}
            maxLength={MAX_COMMENT}
            onChange={e => onCommentChange(c.criterionId, e.target.value)}
            className={cn(
              "min-h-24 resize-y rounded-lg bg-card text-[15px] leading-relaxed border-border transition-[border-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-foreground/40",
              missingComment && "border-[var(--status-warn)]",
            )}
          />
          <p id={hintId} className={cn("mt-1.5 text-[12px] leading-snug flex items-center gap-1.5", missingComment ? "text-[var(--status-warn-text)] font-semibold" : "text-muted-foreground")}>
            {missingComment
              ? <><AlertCircle size={13} aria-hidden className="shrink-0" /> Escreva a justificativa para este critério entrar no lançamento.</>
              : "Sem justificativa a nota não pode ser lançada."}
          </p>
        </div>

        {/* Áudio (opcional) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-secondary/60 px-4 py-3">
          <div className="flex items-start gap-3 min-w-0">
            <Mic size={16} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-foreground">Áudio <span className="font-normal text-muted-foreground">(opcional)</span></p>
              <p className="text-[12px] text-muted-foreground leading-snug">Complementa a justificativa escrita; não a substitui.</p>
            </div>
          </div>
          <div className="sm:shrink-0 sm:max-w-[60%]">
            <AudioRecorder value={audio} onChange={path => onAudioChange(c.criterionId, path)} />
          </div>
        </div>

        {/* Rascunho (opcional) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] flex items-center gap-1.5 min-h-5" aria-live="polite">
            {isSaving ? (
              <span className="text-muted-foreground flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" aria-hidden /> Salvando rascunho…</span>
            ) : draftClean ? (
              <span className="text-[var(--status-ok-text)] font-semibold flex items-center gap-1.5"><CheckCircle2 size={14} aria-hidden /> Rascunho salvo</span>
            ) : isDraft ? (
              <span className="text-[var(--status-warn-text)] font-semibold">Alterações depois do rascunho</span>
            ) : (
              <span className="text-muted-foreground">Rascunho é opcional — dá para lançar direto.</span>
            )}
          </p>
          <button
            type="button"
            onClick={() => onSaveDraft(c.criterionId)}
            disabled={score == null || !comment.trim() || isSaving || !!anySaving || draftClean}
            data-testid={`button-save-draft-${c.criterionId}`}
            className={draftClean ? btnGhost : btnSmall}
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Save size={14} aria-hidden />}
            {isSaving ? "Salvando..." : isDraft ? "Atualizar rascunho" : "Salvar rascunho"}
          </button>
        </div>
      </div>
    </article>
  );
}
