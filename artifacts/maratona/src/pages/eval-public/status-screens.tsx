import { useState, type ReactNode } from "react";
import type { PublicEvalInfo, PublicEvalCriterion, PublicEvalSubmitRejected } from "@workspace/api-client-react";
import { CheckCircle2, Lock, CalendarClock, Link2Off, WifiOff, RotateCw, ServerCrash, Ban, Check, X } from "lucide-react";
import { NEXT_CYCLE_OPENS_TEXT, cn, plural } from "@/lib/utils";
import { displayCriterionName, fmtDT } from "../evaluations/helpers";
import { Eyebrow, btnPrimary } from "../evaluations/ui";
import { PublicShell, StatusScreen } from "./ui";

// Telas de estado do link público (carregando, inválido, sem conexão, já
// usado, enviado, já respondido, ciclo fechado, próximo ciclo…). Todas na
// mesma estrutura (StatusScreen): evento como contexto, título, o que houve e
// o que fazer agora.

type Shell = { isDark: boolean; onToggleTheme: () => void };
type ShellProps = { shell: Shell };

const strong = (s: ReactNode) => <strong className="font-semibold text-foreground">{s}</strong>;

/** Lista de itens com estado (gravado / não gravado / já respondido). */
function ItemList({ title, tone, items, testId }: {
  title: string;
  tone: "ok" | "danger" | "neutral";
  items: { key: string; name: string; text?: ReactNode; testId?: string }[];
  testId?: string;
}) {
  const Icon = tone === "ok" ? Check : tone === "danger" ? X : Lock;
  return (
    <div data-testid={testId}>
      <Eyebrow className={cn(tone === "ok" && "text-[var(--status-ok-text)]", tone === "danger" && "text-[var(--status-danger-text)]")}>{title}</Eyebrow>
      <ul className="mt-2.5 rounded-xl border border-border bg-card divide-y divide-border">
        {items.map(it => (
          <li key={it.key} className="flex items-start gap-3 px-4 py-3" data-testid={it.testId}>
            <span aria-hidden className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
              tone === "ok" && "bg-[var(--status-ok-bg)] text-[var(--status-ok-text)]",
              tone === "danger" && "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
              tone === "neutral" && "bg-secondary text-muted-foreground",
            )}>
              <Icon size={12} strokeWidth={3} />
            </span>
            <span className="min-w-0">
              <span className="font-condensed block text-[17px] font-black uppercase leading-tight text-foreground break-words">{it.name}</span>
              {it.text && <span className="mt-0.5 block text-[14px] leading-snug text-muted-foreground">{it.text}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Falha ao abrir o link: inválido (404), sem conexão ou erro do servidor. */
export function LoadErrorScreen({ shell, message, status, onRetry }: ShellProps & { message: string; status: number | null; onRetry: () => void }) {
  if (status === 404) {
    return (
      <StatusScreen shell={shell} tone="danger" icon={Link2Off} title="Link inválido">
        <p>Este link não existe ou foi cancelado. Confira se o endereço foi copiado inteiro ou peça um link novo a quem enviou.</p>
      </StatusScreen>
    );
  }
  const offline = status === 0;
  const retry = (
    <button type="button" onClick={onRetry} className={cn(btnPrimary, "w-full sm:w-auto")}>
      <RotateCw size={15} aria-hidden /> Tentar de novo
    </button>
  );
  return (
    <StatusScreen shell={shell} tone="warn" icon={offline ? WifiOff : ServerCrash} title={offline ? "Sem conexão" : "Não abriu agora"} actions={retry}>
      {offline
        ? <p>Não foi possível abrir o formulário. Confira o sinal da internet e tente de novo — o link continua valendo.</p>
        : <><p>O servidor não respondeu como deveria. O link continua valendo: tente de novo em instantes.</p><p className="text-[14px]">Detalhe: {message}</p></>}
    </StatusScreen>
  );
}

/** Carregando: o esqueleto do próprio formulário (sem salto quando os dados chegam). */
export function LoadingScreen({ shell }: ShellProps) {
  const bar = "rounded-md bg-secondary motion-safe:animate-pulse";
  return (
    <PublicShell {...shell}>
      <main className="mx-auto w-full max-w-[1048px] px-4 pt-7 sm:px-6 sm:pt-10" role="status" aria-live="polite">
        <span className="sr-only">Carregando o formulário…</span>
        <div aria-hidden className="max-w-[680px]">
          <div className={cn(bar, "h-3 w-40")} />
          <div className={cn(bar, "mt-4 h-9 w-[85%]")} />
          <div className={cn(bar, "mt-2 h-9 w-[55%]")} />
          <div className={cn(bar, "mt-4 h-4 w-48")} />
          <div className={cn(bar, "mt-6 h-16 w-full rounded-xl")} />
          <div className="mt-8 rounded-2xl border border-border bg-card p-5 sm:p-7">
            <div className={cn(bar, "h-6 w-48")} />
            <div className={cn(bar, "mt-3 h-4 w-[70%]")} />
            <div className="mt-5 grid grid-cols-6 gap-1.5">
              {Array.from({ length: 12 }).map((_, i) => <div key={i} className={cn(bar, "h-12 rounded-lg", i === 11 && "invisible")} />)}
            </div>
            <div className={cn(bar, "mt-5 h-24 w-full rounded-lg")} />
          </div>
        </div>
      </main>
    </PublicShell>
  );
}

export function AlreadyUsedScreen({ shell, info }: ShellProps & { info: PublicEvalInfo }) {
  const used = info.usedAt ? new Date(info.usedAt) : null;
  const when = used
    ? `${used.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })} às ${used.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    : null;
  return (
    <StatusScreen shell={shell} tone="neutral" icon={CheckCircle2} eventName={info.eventName} title="Link já utilizado">
      <p>Este formulário já foi preenchido por {strong(info.submitterName ?? "alguém")}{when ? <> em {strong(when)}</> : null}.</p>
      <p>Cada link vale para um envio só. Não é preciso fazer mais nada.</p>
    </StatusScreen>
  );
}

/**
 * Tela final do envio. Três situações, sem nunca dizer "sucesso" à toa:
 *  - tudo gravado → "Respostas enviadas";
 *  - parte gravada → "Respostas enviadas, em parte" + o que ficou e o que não ficou, com o motivo;
 *  - nada gravado (tudo já estava respondido/desativado) → "Nada foi gravado" + os motivos.
 */
export function DoneScreen({ shell, eventName, submitterName, criteria = [], rejected = [], nothingSaved = false, savedCount = 0, savedIds = [], conformitySaved = false, conformityLabel = "Matriz de Conformidade" }: ShellProps & {
  eventName?: string | null;
  submitterName: string;
  criteria?: PublicEvalCriterion[];
  rejected?: PublicEvalSubmitRejected[];
  nothingSaved?: boolean;
  /** Quantos critérios foram gravados neste envio. */
  savedCount?: number;
  savedIds?: number[];
  /** A Matriz de Conformidade foi gravada neste envio (link combinado). */
  conformitySaved?: boolean;
  /** Link só da matriz: o nome da parte respondida (sem lista de critérios). */
  conformityLabel?: string;
}) {
  const partial = !nothingSaved && rejected.length > 0;
  const nameOf = new Map(criteria.map(c => [c.criterionId, displayCriterionName(c.criterionName)]));
  const savedItems = [
    ...savedIds.map(id => ({ key: `c-${id}`, name: nameOf.get(id) ?? "Critério" })),
    ...(conformitySaved ? [{ key: "matriz", name: conformityLabel }] : []),
  ];
  const savedText = [
    savedCount > 0 ? plural(savedCount, "critério") : null,
    conformitySaved ? `a ${conformityLabel}` : null,
  ].filter(Boolean).join(" e ");
  const rejectedItems = rejected.map(r => ({
    key: `${r.kind ?? "criterion"}-${r.criterionId}`,
    name: r.kind === "conformity" ? r.criterionName : displayCriterionName(r.criterionName),
    text: r.reason,
  }));
  const title = nothingSaved ? "Nada foi gravado" : partial ? "Respostas enviadas, em parte" : "Respostas enviadas";
  // Hora da confirmação (fica no "recibo" — dá para tirar print como comprovante).
  const [receiptAt] = useState(() => {
    const d = new Date();
    return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  });
  return (
    <StatusScreen
      shell={shell}
      tone={nothingSaved ? "neutral" : partial ? "warn" : "success"}
      icon={nothingSaved ? Lock : partial ? CheckCircle2 : Check}
      eventName={eventName}
      title={title}
      titleTestId="public-done-title"
      details={(savedItems.length > 0 || rejectedItems.length > 0) ? (
        <div className="space-y-6">
          {savedItems.length > 0 && <ItemList title={partial ? (savedItems.length === 1 ? "Gravado" : "Gravados") : `Recibo · ${receiptAt}`} tone="ok" items={savedItems} testId="public-saved" />}
          {rejectedItems.length > 0 && (
            <ItemList title={rejectedItems.length === 1 ? "1 item não foi gravado" : `${rejectedItems.length} itens não foram gravados`} tone="danger" items={rejectedItems} testId="public-rejected" />
          )}
        </div>
      ) : undefined}
      footer={nothingSaved ? "O link continua sem uso. Dúvidas? Fale com quem enviou este link para você." : "Pode fechar esta página. Dúvidas? Fale com quem enviou este link para você."}
    >
      {nothingSaved
        ? <p>Obrigado, {strong(submitterName)}. Tudo o que este link pedia já estava respondido (ou foi desativado), então as suas respostas não foram gravadas. Não é preciso fazer mais nada.</p>
        : partial
          ? <p>Obrigado, {strong(submitterName)}. {savedText ? <>Foi registrado: {strong(savedText)}.</> : "Parte das suas respostas foi registrada."} O que não pôde ser gravado está abaixo, com o motivo.</p>
          : <p>Obrigado, {strong(submitterName)}. Suas respostas foram registradas e o link agora está fechado.</p>}
    </StatusScreen>
  );
}

/** Todos os critérios do link já foram respondidos pela área: avisa ANTES de a pessoa preencher. */
export function AllClosedScreen({ shell, info }: ShellProps & { info: PublicEvalInfo }) {
  // Ciclo por área: link gerado em nome de alguém de outra área — nada a responder.
  const otherArea = info.criteria.length > 0 && info.criteria.every(c => c.closed && !!c.closedReason);
  if (otherArea) {
    return (
      <StatusScreen shell={shell} tone="neutral" icon={Ban} eventName={info.eventName} title="Link sem critérios para você">
        <p>{info.criteria[0]?.closedReason}</p>
        <p>Peça um link novo a quem enviou este.</p>
      </StatusScreen>
    );
  }
  return (
    <StatusScreen
      shell={shell}
      tone="neutral"
      icon={Lock}
      eventName={info.eventName}
      title="Já respondido"
      details={<ClosedCriteriaList criteria={info.criteria} />}
    >
      <p>
        {info.tokenType === "criteria_with_conformity"
          ? "Os critérios e a Matriz de Conformidade deste link já foram respondidos por outra pessoa."
          : "Os critérios deste link já foram respondidos por outra pessoa."}{" "}
        Não é preciso enviar nada.
      </p>
    </StatusScreen>
  );
}

/** Lista "critério — respondido por X em dd/mm hh:mm". */
export function ClosedCriteriaList({ criteria }: { criteria: PublicEvalCriterion[] }) {
  const closed = criteria.filter(c => c.closed);
  if (closed.length === 0) return null;
  return (
    <ItemList
      title={closed.length === 1 ? "Critério já respondido" : "Critérios já respondidos"}
      tone="neutral"
      items={closed.map(c => ({
        key: String(c.criterionId),
        testId: `public-closed-${c.criterionId}`,
        name: displayCriterionName(c.criterionName),
        text: c.closedReason
          ? c.closedReason
          : <>{c.closedByName ? `Já respondido por ${c.closedByName}` : "Já respondido pela área"}{c.closedAt ? ` em ${fmtDT(c.closedAt)}` : ""}</>,
      }))}
    />
  );
}

// Link de critérios sem nenhum critério (todos desativados no evento): diz na cara o que fazer.
export function NoCriteriaScreen({ shell, eventName }: ShellProps & { eventName: PublicEvalInfo["eventName"] }) {
  return (
    <StatusScreen shell={shell} tone="neutral" icon={Ban} eventName={eventName} title="Link sem critérios">
      <p>Este link não tem critérios para avaliar neste evento — eles podem ter sido desativados depois que o link foi gerado. Nada foi gravado.</p>
      <p>Peça outro link a quem enviou este.</p>
    </StatusScreen>
  );
}

/**
 * Evento do PRÓXIMO ciclo (409 EVENT_NEXT_CYCLE): ainda não aceita avaliação.
 * Mostra a mensagem do servidor; o link continua valendo para depois.
 */
export function NextCycleScreen({ shell, message, eventName }: ShellProps & { message: string; eventName?: string | null }) {
  return (
    <StatusScreen
      shell={shell}
      tone="info"
      icon={CalendarClock}
      eventName={eventName}
      title={NEXT_CYCLE_OPENS_TEXT}
      titleTestId="public-next-cycle"
      footer="Nada foi gravado. Guarde este link: ele volta a funcionar quando o ciclo novo existir."
    >
      <p data-testid="public-next-cycle-message">{message}</p>
    </StatusScreen>
  );
}

/** Ciclo do evento fechado (só consulta): o link não aceita mais respostas. */
export function CycleClosedScreen({ shell, info }: ShellProps & { info: PublicEvalInfo }) {
  return (
    <StatusScreen shell={shell} tone="neutral" icon={Lock} eventName={info.eventName} title="Ciclo fechado" titleTestId="public-cycle-closed">
      <p>O ciclo deste evento já foi fechado — este link não aceita mais respostas. Não é preciso enviar nada.</p>
    </StatusScreen>
  );
}

/** Link só da Matriz de Conformidade, e a matriz já foi respondida (por outra pessoa ou pelo responsável). */
export function MatrixAnsweredScreen({ shell, info }: ShellProps & { info: PublicEvalInfo }) {
  const ferr = info.tokenType === "conformity_ferramentas";
  return (
    <StatusScreen shell={shell} tone="neutral" icon={Lock} eventName={info.eventName} title="Já respondida" titleTestId="public-matrix-already-answered">
      <p>
        {ferr ? "O retorno de equipamentos e ferramentas" : "A Matriz de Conformidade"} deste evento já foi respondid{ferr ? "o" : "a"}
        {info.conformityAnsweredByName ? <> por {strong(info.conformityAnsweredByName)}</> : null}.
        {" "}A resposta que está lá foi mantida — não é preciso enviar nada.
      </p>
    </StatusScreen>
  );
}
