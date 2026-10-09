// Um evento da lista: a LINHA da tabela (telas largas) e o CARTÃO (celular e
// tablet) — os dois com os mesmos dados: nome, data (+ selo de período), barras,
// nota, status (com atalho para o próximo passo) e o menu de ações por papel.
import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import type { Cycle, User } from "@workspace/api-client-react";
import { ArrowRight, ChevronRight, ClipboardList, GitMerge, Info, Maximize2, MoreHorizontal, Pencil, SlidersHorizontal, Trash2, Users } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { hasRole } from "@/lib/auth-context";
import { cn, fmtDate, fmtNum, eventPeriodPosition, plural } from "@/lib/utils";
import { MiniBar, CalBar, type BarTone } from "./bars";
import { deriveEventRow, NEXT_CYCLE_BADGE, NEXT_CYCLE_NOTICE, type AreaResponseCount, type EventBadge } from "./rules";
import type { EventItem } from "./types";
import { EventDetailsDialog, type EventDetailsKind } from "./event-details-dialog";
import { Chip, Eyebrow, FOCUS_RING, btnSmall, iconBtn, menuItemCls, weekdayShort } from "./events-ui";

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
  /** Ciclo por área: respostas por área (a mesma conta da Central); null = conta por critério. */
  areaCounts?: AreaResponseCount | null;
  /** Coluna/valor de Nota (o operador não vê nota: a API já manda vazio e a coluna sai). */
  showScore?: boolean;
};

const PREVIEW_TITLE = "Média das avaliações enviadas até agora; a nota oficial sai da calibração publicada";

/** Nota da linha/cartão: oficial (publicada) ou "Prévia" (só com ao menos uma resposta; parcial mostra "3/20"). */
function ScoreBlock({ score, fc, label, labelColor, isPreview, previewPartial, hasEvals, align = "center" }: {
  score: number | null; fc: boolean; label: string; labelColor: string; isPreview: boolean; previewPartial: string | null; hasEvals: boolean; align?: "center" | "right";
}) {
  if (score == null || (isPreview && !hasEvals)) {
    return <span className="font-condensed text-[15px] font-bold text-muted-foreground/70" aria-label="Sem nota" title="Sem nota ainda">—</span>;
  }
  return (
    <span className={cn("inline-flex flex-col gap-1", align === "right" ? "items-end" : "items-center")} title={isPreview ? PREVIEW_TITLE : undefined}>
      <span className={cn("font-condensed text-[22px] font-black leading-none tabular-nums tracking-[-0.01em]",
        isPreview ? "text-muted-foreground" : fc ? "text-[var(--status-ok-text)]" : "text-foreground")}>
        {fmtNum(score, 1)}
      </span>
      <span className="font-condensed text-[11.5px] font-bold uppercase tracking-[0.05em] leading-none whitespace-nowrap" style={{ color: isPreview ? "var(--muted-foreground)" : labelColor }}>{label}</span>
      {previewPartial && <span className="font-condensed text-[11.5px] font-bold leading-none tabular-nums text-muted-foreground" title="Respostas das áreas até agora">{previewPartial}</span>}
    </span>
  );
}

const FULL: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };

/** Gatilho de popover com cara de selo — área de toque maior sem mexer no desenho. */
function ChipTrigger({ testId, label, children }: { testId: string; label: string; children: ReactNode }) {
  return (
    <PopoverTrigger asChild>
      <button type="button" data-testid={testId} aria-label={label}
        className={cn("inline-flex w-fit rounded-md py-2.5 -my-2.5 lg:py-0 lg:my-0 transition-opacity hover:opacity-80", FOCUS_RING)}>
        {children}
      </button>
    </PopoverTrigger>
  );
}

