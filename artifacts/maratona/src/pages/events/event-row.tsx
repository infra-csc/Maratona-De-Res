// Um evento da lista: a LINHA da tabela (telas largas) e o CARTÃO (celular e
// tablet) — os dois com os mesmos dados: nome, data (+ selo de período), barras,
// nota, status (com atalho para o próximo passo) e o menu de ações por papel.
import { Link } from "wouter";
import type { Cycle, User } from "@workspace/api-client-react";
import { ChevronRight, Users, GitMerge, SlidersHorizontal, Trash2, Pencil, MoreHorizontal, ClipboardList, Info } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { hasRole } from "@/lib/auth-context";
import { fmtDate, fmtNum, eventPeriodPosition } from "@/lib/utils";
import { CONDENSED, GOOD, AMBER, AMBER_TEXT, DANGER_TEXT, GOOD_TEXT } from "@/lib/premium-theme";
import { MiniBar, CalBar } from "./bars";
import { deriveEventRow, NEXT_CYCLE_BADGE, NEXT_CYCLE_NOTICE, type EventBadge } from "./rules";
import type { EventItem } from "./types";

export type EventRowActions = {
  onEdit: (ev: EventItem) => void;
  onMerge: (ev: EventItem) => void;
  onDelete: (ev: EventItem) => void;
};

type EventRowProps = EventRowActions & {
  ev: EventItem;
  user: User | null;
  gridCols: string;
  /** Ciclo anterior / Total geral (seletor de ciclo): só consulta, sem ações de escrita. */
  readOnly?: boolean;
  /** Total geral: selo com o nome do ciclo do evento. */
  cycleLabel?: string | null;
  /** Ciclo do evento (para o selo "Fora do período"). */
  eventCycle?: Cycle | null;
};

const FULL: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };

/**
 * Selo "Fora do período" com a explicação acessível no toque e no teclado
 * (antes só no `title`, que não aparece no celular nem para leitor de tela).
 * Critério único: a DATA DE INÍCIO do evento (eventPeriodPosition).
 */
export function PeriodBadge({ ev, cycle, hideAfter = false }: { ev: EventItem; cycle: Cycle | null | undefined; hideAfter?: boolean }) {
  const pos = eventPeriodPosition(ev, cycle);
  if (pos === "inside" || !cycle) return null;
  // Evento do próximo ciclo: o selo de Status ("Próximo ciclo") já explica — sem selo repetido.
  if (pos === "after" && hideAfter) return null;
  const after = pos === "after";
  const label = after ? "Fora do período" : "Antes do período";
  const text = after
    ? afterPeriodText(ev, cycle)
    : `Este evento começa em ${fmtDate(ev.startDate, FULL)}, antes do início do ciclo "${cycle.name}" (${fmtDate(cycle.startDate, FULL)}). Ele continua contando neste ciclo.`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={`badge-outside-cycle-${ev.id}`}
          aria-label={`${label}: ver explicação`}
          className="mt-1 inline-flex w-fit items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-bold uppercase whitespace-nowrap transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          style={{ fontFamily: CONDENSED, backgroundColor: after ? "var(--status-info-bg)" : "var(--secondary)", color: after ? "var(--status-info-text)" : "var(--muted-foreground)", border: after ? "none" : "1px solid var(--border)" }}
        >
          {label} <Info size={10} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(320px,calc(100vw-32px))] text-[12.5px] leading-snug" style={{ backgroundColor: "var(--popover)", color: "var(--popover-foreground)", border: "1px solid var(--border)" }}>
        <p className="font-bold uppercase text-[11px] mb-1" style={{ fontFamily: CONDENSED, letterSpacing: "0.04em" }}>{label}</p>
        {after && <p className="font-semibold mb-1" style={{ color: "var(--status-info-text)" }}>{NEXT_CYCLE_NOTICE}</p>}
        <p data-testid={`text-outside-cycle-${ev.id}`}>{text}</p>
      </PopoverContent>
    </Popover>
  );
}

/** Detalhe do evento que começa depois do fim do ciclo (popover do selo). */
function afterPeriodText(ev: EventItem, cycle: Cycle) {
  return `Começa em ${fmtDate(ev.startDate, FULL)}, depois do fim do ciclo "${cycle.name}" (${fmtDate(cycle.endDate, FULL)}): não conta na nota nem no bônus deste ciclo. Quando o ciclo novo for criado, passa para ele automaticamente, com as faltas ligadas a ele.`;
}

/**
 * Selo ÚNICO do evento do próximo ciclo na coluna Status: "Próximo ciclo",
 * com a frase única e o detalhe das datas no toque/teclado (popover).
 */
