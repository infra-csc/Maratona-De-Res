// Detalhe por ÁREA de um critério na Calibração: uma linha por área (o critério
// de origem + as cópias por área dos critérios multiárea) com quem respondeu
// (ou "via link: Freela"), nota, comentário completo, áudio e data; área sem
// resposta fica "Pendente". Em cima, a média das áreas — a mesma conta do
// servidor (mergeEventScopedCriteria). Aberto por padrão quando há resposta.
import type React from "react";
import { ChevronDown, CornerDownRight, Link2 } from "lucide-react";
import type { AdminPublicToken } from "@/lib/routing-api";
import { fmtNum } from "@/lib/utils";
import { Chip, Eyebrow, btnGhost } from "../evaluations/ui";
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
    return (
      <p data-testid={`cal-areas-empty-${criterionId}`} className="rounded-lg border border-dashed border-border px-3.5 py-3 text-[13.5px] text-muted-foreground">
        <span className="font-semibold text-foreground">Pendente</span> — nenhuma resposta da área ainda.
      </p>
    );
  }
  const copyToReason = (comment: string) => {
    setCalReasons(prev => ({ ...prev, [criterionId]: comment }));
    setTimeout(() => {
      const el = document.querySelector(`[data-testid="input-cal-reason-inline-${criterionId}"]`) as HTMLTextAreaElement | null;
      if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; el.focus(); }
    }, 0);
  };
  return (
    <details open={answered > 0} className="group/areas rounded-xl border border-border" data-testid={`cal-areas-${criterionId}`}>
      <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none min-h-11 px-3.5 py-2.5 flex items-center gap-2 rounded-xl hover:bg-secondary/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="min-w-0 flex flex-col gap-1">
          <Eyebrow as="span" className="text-foreground">{multi ? "Respostas das áreas" : "Resposta da área"}</Eyebrow>
          {multi ? (
            <span className="text-[13px] text-muted-foreground">
              <strong className="font-semibold text-foreground">Média das áreas: {avg != null ? fmtNum(avg, 1) : "—"}</strong> ({answered} de {members.length} áreas)
            </span>
          ) : answered > 1 ? <span className="text-[13px] text-muted-foreground">{answered} respostas</span> : null}
        </span>
        <ChevronDown size={16} aria-hidden className="ml-auto shrink-0 text-muted-foreground transition-transform duration-200 group-open/areas:rotate-180" />
      </summary>
      <ul className="border-t border-border divide-y divide-border">
        {members.map(m => (
          m.answers.length === 0 ? (
            <li key={m.criterionId} className="px-3.5 py-3 flex items-center justify-between gap-3">
              <Eyebrow as="span">{m.areaName ?? "Sem área"}</Eyebrow>
              <Chip>Pendente</Chip>
            </li>
          ) : m.answers.map((s, i) => {
            const link = linkOf(s, tokens);
            return (
              <li key={`${m.criterionId}-${i}`} className="px-3.5 py-3" data-testid={`cal-area-answer-${m.criterionId}`}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <Eyebrow as="span">{m.areaName ?? "Sem área"}</Eyebrow>
                    <p className="mt-1.5 text-[14px] leading-snug text-foreground">
                      {link ? (
                        <>
                          <span className="inline-flex items-center gap-1 font-semibold"><Link2 size={13} aria-hidden className="text-muted-foreground" />via link: {s.name}</span>
                          {link.createdByName ? <span className="text-muted-foreground"> (em nome de {link.createdByName})</span> : null}
                        </>
                      ) : <span className="font-semibold">{s.name}</span>}
                      {s.respondedAt && <span className="text-muted-foreground text-[12.5px]"> · {formatDateTime(s.respondedAt)}</span>}
                    </p>
                  </div>
                  <span className="shrink-0 font-condensed text-[24px] font-black tabular-nums leading-none text-foreground" title="Nota enviada (0 a 10)">
                    {fmtNum(s.score, 1)}<span className="text-[13px] font-bold text-muted-foreground">/10</span>
                  </span>
                </div>
                {s.comment && (
                  <blockquote className="mt-2 border-l-2 border-border pl-3 text-[14px] leading-relaxed text-foreground break-words whitespace-pre-wrap">{s.comment}</blockquote>
                )}
                {s.audioUrl && <div className="mt-2 max-w-[360px]"><AudioPlayer objectPath={s.audioUrl} /></div>}
                {s.comment && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); copyToReason(s.comment); }}
                    title="Copiar o comentário para a justificativa da calibração"
                    aria-label={`Copiar o comentário de ${s.name} para a justificativa`}
                    className={`${btnGhost} mt-1.5 -ml-3`}
                  >
                    <CornerDownRight size={14} aria-hidden /> Usar na justificativa
                  </button>
                )}
              </li>
            );
          })
        ))}
      </ul>
    </details>
  );
}