function ExplainPopover({ title, children, align = "start" }: { title: string; children: ReactNode; align?: "start" | "end" }) {
  return (
    <PopoverContent align={align} sideOffset={6} className="font-body w-[min(320px,calc(100vw-32px))] rounded-xl border-border bg-popover text-popover-foreground p-4 shadow-lg text-[13.5px] leading-snug">
      <Eyebrow as="p" className="text-foreground mb-2">{title}</Eyebrow>
      {children}
    </PopoverContent>
  );
}

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
      <ChipTrigger testId={`badge-outside-cycle-${ev.id}`} label={`${label}: ver explicação`}>
        <Chip tone={after ? "info" : "neutral"} icon={Info}>{label}</Chip>
      </ChipTrigger>
      <ExplainPopover title={label}>
        {after && <p className="font-semibold mb-1.5 text-[var(--status-info-text)]">{NEXT_CYCLE_NOTICE}</p>}
        <p data-testid={`text-outside-cycle-${ev.id}`} className="text-muted-foreground">{text}</p>
      </ExplainPopover>
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
function NextCycleStatusBadge({ ev, cycle }: { ev: EventItem; cycle: Cycle | null | undefined }) {
  return (
    <Popover>
      <ChipTrigger testId={`badge-status-${ev.id}`} label={`${NEXT_CYCLE_BADGE}: ver explicação`}>
        <Chip tone="info" icon={Info}>{NEXT_CYCLE_BADGE}</Chip>
      </ChipTrigger>
      <ExplainPopover title={NEXT_CYCLE_BADGE} align="end">
        <p className="font-semibold mb-1.5 text-[var(--status-info-text)]" data-testid={`text-next-cycle-${ev.id}`}>{NEXT_CYCLE_NOTICE}</p>
        {cycle && <p data-testid={`text-outside-cycle-${ev.id}`} className="text-muted-foreground">{afterPeriodText(ev, cycle)}</p>}
      </ExplainPopover>
    </Popover>
  );
}

function CycleLabelBadge({ ev, cycleLabel }: { ev: EventItem; cycleLabel: string }) {
  return (
    <span data-testid={`badge-event-cycle-${ev.id}`} title={`Evento do ciclo ${cycleLabel}`}
      className="font-condensed inline-flex w-fit max-w-full items-center min-h-6 px-2 rounded-md border border-border text-[12px] font-bold uppercase tracking-[0.05em] leading-tight text-muted-foreground break-words">
      {cycleLabel}
    </span>
  );
}

function StatusBadgeView({ ev, badge, readOnly, nextCycle = false, cycle = null }: { ev: EventItem; badge: EventBadge; readOnly: boolean; nextCycle?: boolean; cycle?: Cycle | null }) {
  if (nextCycle) return <NextCycleStatusBadge ev={ev} cycle={cycle} />;
  if (badge.next && !readOnly) {
    return (
      <Link
        href={badge.next.href}
        title={badge.next.title}
        data-testid={`badge-next-step-${ev.id}`}
        className={cn("group inline-flex w-fit rounded-md py-2.5 -my-2.5 lg:py-0 lg:my-0", FOCUS_RING)}
      >
        <Chip tone={badge.tone} className="group-hover:underline underline-offset-2">
          {badge.label} <ArrowRight size={12} aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </Chip>
      </Link>
    );
  }
  return (
    <span data-testid={`badge-status-${ev.id}`} title={badge.title} className="inline-flex">
      <Chip tone={badge.tone}>{badge.label}</Chip>
      {badge.title && <span className="sr-only">. {badge.title}</span>}
    </span>
  );
}