function NextCycleStatusBadge({ ev, badge, cycle }: { ev: EventItem; badge: EventBadge; cycle: Cycle | null | undefined }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={`badge-status-${ev.id}`}
          aria-label={`${NEXT_CYCLE_BADGE}: ver explicação`}
          className="text-[11px] font-bold uppercase px-2 py-1 rounded-full whitespace-nowrap inline-flex items-center gap-1 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          style={{ backgroundColor: badge.bg, color: badge.fg }}
        >
          {NEXT_CYCLE_BADGE} <Info size={10} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(320px,calc(100vw-32px))] text-[12.5px] leading-snug" style={{ backgroundColor: "var(--popover)", color: "var(--popover-foreground)", border: "1px solid var(--border)" }}>
        <p className="font-bold uppercase text-[11px] mb-1" style={{ fontFamily: CONDENSED, letterSpacing: "0.04em" }}>{NEXT_CYCLE_BADGE}</p>
        <p className="font-semibold mb-1" style={{ color: "var(--status-info-text)" }} data-testid={`text-next-cycle-${ev.id}`}>{NEXT_CYCLE_NOTICE}</p>
        {cycle && <p data-testid={`text-outside-cycle-${ev.id}`}>{afterPeriodText(ev, cycle)}</p>}
      </PopoverContent>
    </Popover>
  );
}

function CycleLabelBadge({ ev, cycleLabel }: { ev: EventItem; cycleLabel: string }) {
  return (
    <span data-testid={`badge-event-cycle-${ev.id}`} title={`Evento do ciclo ${cycleLabel}`}
      className="mt-1 block w-fit max-w-full break-words leading-tight rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, backgroundColor: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
      {cycleLabel}
    </span>
  );
}

function StatusBadgeView({ ev, badge, readOnly, nextCycle = false, cycle = null }: { ev: EventItem; badge: EventBadge; readOnly: boolean; nextCycle?: boolean; cycle?: Cycle | null }) {
  if (nextCycle) return <NextCycleStatusBadge ev={ev} badge={badge} cycle={cycle} />;
  if (badge.next && !readOnly) {
    return (
      <Link
        href={badge.next.href}
        title={badge.next.title}
        data-testid={`badge-next-step-${ev.id}`}
        className="text-[11px] font-bold uppercase px-2 py-1 rounded-full whitespace-nowrap inline-flex items-center gap-1 transition-opacity hover:opacity-80 underline-offset-2 hover:underline"
        style={{ backgroundColor: badge.bg, color: badge.fg }}
      >
        {badge.label} <ChevronRight size={9} aria-hidden="true" />
      </Link>
    );
  }
  return (
    <span data-testid={`badge-status-${ev.id}`} title={badge.title} className="text-[11px] font-bold uppercase px-2 py-1 rounded-full whitespace-nowrap" style={{ backgroundColor: badge.bg, color: badge.fg }}>
      {badge.label}
      {badge.title && <span className="sr-only">. {badge.title}</span>}
    </span>
  );
}

