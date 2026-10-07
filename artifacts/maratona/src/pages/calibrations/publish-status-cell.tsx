// Célula "Status" da tabela: o que está PUBLICADO (o que vale para o
// colaborador e na nota oficial), se a calibração SALVA ainda falta publicar e
// o seletor "Publicar como" Parc./Final (só vale ao clicar em Publicar).
// Regra do dono (02/10/2026): salvar é calibrar; só PUBLICAR faz valer.
import type React from "react";
import { CheckCircle, Clock, EyeOff } from "lucide-react";
import { GOOD, AMBER, GOOD_TEXT, AMBER_TEXT } from "@/lib/premium-theme";
import { fmtNum } from "@/lib/utils";
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
    <td className="px-1.5 py-2 hidden sm:table-cell align-top" onClick={e => e.stopPropagation()}>
      {cal ? (
        <div className="flex flex-col items-stretch gap-1.5 min-w-[118px] max-w-[150px] mx-auto">
          <PublishedBlock c={c} isFinalPublished={isFinalPublished} />
          {cal.pendingPublish && <PendingBlock cal={cal} c={c} />}
          {canFinalize && (
            <div>
              <p className="text-[11px] font-bold uppercase mb-0.5 text-center" style={{ color: "var(--muted-foreground)", letterSpacing: "0.04em" }}>Publicar como</p>
              <div role="group" aria-label="Publicar como" className="flex items-stretch rounded overflow-hidden w-full" style={{ border: "1px solid var(--border)" }}>
                <button
                  type="button"
                  title="Publicar como parcial — só vale ao clicar em Publicar (Salvar não publica)"
                  aria-pressed={intent === "partial"}
                  onClick={() => setPublishIntents(prev => ({ ...prev, [c.criterionId]: "partial" }))}
                  className="flex-1 py-1 text-[11px] font-black uppercase transition-colors leading-none"
                  style={{ backgroundColor: intent === "partial" ? AMBER : "transparent", color: intent === "partial" ? "#fff" : "var(--muted-foreground)" }}
                >
                  Parc.
                </button>
                <span className="w-px shrink-0" style={{ backgroundColor: "var(--border)" }} />
                <button
                  type="button"
                  title="Publicar como final — só vale ao clicar em Publicar (Salvar não publica)"
                  aria-pressed={intent === "final"}
                  onClick={() => setPublishIntents(prev => ({ ...prev, [c.criterionId]: "final" }))}
                  className="flex-1 py-1 text-[11px] font-black uppercase transition-colors leading-none"
                  style={{ backgroundColor: intent === "final" ? GOOD : "transparent", color: intent === "final" ? "#fff" : "var(--muted-foreground)" }}
                >
                  Final
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center">
          <span className="inline-flex items-center gap-0.5 text-[11px] font-bold uppercase rounded px-1.5 py-0.5 whitespace-nowrap" style={{ backgroundColor: "rgba(232,162,61,0.14)", color: AMBER_TEXT, border: `1px solid ${AMBER}` }}>
            {avg != null ? "Sem calibração" : "Sem nota"}
          </span>
        </div>
      )}
    </td>
  );
}

/** O que está PUBLICADO: é o que o colaborador vê e o que vale na nota. */
function PublishedBlock({ c, isFinalPublished }: { c: EventCriterion; isFinalPublished: boolean }) {
  const at = isFinalPublished ? c.finalPublishedAt : c.partialPublishedAt;
  const by = isFinalPublished ? c.finalPublishedByUserName : c.partialPublishedByUserName;
  if (!at) {
    return (
      <div className="rounded px-1.5 py-1 text-center" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }} data-testid={`status-published-${c.criterionId}`}>
        <p className="inline-flex items-center gap-1 text-[11px] font-black uppercase" style={{ color: "var(--muted-foreground)" }}>
          <EyeOff size={10} aria-hidden /> Não publicado
        </p>
        <p className="text-[10.5px] leading-tight" style={{ color: "var(--muted-foreground)" }}>o colaborador ainda não vê</p>
      </div>
    );
  }
  const color = isFinalPublished ? GOOD_TEXT : AMBER_TEXT;
  const border = isFinalPublished ? GOOD : AMBER;
  return (
    <div className="rounded px-1.5 py-1 text-center" style={{ backgroundColor: isFinalPublished ? "rgba(154,176,0,0.12)" : "rgba(232,162,61,0.12)", border: `1px solid ${border}` }} data-testid={`status-published-${c.criterionId}`}>
      <p className="inline-flex items-center gap-1 text-[11px] font-black uppercase whitespace-nowrap" style={{ color }}>
        <CheckCircle size={10} aria-hidden /> {isFinalPublished ? "Publicado final" : "Publicado parcial"}
      </p>
      {c.publishedScore != null && (
        <p className="text-[12px] font-black tabular-nums leading-tight" style={{ color: "var(--foreground)" }}>nota {score(c.publishedScore)}</p>
      )}
      <p className="text-[10.5px] leading-tight" style={{ color: "var(--muted-foreground)" }}>
        {formatDateTime(new Date(at))}{by ? <><br />por {by}</> : null}
      </p>
    </div>
  );
}

/** Calibração SALVA depois da última publicação: ainda não vale. */
function PendingBlock({ cal, c }: { cal: CalibrationRecord; c: EventCriterion }) {
  return (
    <div data-testid="badge-criterion-pending-publish" className="rounded px-1.5 py-1 text-center"
      style={{ backgroundColor: "var(--status-warn-bg)", border: `1px dashed ${AMBER}` }}
      title="Salva e ainda não publicada: o colaborador e a nota oficial só mudam depois de publicar">
      <p className="inline-flex items-center gap-1 text-[11px] font-black uppercase" style={{ color: AMBER_TEXT }}>
        <Clock size={10} aria-hidden /> Falta publicar
      </p>
      <p className="text-[10.5px] leading-tight" style={{ color: "var(--foreground)" }}>
        salva <strong className="tabular-nums">{score(cal.calibratedScore)}</strong>{cal.calibratedAt ? <> em {formatDateTime(new Date(cal.calibratedAt))}</> : null}
      </p>
      <p className="text-[10.5px] leading-tight" style={{ color: "var(--muted-foreground)" }}>
        {c.publishedScore != null ? <>vale a publicada ({score(c.publishedScore)})</> : <>vale a média dos avaliadores</>}
      </p>
    </div>
  );
}

/** Selo compacto (celular, onde a coluna de status some). */
export function PendingPublishBadge({ className = "", testId = "badge-criterion-pending-publish" }: { className?: string; testId?: string }) {
  return (
    <span data-testid={testId} title="Salva e ainda não publicada: o colaborador e a nota oficial só mudam depois de publicar"
      className={`inline-flex items-center gap-1 text-[11px] font-black uppercase rounded px-1.5 py-0.5 whitespace-nowrap ${className}`}
      style={{ backgroundColor: "var(--status-warn-bg)", color: AMBER_TEXT, border: `1px solid ${AMBER}` }}>
      <Clock size={10} aria-hidden /> Falta publicar
    </span>
  );
}