/** Abrir o evento + menu "Mais ações" (mesmos na linha e no cartão). */
function EventActions({ ev, user, readOnly, evaluationsHref, onEdit, onMerge, onDelete, variant }: EventRowActions & {
  ev: EventItem; user: User | null; readOnly: boolean; evaluationsHref: string; variant: "row" | "card";
}) {
  const canEdit = !!user && (["admin", "rh"].includes(user.role) || hasRole(user, "operador"));
  const canCalibrate = !!user && ["admin", "rh", "diretoria"].includes(user.role);
  const canMerge = user?.role === "admin";
  const canDelete = !!user && ["admin", "operador"].includes(user.role);
  return (
    <>
      {!readOnly && user && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={`Mais ações para ${ev.name}`} title="Mais ações" className={cn(iconBtn, "data-[state=open]:bg-secondary")}>
              <MoreHorizontal size={16} aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="font-body min-w-[200px] rounded-xl border-border bg-popover text-popover-foreground p-1.5 shadow-lg">
            {canEdit && (
              <DropdownMenuItem data-testid={`button-edit-event-${ev.id}`} onClick={() => onEdit(ev)} className={menuItemCls}>
                <Pencil size={15} aria-hidden /> Editar
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild className={menuItemCls}>
              <Link href={evaluationsHref} data-testid={`link-evaluations-event-${ev.id}`}>
                <ClipboardList size={15} aria-hidden /> Avaliações
              </Link>
            </DropdownMenuItem>
            {canCalibrate && (
              <DropdownMenuItem asChild className={menuItemCls}>
                <Link href={`/calibrations?eventId=${ev.id}`}>
                  <SlidersHorizontal size={15} aria-hidden /> Calibrações
                </Link>
              </DropdownMenuItem>
            )}
            {(canMerge || canDelete) && <DropdownMenuSeparator className="my-1 bg-border" />}
            {canMerge && (
              <DropdownMenuItem data-testid={`button-merge-event-${ev.id}`} onClick={() => onMerge(ev)} className={menuItemCls}>
                <GitMerge size={15} aria-hidden /> Mesclar duplicado
              </DropdownMenuItem>
            )}
            {canDelete && (
              <DropdownMenuItem data-testid={`button-delete-event-${ev.id}`} onClick={() => onDelete(ev)}
                className={cn(menuItemCls, "text-[var(--status-danger-text)] focus:text-[var(--status-danger-text)] focus:bg-[var(--status-danger-bg)] data-[highlighted]:bg-[var(--status-danger-bg)]")}>
                <Trash2 size={15} aria-hidden /> Excluir
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {variant === "row" ? (
        <Link
          href={`/events/${ev.id}`}
          data-testid={`button-view-event-${ev.id}`}
          title={readOnly ? "Ver evento (só consulta)" : "Abrir o evento"}
          aria-label={`${readOnly ? "Ver" : "Abrir"} ${ev.name}`}
          className={cn(iconBtn, "bg-primary text-primary-foreground border-primary hover:bg-primary hover:opacity-90")}
        >
          <ChevronRight size={16} aria-hidden />
        </Link>
      ) : (
        <Link
          href={`/events/${ev.id}`}
          data-testid={`button-view-event-${ev.id}`}
          aria-label={`${readOnly ? "Ver" : "Abrir"} ${ev.name}`}
          className={cn(btnSmall, "bg-primary text-primary-foreground border-primary enabled:hover:bg-primary hover:opacity-90")}
        >
          {readOnly ? "Ver" : "Abrir"} <ChevronRight size={15} aria-hidden />
        </Link>
      )}
    </>
  );
}

/** Admin: a barra vira botão que abre o detalhe (quem respondeu, calibrações, matriz). Demais papéis: só informativa. */
function DetailTrigger({ enabled, label, onOpen, children }: { enabled: boolean; label: string; onOpen: () => void; children: ReactNode }) {
  if (!enabled) return <>{children}</>;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      title={label}
      className={cn(
        "group/bar relative block w-[calc(100%+16px)] -mx-2 px-2 py-2 -my-2 rounded-lg text-left cursor-pointer transition-colors duration-150 hover:bg-secondary/70",
        FOCUS_RING, "focus-visible:ring-offset-0",
      )}
    >
      {children}
      <Maximize2 size={11} aria-hidden className="absolute right-2 bottom-2 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/bar:opacity-100 group-focus-visible/bar:opacity-100" />
    </button>
  );
}

function PendingPublishBadge({ ev }: { ev: EventItem }) {
  const n = ev.pendingPublishCount ?? 0;
  if (n <= 0) return null;
  return (
    // "N calibrações a publicar" não cabe numa linha nesta coluna: o texto
    // curto fica visível e o completo vai no título e para o leitor de tela.
    <span data-testid={`badge-pending-publish-${ev.id}`} className="inline-flex"
      title={`${n} ${n === 1 ? "calibração salva e ainda não publicada" : "calibrações salvas e ainda não publicadas"}: só vale na nota depois de publicar`}>
      <Chip tone="warn">
        <span aria-hidden>{n} a publicar</span>
        <span className="sr-only">{n} {n === 1 ? "calibração" : "calibrações"} a publicar</span>
      </Chip>
    </span>
  );
}

/** Marcadores do nome: "Aguardando RH", "Não confirmado", cliente · cidade. */
function NameMeta({ ev, pendingRH }: { ev: EventItem; pendingRH: boolean }) {
  const where = [ev.clientName, ev.city].filter(Boolean).join(" · ");
  const flags = [
    pendingRH ? { label: "Aguardando RH", cls: "text-[var(--status-danger-text)]", title: "A avaliação já devia ter aberto e os critérios não foram confirmados" } : null,
    !ev.resultsConfirmed && ev.criteriaConfirmed ? { label: "Não confirmado", cls: "text-[var(--status-warn-text)]", title: "Resultados não confirmados: ainda não contam na elegibilidade nem na nota dos colaboradores" } : null,
  ].filter(Boolean) as { label: string; cls: string; title: string }[];
  return (
    <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
      {flags.map(f => (
        <span key={f.label} title={f.title} className={cn("font-condensed text-[12px] font-bold uppercase tracking-[0.05em] whitespace-nowrap", f.cls)}>{f.label}</span>
      ))}
      {where && <span className="text-[13px] text-muted-foreground truncate min-w-0">{where}</span>}
    </div>
  );
}

/** Cor da faixa lateral (o significado está na legenda). */
function accentCls(r: ReturnType<typeof deriveEventRow>, ev: EventItem) {
  if (r.notOpenYet || r.nextCycle) return "bg-[var(--status-info)]";
  if (r.pendingRH) return "bg-[var(--status-danger)]";
  if (ev.feedbackReleased) return "bg-[var(--status-ok)]";
  if (r.evalDone === r.evalTotal && r.evalTotal > 0) return "bg-foreground/60";
  if (r.evalDone > 0) return "bg-[var(--status-warn)]";
  return "bg-border";
}

const evalTone = (r: ReturnType<typeof deriveEventRow>): BarTone =>
  !r.isPureHistorical && r.evalDone === r.evalTotal && r.evalTotal > 0 ? "ok" : "progress";
const matrixTone = (ev: EventItem): BarTone => ev.conformityComplete ? "ok" : (ev.conformityFilled ?? 0) > 0 ? "warn" : "muted";

const Dash = ({ title }: { title?: string }) => <span className="font-condensed text-[15px] font-bold text-muted-foreground/60" title={title} aria-label={title ?? "Não se aplica"}>—</span>;

/** As três métricas (barras) — iguais na linha e no cartão. */
function Metrics({ ev, r, isAdmin, onOpen, wrap }: {
  ev: EventItem; r: ReturnType<typeof deriveEventRow>; isAdmin: boolean; onOpen: (k: EventDetailsKind) => void;
  wrap: (key: string, label: string, node: ReactNode) => ReactNode;
}) {
  return (
    <>
      {wrap("evaluations", "Avaliações", ev.isHistorical || r.evalTotal === 0
        ? <Dash title={ev.isHistorical ? "Evento histórico: sem avaliações neste sistema" : "Nenhum critério ativo neste evento"} />
        : (
          <DetailTrigger enabled={isAdmin} label={`Ver detalhes das avaliações de ${ev.name}`} onOpen={() => onOpen("evaluations")}>
            <MiniBar value={r.evalDone} total={r.evalTotal} tone={evalTone(r)} title={isAdmin ? undefined : r.evalTooltip} srLabel={r.evalTooltip} />
          </DetailTrigger>
        ))}
      {wrap("calibrations", "Publicadas", r.isPureHistorical || r.total === 0
        ? <Dash />
        : (
          <DetailTrigger enabled={isAdmin} label={`Ver detalhes das calibrações de ${ev.name}`} onOpen={() => onOpen("calibrations")}>
            <CalBar finalCount={r.finalPubCount} partialCount={r.partialOnlyCount} total={r.total} />
          </DetailTrigger>
        ))}
      {wrap("matrix", "Matriz", !ev.conformityNeeded
        ? <Dash title="Matriz não exigida neste evento" />
        : (
          <DetailTrigger enabled={isAdmin} label={`Ver detalhes da matriz de conformidade de ${ev.name}`} onOpen={() => onOpen("matrix")}>
            <MiniBar
              value={ev.conformityFilled ?? 0}
              total={ev.conformityTotal ?? 0}
              tone={matrixTone(ev)}
              title={isAdmin ? undefined : `${ev.conformityFilled ?? 0} de ${ev.conformityTotal ?? 0} itens da Matriz de Conformidade respondidos`}
              srLabel={`${ev.conformityFilled ?? 0} de ${ev.conformityTotal ?? 0} itens da Matriz respondidos`}
            />
          </DetailTrigger>
        ))}
    </>
  );
}

/** Data em destaque + dia da semana (ajuda a achar o fim de semana). */
function DateText({ ev, dateStr, inline = false }: { ev: EventItem; dateStr: string; inline?: boolean }) {
  const wd = weekdayShort(ev.startDate);
  const multi = ev.endDate && ev.endDate !== ev.startDate;
  if (inline) {
    return (
      <span className="font-condensed text-[15px] font-bold uppercase tracking-[0.02em] tabular-nums text-foreground whitespace-nowrap">
        {dateStr}{wd && !multi && <span className="ml-1.5 text-muted-foreground">{wd}</span>}
      </span>
    );
  }
  return (
    <span className="block">
      {/* Período em duas linhas (início / fim): com ano não cabe numa linha só. */}
      {dateStr.split("–").map((part, i) => (
        <span key={i} className="block font-condensed text-[15px] font-bold leading-tight tabular-nums text-foreground whitespace-nowrap">{i > 0 ? `– ${part}` : part}</span>
      ))}
      {wd && !multi && <span className="block font-condensed text-[12px] font-bold uppercase tracking-[0.06em] text-muted-foreground mt-0.5">{wd}</span>}
    </span>
  );
}

export function EventRow({ ev, user, gridCols, onEdit, onMerge, onDelete, readOnly = false, cycleLabel = null, eventCycle = null, areaCounts = null, showScore = true }: EventRowProps) {
  const r = deriveEventRow(ev, undefined, eventCycle, areaCounts);
  const isAdmin = hasRole(user, "admin");
  const [details, setDetails] = useState<EventDetailsKind | null>(null);
  const missingShown = r.missing.length > 0 && !r.hasEvals && !r.hasAnyPublication;

  return (
    <div
      role="row"
      data-testid={`row-event-${ev.id}`}
      className="group/row grid relative items-center border-b border-border last:border-b-0 transition-colors duration-150 hover:bg-secondary/35"
      style={{ gridTemplateColumns: gridCols }}
    >
      <span aria-hidden className={cn("absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full", accentCls(r, ev))} />

      <div role="cell" className="pl-5 pr-3 py-3.5 min-w-0">
        <Link href={`/events/${ev.id}`} title={ev.name}
          className={cn("font-condensed block truncate text-[16.5px] font-black uppercase leading-tight tracking-[-0.005em] text-foreground rounded-sm hover:underline underline-offset-2", FOCUS_RING)}>
          {ev.name}
        </Link>
        <NameMeta ev={ev} pendingRH={r.pendingRH} />
        {missingShown && (
          <p className="mt-0.5 font-condensed text-[12px] font-bold uppercase tracking-[0.05em] truncate text-[var(--status-danger-text)]" title={`Sem avaliador: ${r.missing.join(", ")}`}>
            Sem avaliador: {r.missing.join(", ")}
          </p>
        )}
      </div>

      <div role="cell" className="px-3 py-3.5 min-w-0 flex flex-col items-start gap-1.5">
        <DateText ev={ev} dateStr={r.dateStr} />
        <PeriodBadge ev={ev} cycle={eventCycle} hideAfter={r.nextCycle} />
        {cycleLabel && <CycleLabelBadge ev={ev} cycleLabel={cycleLabel} />}
      </div>

      <div role="cell" className="px-3 py-3.5">
        <span className="inline-flex items-center gap-1.5 font-condensed text-[15px] font-bold tabular-nums text-foreground" title={`${plural(ev.participantCount ?? 0, "participante", "participantes")}`}>
          <Users size={14} aria-hidden className="text-muted-foreground" />
          {ev.participantCount ?? 0}
          <span className="sr-only"> participantes</span>
        </span>
      </div>

      <Metrics ev={ev} r={r} isAdmin={isAdmin} onOpen={setDetails}
        wrap={(key, _label, node) => (
          <div key={key} role="cell" className="px-3 py-3.5">{node}</div>
        )} />

      {showScore && (
        <div role="cell" className="px-1 py-3.5 text-center">
          <ScoreBlock score={r.score} fc={r.fc} label={r.scoreLabel} labelColor={r.scoreLabelColor} isPreview={r.isPreview} previewPartial={r.previewPartial} hasEvals={r.hasEvals} />
        </div>
      )}

      <div role="cell" className="px-3 py-3.5 min-w-0 flex flex-col items-start gap-1.5">
        <StatusBadgeView ev={ev} badge={r.badge} readOnly={readOnly} nextCycle={r.nextCycle} cycle={eventCycle} />
        <PendingPublishBadge ev={ev} />
      </div>

      <div role="cell" className="pl-2 pr-4 py-3.5 flex items-center justify-end gap-1.5">
        <EventActions ev={ev} user={user} readOnly={readOnly} evaluationsHref={r.evaluationsHref} onEdit={onEdit} onMerge={onMerge} onDelete={onDelete} variant="row" />
      </div>
      {details && <EventDetailsDialog ev={ev} kind={details} areaMode={!!eventCycle?.areaEvaluation} onClose={() => setDetails(null)} />}
    </div>
  );
}

/**
 * Cartão do evento para celular e tablet (no lugar da tabela de 9 colunas,
 * que espremia o nome até sumir e sobrepunha a data). Mesmos dados e ações.
 */
export function EventCard({ ev, user, onEdit, onMerge, onDelete, readOnly = false, cycleLabel = null, eventCycle = null, areaCounts = null, showScore = true }: Omit<EventRowProps, "gridCols">) {
  const r = deriveEventRow(ev, undefined, eventCycle, areaCounts);
  const isAdmin = hasRole(user, "admin");
  const [details, setDetails] = useState<EventDetailsKind | null>(null);
  const missingShown = r.missing.length > 0 && !r.hasEvals && !r.hasAnyPublication;
  const showPeriod = eventPeriodPosition(ev, eventCycle) !== "inside" && !r.nextCycle;

  return (
    <article
      data-testid={`card-event-${ev.id}`}
      aria-labelledby={`card-event-title-${ev.id}`}
      className="relative h-full flex flex-col rounded-2xl border border-border bg-card overflow-hidden"
    >
      <span aria-hidden className={cn("absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full", accentCls(r, ev))} />

      <div className="px-4 pt-4 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link id={`card-event-title-${ev.id}`} href={`/events/${ev.id}`}
            className={cn("font-condensed block text-[18px] font-black uppercase leading-[1.08] tracking-[-0.005em] text-foreground break-words rounded-sm", FOCUS_RING)}>
            {ev.name}
          </Link>
          <NameMeta ev={ev} pendingRH={r.pendingRH} />
        </div>
        {showScore && (
          <div className="shrink-0 pt-0.5">
            <ScoreBlock align="right" score={r.score} fc={r.fc} label={r.scoreLabel} labelColor={r.scoreLabelColor} isPreview={r.isPreview} previewPartial={r.previewPartial} hasEvals={r.hasEvals} />
          </div>
        )}
      </div>

      <div className="px-4 mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <DateText ev={ev} dateStr={r.dateStr} inline />
        <span className="inline-flex items-center gap-1 font-condensed text-[15px] font-bold tabular-nums text-muted-foreground">
          <Users size={14} aria-hidden /> {ev.participantCount ?? 0}<span className="sr-only"> participantes</span>
        </span>
        <StatusBadgeView ev={ev} badge={r.badge} readOnly={readOnly} nextCycle={r.nextCycle} cycle={eventCycle} />
        {showPeriod && <PeriodBadge ev={ev} cycle={eventCycle} hideAfter={r.nextCycle} />}
        {cycleLabel && <CycleLabelBadge ev={ev} cycleLabel={cycleLabel} />}
      </div>
      {missingShown && (
        <p className="px-4 mt-1.5 font-condensed text-[12px] font-bold uppercase tracking-[0.05em] text-[var(--status-danger-text)]">Sem avaliador: {r.missing.join(", ")}</p>
      )}

      <div className="mx-4 mt-3.5 pt-3 border-t border-border grid grid-cols-3 gap-4">
        <Metrics ev={ev} r={r} isAdmin={isAdmin} onOpen={setDetails}
          wrap={(key, label, node) => (
            <div key={key} className="min-w-0">
              <Eyebrow as="span" className="block mb-2 text-[11.5px]">{label}</Eyebrow>
              {node}
            </div>
          )} />
      </div>
      {details && <EventDetailsDialog ev={ev} kind={details} areaMode={!!eventCycle?.areaEvaluation} onClose={() => setDetails(null)} />}

      <div className="mt-auto px-4 pt-3.5 pb-4 flex items-center justify-between gap-2">
        <PendingPublishBadge ev={ev} />
        <div className="ml-auto flex items-center gap-2">
          <EventActions ev={ev} user={user} readOnly={readOnly} evaluationsHref={r.evaluationsHref} onEdit={onEdit} onMerge={onMerge} onDelete={onDelete} variant="card" />
        </div>
      </div>
    </article>
  );
}
