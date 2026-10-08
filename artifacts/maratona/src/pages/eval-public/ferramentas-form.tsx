import { CheckCircle2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Chip } from "../evaluations/ui";
import { MatrixHeader, MatrixQuestion, Segmented, matrixLabelCls, matrixTextareaCls } from "../evaluations/conformity-bits";

const YES_NO = [
  { value: true, label: "Sim", tone: "yes" as const },
  { value: false, label: "Não", tone: "no" as const },
];

/** Conformidade de Ferramentas e Case: 1 Sim/Não + comentário ("Não" exige). */
export function FerramentasForm({ answer, onAnswer, comment, onComment, showErrors = false }: {
  answer: boolean | null;
  onAnswer: (v: boolean) => void;
  comment: string;
  onComment: (v: string) => void;
  showErrors?: boolean;
}) {
  const isNao = answer === false;
  const commentMissing = isNao && !comment.trim();
  const complete = answer !== null && !commentMissing;
  return (
    <section id="matriz" aria-label="Ferramentas e Case" className="@container px-4 py-6 sm:px-7 sm:py-7 scroll-mt-4">
      <MatrixHeader
        title="Ferramentas e Case"
        status={complete ? <Chip tone="ok" icon={CheckCircle2}>Respondida</Chip> : undefined}
        description="Guarda de equipamentos da equipe de Cenografia neste evento. Se a resposta for Não, conte o que aconteceu."
      />
      <div id="ferr-answer" data-pending-box className="mt-5 overflow-hidden rounded-xl border border-border bg-card scroll-mt-4">
        <MatrixQuestion
          id="ferr-answer-q"
          question="Todos os equipamentos e ferramentas retornaram?"
          penalty={isNao}
          unanswered={showErrors && answer === null}
          control={<Segmented value={answer} options={YES_NO} labelledBy="ferr-answer-q" onChange={(v) => { if (v !== null) onAnswer(v); }} />}
        >
          {answer !== null && (
            <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 duration-200">
              <label htmlFor="ferr-comment" className={matrixLabelCls}>
                Comentário {isNao ? <span className="text-[var(--status-danger-text)]">· obrigatório</span> : <span className="normal-case tracking-normal font-normal">(opcional)</span>}
              </label>
              <Textarea
                id="ferr-comment"
                rows={2}
                placeholder={isNao ? "O que não voltou e o que aconteceu?" : "Alguma observação? (opcional)"}
                value={comment}
                aria-invalid={commentMissing || undefined}
                onChange={e => onComment(e.target.value)}
                className={cn(matrixTextareaCls, "min-h-[72px] w-full px-3.5 py-3 text-[16px] md:text-[15px] shadow-none placeholder:text-muted-foreground/80", commentMissing && "border-[var(--status-danger)]")}
              />
              {commentMissing && <p className="mt-1.5 text-[13px] font-semibold text-[var(--status-danger-text)]">Comentário obrigatório quando a resposta é Não.</p>}
            </div>
          )}
        </MatrixQuestion>
      </div>
    </section>
  );
}
