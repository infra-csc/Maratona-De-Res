import type { Evaluation, EventCriterion } from "@workspace/api-client-react";
import { CheckCircle, Clock, Building2, Save, CornerDownRight, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { AudioRecorder, AudioPlayer } from "@/components/audio-recorder";
import { CONDENSED, AMBER } from "@/lib/premium-theme";
import { AMBER_TINT, INFO_TINT, SCORE_LABELS as labels } from "./constants";
import { ScoreButton } from "./score-button";
import type { CriterionAssignmentRow } from "./types";

export interface CriterionCardHandlers {
  onScoreClick: (criterionId: number, score: number) => void;
  onCommentChange: (criterionId: number, value: string) => void;
  onAudioChange: (criterionId: number, path: string | null) => void;
  onSaveDraft: (criterionId: number) => void;
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
}

// Cartão de um critério: selos, escala 0–10, justificativa, áudio e rascunho.
export function CriterionCard({
  criterion: c, index, total, ev, score, comment, audio, assignment, isSaving,
  onScoreClick, onCommentChange, onAudioChange, onSaveDraft,
}: CriterionCardProps) {
  const submitted = ev?.status === "submitted";
  const isDraft = ev?.status === "draft";

  return (
    <div className="criterion-row border-l-4 pl-6 py-2" style={{ borderLeftColor: submitted ? "var(--accent)" : isDraft ? AMBER : score != null ? "var(--accent)" : "var(--border)" }}>
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="bg-secondary border border-border rounded-lg px-2 py-0.5 text-[11px] font-black uppercase">Peso {c.weightOverride ?? c.originalWeight ?? 0}</span>
            {Number(c.weightOverride ?? c.originalWeight ?? 0) === 0 && !c.eventScoped && (
              <span className="bg-destructive/10 border border-destructive rounded-lg text-destructive px-2 py-0.5 text-[11px] font-black uppercase">Peso 0 — não conta na média</span>
            )}
            {c.eventScoped && (
              <span className="bg-accent/10 border border-accent rounded-lg text-accent-text px-2 py-0.5 text-[11px] font-black uppercase">Entra na média do critério pai</span>
            )}
            {c.responsibleAreaName && (
              <span className="bg-secondary text-foreground border border-border rounded-lg px-2 py-0.5 text-[11px] font-bold uppercase flex items-center gap-1">
                <Building2 size={11} /> {c.responsibleAreaName}
              </span>
            )}
            {submitted && (
              <span className="bg-accent/15 text-accent-text border border-accent rounded px-2 py-0.5 text-[11px] font-bold uppercase flex items-center gap-1">
                <CheckCircle size={12} /> Submetido
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
          <h4 className="text-xl md:text-2xl uppercase font-black tracking-tight" style={{ fontFamily: CONDENSED }}>{index + 1}. {c.criterionName}</h4>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            {c.criterionDescription && c.criterionDescription.trim().length > 0
              ? c.criterionDescription
              : "Avalie o desempenho da equipe considerando este critério específico para o evento atual."}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[11px] font-bold uppercase text-muted-foreground">Ritmo Atual</p>
          <p className="text-[40px] leading-none font-black" style={{ fontFamily: CONDENSED }}>{score != null ? score : "-"}</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-11 gap-1">
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
            <label className="text-xs font-black uppercase flex items-center gap-2">
              Justificativa / Feedback
              <span className="text-[11px] text-destructive-foreground bg-destructive rounded px-2 py-0.5 font-bold uppercase">Obrigatório</span>
            </label>
            <span className="text-[11px] font-bold text-muted-foreground tabular-nums shrink-0">{comment.length}/300</span>
          </div>
          <Textarea
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
          <p className="text-xs font-black uppercase mb-1">Seu Feedback:</p>
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
