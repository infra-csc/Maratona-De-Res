import type { CSSProperties } from "react";
import type { PublicEvalInfo, PublicEvalCriterion, PublicEvalSubmitRejected } from "@workspace/api-client-react";
import { CheckCircle2, AlertTriangle, Lock, CalendarClock } from "lucide-react";
import { NEXT_CYCLE_OPENS_TEXT } from "@/lib/utils";
import { displayCriterionName, fmtDT } from "../evaluations/helpers";
import { CONDENSED, DANGER_TEXT } from "@/lib/premium-theme";
import { Card } from "./ui";

// Telas de estado (link inválido, carregando, já usado, enviado, sem
// critérios). Todas recebem o `shellStyle` com os tokens do tema da página.

type ShellProps = { shellStyle: CSSProperties };

export function LoadErrorScreen({ shellStyle, message }: ShellProps & { message: string }) {
  return (
    <div style={shellStyle} className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-8 text-center">
        <AlertTriangle size={40} className="mx-auto mb-4" style={{ color: DANGER_TEXT }} />
        <h1 className="font-black text-2xl uppercase tracking-wide mb-2" style={{ fontFamily: CONDENSED }}>Link Inválido</h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{message}</p>
      </Card>
    </div>
  );
}

export function LoadingScreen({ shellStyle }: ShellProps) {
  return (
    <div style={shellStyle} className="min-h-screen flex items-center justify-center" role="status" aria-live="polite">
      <p className="text-sm font-bold uppercase animate-pulse" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Carregando...</p>
    </div>
  );
}