/** Atalhos e menu "Mais ações" (mesmos na linha e no cartão). */
function EventActions({ ev, user, readOnly, evaluationsHref, onEdit, onMerge, onDelete }: EventRowActions & { ev: EventItem; user: User | null; readOnly: boolean; evaluationsHref: string }) {
  return (
    <>
      {!readOnly && <Link
        href={evaluationsHref}
        data-testid={`link-evaluations-event-${ev.id}`}
        title="Avaliações deste evento"
        aria-label={`Avaliações de ${ev.name}`}
        className="h-8 w-8 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70"
        style={{ backgroundColor: "var(--secondary)", border: "2px solid var(--border)", color: "var(--foreground)" }}
      >
        <ClipboardList size={13} aria-hidden="true" />
      </Link>}
      <Link
        href={`/events/${ev.id}`}
        data-testid={`button-view-event-${ev.id}`}
        title={readOnly ? "Ver evento (só consulta)" : "Gerenciar evento"}
        aria-label={`${readOnly ? "Ver" : "Gerenciar"} ${ev.name}`}
        className="h-8 w-8 rounded-lg flex items-center justify-center transition-opacity hover:opacity-80"
        style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
      >
        <ChevronRight size={13} aria-hidden="true" />
      </Link>
      {!readOnly && user && (["admin", "rh", "diretoria"].includes(user.role) || hasRole(user, "operador")) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Mais ações para ${ev.name}`}
              title="Mais ações"
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70"
              style={{ backgroundColor: "var(--secondary)", border: "2px solid var(--border)", color: "var(--foreground)" }}
            >
              <MoreHorizontal size={13} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className="p-1.5 min-w-[170px] rounded-lg shadow-lg"
            style={{ backgroundColor: "var(--card)", border: "2px solid var(--border)", color: "var(--foreground)", zIndex: 9999 }}
          >
            {user && (["admin", "rh"].includes(user.role) || hasRole(user, "operador")) && (
              <DropdownMenuItem
                data-testid={`button-edit-event-${ev.id}`}
                onClick={() => onEdit(ev)}
                className="gap-2 font-bold text-[12px] uppercase cursor-pointer rounded-md px-3 py-2 hover:bg-[var(--secondary)]"
              >
                <Pencil size={13} /> Editar
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild className="gap-2 font-bold text-[12px] uppercase cursor-pointer rounded-md px-3 py-2 hover:bg-[var(--secondary)]">
              <Link href={evaluationsHref}>
                <ClipboardList size={13} /> Avaliações
              </Link>
            </DropdownMenuItem>
            {user && ["admin", "rh", "diretoria"].includes(user.role) && (
              <DropdownMenuItem asChild className="gap-2 font-bold text-[12px] uppercase cursor-pointer rounded-md px-3 py-2 hover:bg-[var(--secondary)]">
                <Link href={`/calibrations?eventId=${ev.id}`}>
                  <SlidersHorizontal size={13} /> Calibrações
                </Link>
              </DropdownMenuItem>
            )}
            {user && ["admin", "operador"].includes(user.role) && (
              <>
                <DropdownMenuSeparator style={{ backgroundColor: "var(--border)", margin: "4px 0" }} />
                {user.role === "admin" && (
                  <DropdownMenuItem
                    data-testid={`button-merge-event-${ev.id}`}
                    onClick={() => onMerge(ev)}
                    className="gap-2 font-bold text-[12px] uppercase cursor-pointer rounded-md px-3 py-2 hover:bg-[var(--secondary)]"
                  >
                    <GitMerge size={13} /> Mesclar
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  data-testid={`button-delete-event-${ev.id}`}
                  onClick={() => onDelete(ev)}
                  className="gap-2 font-bold text-[12px] uppercase cursor-pointer rounded-md px-3 py-2"
                  style={{ color: DANGER_TEXT }}
                >
                  <Trash2 size={13} /> Excluir
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}

function PendingPublishBadge({ ev }: { ev: EventItem }) {
  if ((ev.pendingPublishCount ?? 0) <= 0) return null;
  return (
    // "N calibrações a publicar" não cabe numa linha nesta coluna: o texto
    // curto fica visível e o completo vai no título e para o leitor de tela.
    <span data-testid={`badge-pending-publish-${ev.id}`}
      title={`${ev.pendingPublishCount} ${ev.pendingPublishCount === 1 ? "calibração salva e ainda não publicada" : "calibrações salvas e ainda não publicadas"}: só vale na nota depois de publicar`}
      className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase whitespace-nowrap"
      style={{ fontFamily: CONDENSED, letterSpacing: "0.03em", backgroundColor: "var(--status-warn-bg)", color: AMBER_TEXT }}>
      <span aria-hidden>{ev.pendingPublishCount} a publicar</span>
      <span className="sr-only">{ev.pendingPublishCount} {ev.pendingPublishCount === 1 ? "calibração" : "calibrações"} a publicar</span>
    </span>
  );
}

/** Marcadores do nome: "Aguardando RH", "Não confirmado", cliente · cidade. */
function NameMeta({ ev, pendingRH }: { ev: EventItem; pendingRH: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 mt-0.5 min-w-0">
      {pendingRH && (
        <span className="text-[11px] font-bold uppercase" title="A avaliação já devia ter aberto e os critérios não foram confirmados" style={{ color: DANGER_TEXT }}>Aguardando RH ·</span>
      )}
      {!ev.resultsConfirmed && ev.criteriaConfirmed && (
        <span className="text-[11px] font-bold uppercase" title="Resultados não confirmados: ainda não contam na elegibilidade nem na nota dos colaboradores" style={{ color: AMBER_TEXT }}>Não confirmado ·</span>
      )}
      <span className="text-[11px] truncate min-w-0" style={{ color: "var(--muted-foreground)" }}>
        {[ev.clientName, ev.city].filter(Boolean).join(" · ")}
      </span>
    </div>
  );
}

export function EventRow({ ev, user, gridCols, onEdit, onMerge, onDelete, readOnly = false, cycleLabel = null, eventCycle = null }: EventRowProps) {
  const {
    score, fc, total, evalTotal, evalDone, finalPubCount, partialOnlyCount, isPureHistorical,
    hasEvals, hasAnyPublication, missing, evaluationsHref, evalTooltip, accentColor,
    scoreLabel, scoreLabelColor, evalColor, dateStr, badge, pendingRH, nextCycle,
  } = deriveEventRow(ev, undefined, eventCycle);

  return (
    <div
      data-testid={`row-event-${ev.id}`}
      className="grid relative items-center transition-colors group hover:opacity-95"
      style={{ gridTemplateColumns: gridCols, borderBottom: "1px solid var(--border)" }}
    >
      {/* Accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: accentColor }} />

      {/* Event name + subtitle */}
      <div className="pl-4 pr-3 py-3 min-w-0">
        <Link href={`/events/${ev.id}`} className="text-[13px] font-bold uppercase leading-tight block truncate transition-colors hover:opacity-70">
          {ev.name}
        </Link>
        <NameMeta ev={ev} pendingRH={pendingRH} />
        {missing.length > 0 && !hasEvals && !hasAnyPublication && (
          <p className="text-[11px] font-bold uppercase truncate mt-0.5" style={{ color: DANGER_TEXT }}>
            Sem aval.: {missing.join(", ")}
          </p>
        )}
      </div>

      {/* Date */}
      <div className="px-3.5 py-3 text-xs font-semibold min-w-0">
        <span className="whitespace-nowrap">{dateStr}</span>
        <div><PeriodBadge ev={ev} cycle={eventCycle} hideAfter={nextCycle} /></div>
        {cycleLabel && <CycleLabelBadge ev={ev} cycleLabel={cycleLabel} />}
      </div>

      {/* Participants */}
      <div className="px-3.5 py-3 flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
        <Users size={12} aria-hidden />
        <span className="text-[12px] font-bold">{ev.participantCount ?? 0}</span>
      </div>

      {/* Avaliações mini bar */}
      <div className="px-3.5 py-3">
        {ev.isHistorical || evalTotal === 0 ? (
          <span className="text-[11px] italic opacity-40" title={ev.isHistorical ? "Evento histórico: sem avaliações neste sistema" : "Nenhum critério ativo neste evento"}>—</span>
        ) : (
          <MiniBar value={evalDone} total={evalTotal} color={evalColor} title={evalTooltip} />
        )}
      </div>

      {/* Calibrações mini bar */}
      <div className="px-3.5 py-3">
        {isPureHistorical || total === 0 ? (
          <span className="text-[11px] italic opacity-40">—</span>
        ) : (
          <CalBar finalCount={finalPubCount} partialCount={partialOnlyCount} total={total} />
        )}
        <PendingPublishBadge ev={ev} />
      </div>

      {/* Matriz de Conformidade mini bar */}
      <div className="px-3.5 py-3">
        {!ev.conformityNeeded ? (
          <span className="text-[11px] italic opacity-40">—</span>
        ) : (
          <MiniBar
            value={ev.conformityFilled ?? 0}
            total={ev.conformityTotal ?? 0}
            color={ev.conformityComplete ? GOOD : (ev.conformityFilled ?? 0) > 0 ? AMBER : "var(--border)"}
            title={`${ev.conformityFilled ?? 0} de ${ev.conformityTotal ?? 0} itens da Matriz de Conformidade respondidos`}
          />
        )}
      </div>

      {/* Score */}
      <div className="px-1 py-3 text-center">
        {score != null ? (
          <div>
            <span className="font-black text-lg leading-none block" style={{ fontFamily: CONDENSED, color: fc ? GOOD_TEXT : "var(--foreground)" }}>
              {fmtNum(score, 1)}
            </span>
            <span className="text-[11px] font-bold uppercase whitespace-nowrap" style={{ color: scoreLabelColor }}>{scoreLabel}</span>
          </div>
        ) : (
          <span className="text-sm italic opacity-40">—</span>
        )}
      </div>

      {/* Status badge */}
      <div className="px-3.5 py-3">
        <StatusBadgeView ev={ev} badge={badge} readOnly={readOnly} nextCycle={nextCycle} cycle={eventCycle} />
      </div>

      {/* Action */}
      <div className="px-2.5 py-3 flex items-center justify-center gap-1.5">
        <EventActions ev={ev} user={user} readOnly={readOnly} evaluationsHref={evaluationsHref} onEdit={onEdit} onMerge={onMerge} onDelete={onDelete} />
      </div>
    </div>
  );
}

/** Uma métrica do cartão: rótulo pequeno em cima, valor/barra embaixo. */
function CardMetric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>{label}</span>
      {children}
    </div>
  );
}

/**
 * Cartão do evento para celular e tablet (no lugar da tabela de 9 colunas,
 * que espremia o nome até sumir e sobrepunha a data). Mesmos dados e ações.
 */
export function EventCard({ ev, user, onEdit, onMerge, onDelete, readOnly = false, cycleLabel = null, eventCycle = null }: Omit<EventRowProps, "gridCols">) {
  const {
    score, fc, total, evalTotal, evalDone, finalPubCount, partialOnlyCount, isPureHistorical,
    hasEvals, hasAnyPublication, missing, evaluationsHref, evalTooltip, accentColor,
    scoreLabel, scoreLabelColor, evalColor, dateStr, badge, pendingRH, nextCycle,
  } = deriveEventRow(ev, undefined, eventCycle);

  return (
    <article
      data-testid={`card-event-${ev.id}`}
      aria-labelledby={`card-event-title-${ev.id}`}
      className="relative overflow-hidden rounded-xl pl-4 pr-3 py-3"
      style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: accentColor }} aria-hidden />

      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link id={`card-event-title-${ev.id}`} href={`/events/${ev.id}`} className="text-[14px] font-bold uppercase leading-snug block break-words transition-colors hover:opacity-70">
            {ev.name}
          </Link>
          <NameMeta ev={ev} pendingRH={pendingRH} />
        </div>
        <div className="shrink-0 text-right">
          {score != null ? (
            <>
              <span className="font-black text-xl leading-none block" style={{ fontFamily: CONDENSED, color: fc ? GOOD_TEXT : "var(--foreground)" }}>{fmtNum(score, 1)}</span>
              <span className="text-[11px] font-bold uppercase whitespace-nowrap" style={{ color: scoreLabelColor }}>{scoreLabel}</span>
            </>
          ) : (
            <span className="text-sm italic opacity-40" aria-label="Sem nota">—</span>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[12px] font-semibold whitespace-nowrap">{dateStr}</span>
        <span className="inline-flex items-center gap-1 text-[12px] font-bold" style={{ color: "var(--muted-foreground)" }}>
          <Users size={12} aria-hidden /> {ev.participantCount ?? 0}<span className="sr-only"> participantes</span>
        </span>
        <StatusBadgeView ev={ev} badge={badge} readOnly={readOnly} nextCycle={nextCycle} cycle={eventCycle} />
      </div>
      {((eventPeriodPosition(ev, eventCycle) !== "inside" && !nextCycle) || cycleLabel) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <PeriodBadge ev={ev} cycle={eventCycle} hideAfter={nextCycle} />
          {cycleLabel && <CycleLabelBadge ev={ev} cycleLabel={cycleLabel} />}
        </div>
      )}
      {missing.length > 0 && !hasEvals && !hasAnyPublication && (
        <p className="text-[11px] font-bold uppercase mt-1" style={{ color: DANGER_TEXT }}>Sem aval.: {missing.join(", ")}</p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-3">
        <CardMetric label="Avaliações">
          {ev.isHistorical || evalTotal === 0 ? <span className="text-[11px] italic opacity-40">—</span>
            : <MiniBar value={evalDone} total={evalTotal} color={evalColor} title={evalTooltip} />}
        </CardMetric>
        <CardMetric label="Calibrações">
          {isPureHistorical || total === 0 ? <span className="text-[11px] italic opacity-40">—</span>
            : <CalBar finalCount={finalPubCount} partialCount={partialOnlyCount} total={total} />}
        </CardMetric>
        <CardMetric label="Matriz">
          {!ev.conformityNeeded ? <span className="text-[11px] italic opacity-40">—</span> : (
            <MiniBar
              value={ev.conformityFilled ?? 0}
              total={ev.conformityTotal ?? 0}
              color={ev.conformityComplete ? GOOD : (ev.conformityFilled ?? 0) > 0 ? AMBER : "var(--border)"}
              title={`${ev.conformityFilled ?? 0} de ${ev.conformityTotal ?? 0} itens da Matriz de Conformidade respondidos`}
            />
          )}
        </CardMetric>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <PendingPublishBadge ev={ev} />
        <div className="ml-auto flex items-center gap-1.5">
          <EventActions ev={ev} user={user} readOnly={readOnly} evaluationsHref={evaluationsHref} onEdit={onEdit} onMerge={onMerge} onDelete={onDelete} />
        </div>
      </div>
    </article>
  );
}
