// Detalhe por ÁREA de um critério na Calibração: uma linha por área (o critério
// de origem + as cópias por área dos critérios multiárea) com quem respondeu
// (ou "via link: Freela"), nota, comentário completo, áudio e data; área sem
// resposta fica "Pendente". Em cima, a média das áreas — a mesma conta do
// servidor (mergeEventScopedCriteria). Aberto por padrão quando há resposta.
import type React from "react";
import { ChevronDown, Copy } from "lucide-react";
import type { AdminPublicToken } from "@/lib/routing-api";
import { fmtNum } from "@/lib/utils";
import { CONDENSED, GOOD_TEXT } from "@/lib/premium-theme";
import { formatDateTime } from "./helpers";
import { AudioPlayer } from "@/components/audio-recorder";
import type { AreaMember, AreaScore } from "./derive";

export type EvaluatorScoresProps = {
  criterionId: number;
  members: AreaMember[];
  avg: number | null;
  tokens: AdminPublicToken[] | undefined;
  setCalReasons: React.Dispatch<React.SetStateAction<Record<number, string>>>;
};

/** Link usado na resposta: o token admin grava createdByUserId = avaliador em nome de quem saiu. */
function linkOf(s: AreaScore, tokens: AdminPublicToken[] | undefined) {
  if (s.evaluatorUserId == null) return null;
  return (tokens ?? []).find(t => t.usedAt != null && t.createdByUserId === s.evaluatorUserId && (t.criterionIds ?? []).includes(s.criterionId)) ?? null;
}

export function EvaluatorScores({ criterionId, members, avg, tokens, setCalReasons }: EvaluatorScoresProps) {
  const multi = members.length > 1;
  const answered = members.filter(m => m.answers.length > 0).length;
  if (!multi && answered === 0) {
    return <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--muted-foreground)" }} data-testid={`cal-areas-empty-${criterionId}`}>Pendente — nenhuma resposta da área ainda.</p>;
  }
  const copyToReason = (comment: string) => {
    setCalReasons(prev => ({ ...prev, [criterionId]: comment }));
    setTimeout(() => {
      const el = document.querySelector(`[data-testid="input-cal-reason-inline-${criterionId}"]`) as HTMLTextAreaElement | null;
      if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
    }, 0);
  };
  return (
    <details open={answered > 0} className="group/areas mt-2 rounded-lg" style={{ border: "1px solid var(--border)" }} data-testid={`cal-areas-${criterionId}`}>
      <summary className="flex items-center gap-2 cursor-pointer select-none px-2.5 py-1.5 text-[11.5px] list-none [&::-webkit-details-marker]:hidden" style={{ backgroundColor: "var(--secondary)" }}>
        <ChevronDown size={13} aria-hidden className="shrink-0 transition-transform group-open/areas:rotate-180" style={{ color: "var(--muted-foreground)" }} />
        {multi ? (
          <span>
            <strong>Média das áreas: {avg != null ? fmtNum(avg, 1) : "—"}</strong>
            <span style={{ color: "var(--muted-foreground)" }}> ({answered} de {members.length} áreas responderam)</span>
          </span>
        ) : (
          <span><strong>Resposta da área</strong>{answered > 1 ? <span style={{ color: "var(--muted-foreground)" }}> ({answered} respostas)</span> : null}</span>
        )}
      </summary>
      <ul>
        {members.map(m => (
          m.answers.length === 0 ? (
            <li key={m.criterionId} className="flex items-center gap-2 px-2.5 py-1.5 text-[11.5px]" style={{ borderTop: "1px solid var(--border)" }}>
              <span className="font-bold uppercase text-[11px] min-w-0 flex-1" style={{ fontFamily: CONDENSED, letterSpacing: "0.03em", color: "var(--muted-foreground)" }}>{m.areaName ?? "Sem área"}</span>
              <span style={{ color: "var(--muted-foreground)" }}>Pendente</span>
            </li>
          ) : m.answers.map((s, i) => {
            const link = linkOf(s, tokens);
            return (
              <li key={`${m.criterionId}-${i}`} className="px-2.5 py-2" style={{ borderTop: "1px solid var(--border)" }} data-testid={`cal-area-answer-${m.criterionId}`}>
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="font-bold uppercase text-[11px] pt-[1px]" style={{ fontFamily: CONDENSED, letterSpacing: "0.03em", color: "var(--muted-foreground)" }}>{m.areaName ?? "Sem área"}</span>
                  <span className="text-[11.5px] font-bold min-w-0">
                    {link ? <>via link: {s.name}{link.createdByName ? <span className="font-normal" style={{ color: "var(--muted-foreground)" }}> (em nome de {link.createdByName})</span> : null}</> : s.name}
                  </span>
                  {s.respondedAt && <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{formatDateTime(s.respondedAt)}</span>}
                  <span className="ml-auto flex items-center gap-1.5 shrink-0">
                    <span className="text-[15px] font-black tabular-nums leading-none" style={{ fontFamily: CONDENSED, color: GOOD_TEXT }} title="Nota enviada (0 a 10)">{fmtNum(s.score, 1)}</span>
                    {s.comment && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); copyToReason(s.comment); }}
                        title="Copiar o comentário para a justificativa da calibração"
                        aria-label={`Copiar o comentário de ${s.name} para a justificativa`}
                        className="h-6 w-6 flex items-center justify-center rounded hover:opacity-70"
                        style={{ color: GOOD_TEXT }}
                      >
                        <Copy size={11} aria-hidden />
                      </button>
                    )}
                  </span>
                </div>
                {s.comment && <p className="mt-1 text-[12px] leading-snug break-words" style={{ whiteSpace: "pre-wrap" }}>{s.comment}</p>}
                {s.audioUrl && <div className="mt-1.5 max-w-[340px]"><AudioPlayer objectPath={s.audioUrl} /></div>}
              </li>
            );
          })
        ))}
      </ul>
    </details>
  );
}