export function AlreadyUsedScreen({ shellStyle, info }: ShellProps & { info: PublicEvalInfo }) {
  const usedDate = info.usedAt ? new Date(info.usedAt) : null;
  const usedDateStr = usedDate
    ? usedDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;
  const usedTimeStr = usedDate
    ? usedDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;
  return (
    <div style={shellStyle} className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-8 text-center">
        <CheckCircle2 size={40} className="mx-auto mb-4" style={{ color: "var(--accent-text)" }} />
        <h1 className="font-black text-2xl uppercase tracking-wide mb-2" style={{ fontFamily: CONDENSED }}>Link Já Utilizado</h1>
        <p className="text-sm mb-3" style={{ color: "var(--muted-foreground)" }}>
          Este formulário já foi preenchido por <strong style={{ color: "var(--foreground)" }}>{info.submitterName ?? "alguém"}</strong>.
        </p>
        {usedDateStr && usedTimeStr && (
          <p className="text-xs font-bold uppercase inline-block rounded-lg px-4 py-2" style={{ fontFamily: CONDENSED, backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
            {usedDateStr} às {usedTimeStr}
          </p>
        )}
        <p className="text-xs mt-4" style={{ color: "var(--muted-foreground)" }}>Caso precise de ajuda, entre em contato com o responsável pelo evento.</p>
      </Card>
    </div>
  );
}

/**
 * Tela final do envio. Três situações, sem nunca dizer "sucesso" à toa:
 *  - tudo gravado → "Respostas enviadas";
 *  - parte gravada → "Respostas enviadas, em parte" + o que ficou de fora e por quê;
 *  - nada gravado (tudo já estava respondido) → "Nada foi gravado" + os motivos.
 */
export function DoneScreen({ shellStyle, submitterName, rejected = [], nothingSaved = false, savedCount = 0, conformitySaved = false }: ShellProps & {
  submitterName: string; rejected?: PublicEvalSubmitRejected[]; nothingSaved?: boolean;
  /** Quantos critérios foram gravados neste envio. */
  savedCount?: number;
  /** A Matriz de Conformidade foi gravada neste envio (link combinado). */
  conformitySaved?: boolean;
}) {
  const partial = !nothingSaved && rejected.length > 0;
  // O que de fato ficou gravado, em uma frase: "2 critérios e a Matriz de Conformidade".
  const savedParts = [
    savedCount > 0 ? (savedCount === 1 ? "1 critério" : `${savedCount} critérios`) : null,
    conformitySaved ? "a Matriz de Conformidade" : null,
  ].filter(Boolean) as string[];
  const savedText = savedParts.join(" e ");
  return (
    <div style={shellStyle} className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="text-center space-y-4 max-w-md w-full" role="status" aria-live="polite">
        {nothingSaved
          ? <Lock size={52} strokeWidth={1.5} style={{ color: "var(--muted-foreground)", margin: "0 auto" }} aria-hidden />
          : <CheckCircle2 size={56} strokeWidth={1.5} style={{ color: "var(--accent-text)", margin: "0 auto" }} aria-hidden />}
        <h1 className="font-black text-3xl uppercase tracking-wide" style={{ fontFamily: CONDENSED }} data-testid="public-done-title">
          {nothingSaved ? "Nada foi gravado" : partial ? "Respostas enviadas, em parte" : "Respostas enviadas"}
        </h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          {nothingSaved
            ? <>Obrigado, <span className="font-semibold" style={{ color: "var(--foreground)" }}>{submitterName}</span>. Tudo o que este link pedia já tinha sido respondido por outra pessoa, então as suas respostas não foram gravadas. Não é preciso fazer mais nada.</>
            : partial
              ? <>Obrigado, <span className="font-semibold" style={{ color: "var(--foreground)" }}>{submitterName}</span>. {savedText ? <>Foi registrado: <strong style={{ color: "var(--foreground)" }}>{savedText}</strong>.</> : "Parte das suas respostas foi registrada."} O que já estava respondido por outra pessoa ficou como estava:</>
              : <>Obrigado, <span className="font-semibold" style={{ color: "var(--foreground)" }}>{submitterName}</span>. Suas respostas foram registradas com sucesso.</>}
        </p>
        {rejected.length > 0 && (
          <Card className="p-4 text-left space-y-2">
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase" style={{ fontFamily: CONDENSED, color: DANGER_TEXT }}>
              {rejected.length === 1 ? "1 item não foi gravado" : `${rejected.length} itens não foram gravados`}
            </p>
            <ul className="space-y-1.5">
              {rejected.map(r => (
                <li key={`${r.kind ?? "criterion"}-${r.criterionId}`} className="text-sm">
                  <strong>{r.kind === "conformity" ? r.criterionName : displayCriterionName(r.criterionName)}</strong>
                  <span className="block text-xs" style={{ color: "var(--muted-foreground)" }}>{r.reason}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

/** Todos os critérios do link já foram respondidos pela área: avisa ANTES de a pessoa preencher. */
export function AllClosedScreen({ shellStyle, info }: ShellProps & { info: PublicEvalInfo }) {
  // Ciclo por área: link gerado em nome de alguém de outra área — nada a responder.
  const otherArea = info.criteria.length > 0 && info.criteria.every(c => c.closed && !!c.closedReason);
  if (otherArea) {
    return (
      <div style={shellStyle} className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-8 text-center">
          <Lock size={36} className="mx-auto mb-4" style={{ color: "var(--muted-foreground)" }} />
          <h1 className="font-black text-2xl uppercase tracking-wide mb-2" style={{ fontFamily: CONDENSED }}>Link sem critérios para você</h1>
          <p className="text-sm mb-4" style={{ color: "var(--muted-foreground)" }}>
            {info.criteria[0]?.closedReason} Peça um link novo ao responsável pelo evento.
          </p>
        </Card>
      </div>
    );
  }
  return (
    <div style={shellStyle} className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-8 text-center">
        <Lock size={36} className="mx-auto mb-4" style={{ color: "var(--muted-foreground)" }} />
        <h1 className="font-black text-2xl uppercase tracking-wide mb-2" style={{ fontFamily: CONDENSED }}>Já respondido</h1>
        <p className="text-sm mb-4" style={{ color: "var(--muted-foreground)" }}>
          {info.tokenType === "criteria_with_conformity"
            ? <>Os critérios e a Matriz de Conformidade deste link{info.eventName ? <> em <strong style={{ color: "var(--foreground)" }}>{info.eventName}</strong></> : null} já foram respondidos por outra pessoa. Não é preciso enviar nada.</>
            : <>Os critérios deste link{info.eventName ? <> em <strong style={{ color: "var(--foreground)" }}>{info.eventName}</strong></> : null} já foram respondidos por outra pessoa. Não é preciso enviar nada.</>}
        </p>
        <ClosedCriteriaList criteria={info.criteria} />
        <p className="text-xs mt-4" style={{ color: "var(--muted-foreground)" }}>Caso precise de ajuda, entre em contato com o responsável pelo evento.</p>
      </Card>
    </div>
  );
}

/** Lista compacta "critério — respondido por X em dd/mm hh:mm". */
export function ClosedCriteriaList({ criteria }: { criteria: PublicEvalCriterion[] }) {
  const closed = criteria.filter(c => c.closed);
  if (closed.length === 0) return null;
  return (
    <ul className="text-left space-y-2">
      {closed.map(c => (
        <li key={c.criterionId} className="rounded-lg px-3 py-2 flex items-start gap-2" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }} data-testid={`public-closed-${c.criterionId}`}>
          <Lock size={14} className="shrink-0 mt-0.5" style={{ color: "var(--muted-foreground)" }} aria-hidden />
          <span className="min-w-0">
            <span className="block text-sm font-bold uppercase" style={{ fontFamily: CONDENSED }}>{displayCriterionName(c.criterionName)}</span>
            <span className="block text-xs" style={{ color: "var(--muted-foreground)" }}>
              {c.closedReason
                ? c.closedReason
                : <>{c.closedByName ? `Já respondido por ${c.closedByName}` : "Já respondido"}{c.closedAt ? ` em ${fmtDT(c.closedAt)}` : ""}</>}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// Link de critérios sem nenhum critério: antes o botão ficava cinza para
// sempre (allCriteriaScored exige length > 0). Diz na cara o que fazer.
export function NoCriteriaScreen({ shellStyle, eventName }: ShellProps & { eventName: PublicEvalInfo["eventName"] }) {
  return (
    <div style={shellStyle} className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-8 text-center">
        <AlertTriangle size={40} className="mx-auto mb-4" style={{ color: DANGER_TEXT }} />
        <h1 className="font-black text-2xl uppercase tracking-wide mb-2" style={{ fontFamily: CONDENSED }}>Link sem critérios</h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Este link não tem critérios para avaliar{eventName ? <> em <strong style={{ color: "var(--foreground)" }}>{eventName}</strong></> : null} — peça outro ao responsável pelo evento.
        </p>
      </Card>
    </div>
  );
}

/**
 * Evento do PRÓXIMO ciclo (409 EVENT_NEXT_CYCLE): ainda não aceita avaliação.
 * Mostra a mensagem do servidor; o link continua valendo para depois.
 */
export function NextCycleScreen({ shellStyle, message, eventName }: ShellProps & { message: string; eventName?: string | null }) {
  return (
    <div style={shellStyle} className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-8 text-center">
        <CalendarClock size={36} className="mx-auto mb-4" style={{ color: "var(--muted-foreground)" }} aria-hidden />
        <h1 className="font-black text-2xl uppercase tracking-wide mb-2" style={{ fontFamily: CONDENSED }} data-testid="public-next-cycle">{NEXT_CYCLE_OPENS_TEXT}</h1>
        {eventName && <p className="text-sm font-bold mb-2">{eventName}</p>}
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }} data-testid="public-next-cycle-message">{message}</p>
        <p className="text-xs mt-4" style={{ color: "var(--muted-foreground)" }}>Nada foi gravado. Guarde este link: ele volta a funcionar quando o ciclo novo existir.</p>
      </Card>
    </div>
  );
}

/** Ciclo do evento fechado (só consulta): o link não aceita mais respostas. */
export function CycleClosedScreen({ shellStyle, info }: ShellProps & { info: PublicEvalInfo }) {
  return (
    <div style={shellStyle} className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-8 text-center" >
        <Lock size={36} className="mx-auto mb-4" style={{ color: "var(--muted-foreground)" }} aria-hidden />
        <h1 className="font-black text-2xl uppercase tracking-wide mb-2" style={{ fontFamily: CONDENSED }} data-testid="public-cycle-closed">Ciclo fechado</h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          O ciclo {info.eventName ? <>do evento <strong style={{ color: "var(--foreground)" }}>{info.eventName}</strong> </> : null}já foi fechado — este link não aceita mais respostas. Não é preciso enviar nada.
        </p>
        <p className="text-xs mt-4" style={{ color: "var(--muted-foreground)" }}>Caso precise de ajuda, entre em contato com o responsável pelo evento.</p>
      </Card>
    </div>
  );
}

/** Link só da Matriz de Conformidade, e a matriz já foi respondida (por outra pessoa ou pelo responsável). */
export function MatrixAnsweredScreen({ shellStyle, info }: ShellProps & { info: PublicEvalInfo }) {
  return (
    <div style={shellStyle} className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-8 text-center">
        <Lock size={36} className="mx-auto mb-4" style={{ color: "var(--muted-foreground)" }} aria-hidden />
        <h1 className="font-black text-2xl uppercase tracking-wide mb-2" style={{ fontFamily: CONDENSED }} data-testid="public-matrix-already-answered">Já respondida</h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          {info.tokenType === "conformity_ferramentas" ? "O retorno de equipamentos e ferramentas" : "A Matriz de Conformidade"}
          {info.eventName ? <> de <strong style={{ color: "var(--foreground)" }}>{info.eventName}</strong></> : null} já foi respondid{info.tokenType === "conformity_ferramentas" ? "o" : "a"}
          {info.conformityAnsweredByName ? <> por <strong style={{ color: "var(--foreground)" }}>{info.conformityAnsweredByName}</strong></> : null}. A resposta que está lá foi mantida — não é preciso enviar nada.
        </p>
        <p className="text-xs mt-4" style={{ color: "var(--muted-foreground)" }}>Caso precise de ajuda, entre em contato com o responsável pelo evento.</p>
      </Card>
    </div>
  );
}
