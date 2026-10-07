import type { Evaluation, EventCriterion } from "@workspace/api-client-react";
import { CheckCircle, Clock, Building2, Save, CornerDownRight, Loader2, Lock, Link2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { AudioRecorder, AudioPlayer } from "@/components/audio-recorder";
import { CONDENSED, AMBER } from "@/lib/premium-theme";
import { AMBER_TINT, INFO_TINT, SCORE_LABELS as labels } from "./constants";
import { ScoreButton } from "./score-button";
import { displayCriterionName, fmtDT } from "./helpers";
import type { CriterionAssignmentRow } from "./types";

export interface CriterionCardHandlers {
  onScoreClick: (criterionId: number, score: number) => void;
  onCommentChange: (criterionId: number, value: string) => void;
  onAudioChange: (criterionId: number, path: string | null) => void;
  onSaveDraft: (criterionId: number) => void;
  /** Descarta MEU rascunho de um critério que outra pessoa da área já fechou (DELETE /evaluations/{id}). */
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
  isSaving: boolean;
  // Outras áreas também respondem este critério no evento (nota = média das áreas).
  sharedWithOtherAreas?: boolean;
  // A área já respondeu por outra pessoa (primeira resposta fecha): só leitura.
  closedBy?: { name: string | null; at: string | null; viaLink: boolean; score?: number | null; comment?: string | null } | null;
  // Respondido por um freela pelo link que EU gerei (o feedback não é "meu").
  answeredByLinkName?: string | null;
}

// Cartão de um critério: selos, escala 0–10, justificativa, áudio e rascunho.
export function CriterionCard({
  criterion: c, index, total, ev, score, comment, audio, assignment, isSaving, sharedWithOtherAreas, closedBy, answeredByLinkName,
  onScoreClick, onCommentChange, onAudioChange, onSaveDraft, onDiscardDraft, isDiscarding,
}: CriterionCardProps) {
  const submitted = ev?.status === "submitted";
  const isDraft = ev?.status === "draft";

  if (closedBy) {
    return (
      <div className="criterion-row border-l-4 pl-6 py-2" style={{ borderLeftColor: "var(--border)" }} data-testid={`criterion-closed-${c.criterionId}`}>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {c.responsibleAreaName && (
            <span className="bg-secondary text-foreground border border-border rounded-lg px-2 py-0.5 text-[11px] font-bold uppercase flex items-center gap-1">
              <Building2 size={11} /> {c.responsibleAreaName}
            </span>
          )}
          <span className="bg-accent/15 text-accent-text border border-accent rounded px-2 py-0.5 text-[11px] font-bold uppercase flex items-center gap-1">
            <Lock size={11} /> Já respondido
          </span>
        </div>
        <p className="text-[11px] font-black uppercase text-muted-foreground tracking-wider mb-0.5">Critério {index + 1} de {total}</p>
        <div className="flex items-start justify-between gap-4">
          <h4 className="text-xl md:text-2xl uppercase font-black tracking-tight" style={{ fontFamily: CONDENSED }}>{index + 1}. {displayCriterionName(c.criterionName)}</h4>
          {closedBy.score != null && (
            <div className="shrink-0 text-right">
              <p className="text-[11px] font-bold uppercase text-muted-foreground">Nota da área</p>
              <p className="text-[40px] leading-none font-black" style={{ fontFamily: CONDENSED }} data-testid={`closed-score-${c.criterionId}`}>{closedBy.score}</p>
            </div>
          )}
        </div>
        {closedBy.comment && (
          <div className="bg-secondary border border-border rounded-lg p-4 mt-3">
            <p className="text-xs font-black uppercase mb-1">Comentário</p>
            <p className="text-sm text-muted-foreground">"{closedBy.comment}"</p>
          </div>
        )}
        <div className="mt-3 rounded-lg border border-border bg-secondary px-4 py-3 flex items-start gap-3">
          <Lock size={16} className="shrink-0 mt-0.5 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">
              Respondido por {closedBy.name ?? "avaliador da área"}{closedBy.viaLink ? " (link para freela)" : ""}{closedBy.at ? ` em ${fmtDT(closedBy.at)}` : ""}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              A primeira resposta enviada fecha o critério neste evento. Se algo precisar mudar, fale com o RH.
            </p>
          </div>
        </div>
        {/* Sobrou um rascunho meu que não vai mais valer: dá para descartar. */}
        {isDraft && ev && onDiscardDraft && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border px-4 py-2.5">
            <p className="text-xs text-muted-foreground">Você tinha um rascunho para este critério. Ele não será usado.</p>
            <button
              type="button"
              data-testid={`button-discard-draft-${c.criterionId}`}
              disabled={isDiscarding}
              onClick={() => onDiscardDraft(ev.id, c.criterionId)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-[11px] font-bold uppercase hover:bg-secondary disabled:opacity-50"
            >
              {isDiscarding ? "Descartando..." : "Descartar rascunho"}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="criterion-row border-l-4 pl-6 py-2" style={{ borderLeftColor: submitted ? "var(--accent)" : isDraft ? AMBER : score != null ? "var(--accent)" : "var(--border)" }}>
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="bg-secondary border border-border rounded-lg px-2 py-0.5 text-[11px] font-black uppercase">Peso {c.weightOverride ?? c.originalWeight ?? 0}</span>
            {Number(c.weightOverride ?? c.originalWeight ?? 0) === 0 && !c.eventScoped && (
              <span className="bg-destructive/10 border border-destructive rounded-lg text-destructive px-2 py-0.5 text-[11px] font-black uppercase">Peso 0 — não conta na média</span>
            )}
            {sharedWithOtherAreas ? (
              <span title="Outras áreas também avaliam este critério; a nota dele no evento é a média das áreas." className="bg-accent/10 border border-accent rounded-lg text-accent-text px-2 py-0.5 text-[11px] font-black uppercase">Avaliado também por outras áreas</span>
            ) : c.eventScoped && (
              <span className="bg-accent/10 border border-accent rounded-lg text-accent-text px-2 py-0.5 text-[11px] font-black uppercase">Entra na média do critério</span>
            )}
            {c.responsibleAreaName && (
              <span className="bg-secondary text-foreground border border-border rounded-lg px-2 py-0.5 text-[11px] font-bold uppercase flex items-center gap-1">
                <Building2 size={11} /> {c.responsibleAreaName}
              </span>
            )}
            {submitted && (
              <span className="bg-accent/15 text-accent-text border border-accent rounded px-2 py-0.5 text-[11px] font-bold uppercase flex items-center gap-1">
                <CheckCircle size={12} /> Lançado
              </span>
            )}
            {isDraft && (
              <span className="border rounded px-2 py-0.5 text-[11px] font-bold uppercase flex items-center gap-1" style={AMBER_TINT}>
                <Clock size={12} /> Rascunho
              </span>
            )}
            {(() => {
              const a = assignment;
              if (!a?.redirectedFromId) return null;
              const date = a.updatedAt
                ? new Date(a.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                : null;
              const fromFirst = a.redirectedFromName?.split(" ")[0] ?? "?";
              return (
                <span
                  title={`Redirecionado de ${a.redirectedFromName ?? "?"}${date ? ` em ${date}` : ""}`}
                  className="border rounded px-2 py-0.5 text-[11px] font-bold uppercase flex items-center gap-1"
                  style={INFO_TINT}
                >
                  <CornerDownRight size={11} /> De {fromFirst}{date ? <span className="opacity-70">· {date}</span> : null}
                </span>
              );
            })()}
          </div>
          <p className="text-[11px] font-black uppercase text-muted-foreground tracking-wider mb-0.5">
            Critério {index + 1} de {total}
          </p>
          <h4 className="text-xl md:text-2xl uppercase font-black tracking-tight" style={{ fontFamily: CONDENSED }}>{index + 1}. {displayCriterionName(c.criterionName)}</h4>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            {c.criterionDescription && c.criterionDescription.trim().length > 0
              ? c.criterionDescription
              : "Avalie o desempenho da equipe considerando este critério específico para o evento atual."}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[11px] font-bold uppercase text-muted-foreground">Nota escolhida</p>
          {/* Sem nota: texto discreto (o "-" na fonte condensada de 40 px virava uma barra preta). */}
          {score != null
            ? <p className="text-[40px] leading-none font-black" style={{ fontFamily: CONDENSED }}>{score}</p>
            : <p className="text-sm font-bold text-muted-foreground mt-2">Ainda sem nota</p>}
        </div>
      </div>

      <div className="mb-4">
        {/* Notas 0–10 com alvo de toque >= 44 px: 11 numa linha só quando a área
            de conteúdo (container) tem largura; senão, duas linhas de 6. */}
        <div className="grid grid-cols-6 @2xl:grid-cols-11 gap-1.5" data-testid={`score-grid-${c.criterionId}`}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
            <ScoreButton
              key={val}
              score={val}
              current={score}
              label={labels[val]}
              onClick={() => onScoreClick(c.criterionId, val)}
              disabled={submitted}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="flex items-start gap-1.5 text-[11px] text-destructive">
            <span className="font-black shrink-0">0 —</span>
            <span className="font-bold leading-tight">{labels[0]}</span>
          </div>
          <div className="flex items-start gap-1.5 text-[11px] text-accent-text justify-self-end text-right">
            <span className="font-bold leading-tight">{labels[10]}</span>
            <span className="font-black shrink-0">— 10</span>
          </div>
        </div>
      </div>

      {!submitted && (
        <div className="mt-4 border border-border rounded-lg p-4 bg-secondary">
          <div className="flex items-center justify-between gap-2 mb-2">
            <label htmlFor={`justificativa-${c.criterionId}`} className="text-xs font-black uppercase flex items-center gap-2">
              Justificativa / Feedback
              <span className="text-[11px] text-destructive-foreground bg-destructive rounded px-2 py-0.5 font-bold uppercase">Obrigatório</span>
            </label>
            <span className="text-[11px] font-bold text-muted-foreground tabular-nums shrink-0">{comment.length}/300</span>
          </div>
          <Textarea
            id={`justificativa-${c.criterionId}`}
            placeholder="Descreva o desempenho da equipe para este critério (será compartilhado anonimamente)..."
            value={comment}
            maxLength={300}
            onChange={e => onCommentChange(c.criterionId, e.target.value)}
            className="bg-card rounded-lg border resize-y min-h-24 focus-visible:ring-0 border-border"
          />

          <div className="mt-4 border border-border rounded-lg p-4 bg-card">
            <label className="text-xs font-black uppercase flex items-center gap-2 mb-2">
              Áudio da avaliação
              <span className="text-[11px] text-muted-foreground bg-secondary px-2 py-0.5 font-bold uppercase">Opcional</span>
            </label>
            <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
              Grave um áudio explicando a nota, se quiser complementar o comentário escrito.
            </p>
            <AudioRecorder
              value={audio}
              onChange={path => onAudioChange(c.criterionId, path)}
            />
          </div>

          <div className="flex items-center justify-end pt-3 gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => onSaveDraft(c.criterionId)}
              disabled={score == null || !comment.trim() || isSaving}
              data-testid={`button-save-draft-${c.criterionId}`}
              className="bg-card border border-border rounded-lg px-4 py-2 font-bold text-xs uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-secondary transition-all"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isSaving ? "Salvando..." : isDraft ? "Atualizar Rascunho" : "Salvar Rascunho"}
            </button>
          </div>
        </div>
      )}

      {submitted && comment && (
        <div className="bg-secondary border border-border rounded-lg p-4 mt-4">
          <p className="text-xs font-black uppercase mb-1 flex items-center gap-1.5">
            {answeredByLinkName ? <><Link2 size={12} /> Feedback de {answeredByLinkName} (link para freela):</> : "Seu Feedback:"}
          </p>
          <p className="text-sm text-muted-foreground">"{comment}"</p>
        </div>
      )}

      {submitted && audio && (
        <div className="bg-secondary border border-border rounded-lg p-4 mt-4">
          <p className="text-xs font-black uppercase mb-2">Áudio da avaliação</p>
          <AudioPlayer objectPath={audio} />
        </div>
      )}
    </div>
  );
}
