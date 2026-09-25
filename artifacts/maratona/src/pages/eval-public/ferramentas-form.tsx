import { CONDENSED, DANGER_TEXT } from "@/lib/premium-theme";
import { Card, YesNoToggle } from "./ui";

/** Conformidade de Ferramentas e Case: 1 Sim/Não + comentário ("Não" exige). */
export function FerramentasForm({ answer, onAnswer, comment, onComment }: {
  answer: boolean | null;
  onAnswer: (v: boolean) => void;
  comment: string;
  onComment: (v: string) => void;
}) {
  const isNao = answer === false;
  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="text-[11px] font-bold tracking-[0.18em] uppercase" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>Ferramentas e Case</span>
      </div>
      <div className="px-5 py-4" id="ferr-answer">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm leading-snug flex-1">Todos os equipamentos e ferramentas retornaram?</p>
          <div className="flex items-center gap-2 shrink-0">
            {isNao && <span className="text-[11px] font-bold uppercase whitespace-nowrap" style={{ fontFamily: CONDENSED, color: DANGER_TEXT }}>-10 pts</span>}
            <YesNoToggle value={answer} onChange={onAnswer} />
          </div>
        </div>
        {answer !== null && (
          <div className="mt-3 space-y-1">
            <label className="text-[11px] font-bold tracking-[0.1em] uppercase" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>
              Comentário {isNao ? <span className="normal-case font-semibold" style={{ color: DANGER_TEXT }}>* obrigatório</span> : <span className="font-normal normal-case">(opcional)</span>}
            </label>
            <textarea
              id="ferr-comment"
              rows={2}
              placeholder={isNao ? "Descreva o que aconteceu com os equipamentos/ferramentas..." : "Alguma observação? (opcional)"}
              value={comment}
              onChange={e => onComment(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
              style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
            />
            {isNao && !comment.trim() && (
              <p className="text-[11px] font-bold" style={{ color: DANGER_TEXT }}>Comentário obrigatório quando a resposta é Não.</p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
