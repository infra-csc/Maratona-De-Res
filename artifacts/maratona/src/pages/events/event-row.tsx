// Uma linha da tabela de eventos: nome, data, barras, nota, badge de status
// (com atalho para o próximo passo) e o menu de ações por papel.
import { Link } from "wouter";
import type { User } from "@workspace/api-client-react";
import { ChevronRight, Users, GitMerge, SlidersHorizontal, Trash2, Pencil, MoreHorizontal, ClipboardList } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { hasRole } from "@/lib/auth-context";
import { fmtNum } from "@/lib/utils";
import { CONDENSED, GOOD, AMBER, AMBER_TEXT, DANGER_TEXT, GOOD_TEXT } from "@/lib/premium-theme";
import { MiniBar, CalBar } from "./bars";
import { deriveEventRow } from "./rules";
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
};

export function EventRow({ ev, user, gridCols, onEdit, onMerge, onDelete }: EventRowProps) {
  const {
    score, fc, total, evalTotal, evalDone, finalPubCount, partialOnlyCount, isPureHistorical,
    hasEvals, hasAnyPublication, missing, evaluationsHref, evalTooltip, accentColor,
    scoreLabel, scoreLabelColor, evalColor, dateStr, badge,
  } = deriveEventRow(ev);

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
        <div className="flex flex-wrap items-center gap-x-1.5 mt-0.5">
          {!ev.criteriaConfirmed && !hasEvals && !hasAnyPublication && (
            <span className="text-[11px] font-bold uppercase" title="Aguardando o RH confirmar os critérios do evento" style={{ color: DANGER_TEXT }}>Aguardando RH ·</span>
          )}
          {!ev.resultsConfirmed && ev.criteriaConfirmed && (
            <span className="text-[11px] font-bold uppercase" title="Resultados não confirmados: ainda não contam na elegibilidade nem na nota dos colaboradores" style={{ color: AMBER_TEXT }}>Não confirmado ·</span>
          )}
          <span className="text-[11px] truncate" style={{ color: "var(--muted-foreground)" }}>
            {[ev.clientName, ev.city].filter(Boolean).join(" · ")}
          </span>
        </div>
        {missing.length > 0 && !hasEvals && !hasAnyPublication && (
          <p className="text-[11px] font-bold uppercase truncate mt-0.5" style={{ color: DANGER_TEXT }}>
            Sem aval.: {missing.join(", ")}
          </p>
        )}
      </div>

      {/* Date */}
      <div className="px-3.5 py-3 text-xs font-semibold whitespace-nowrap">{dateStr}</div>

      {/* Participants */}
      <div className="px-3.5 py-3 flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
        <Users size={12} />
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
      <div className="px-3.5 py-3 text-center">
        {score != null ? (
          <div>
            <span className="font-black text-lg leading-none block" style={{ fontFamily: CONDENSED, color: fc ? GOOD_TEXT : "var(--foreground)" }}>
              {fmtNum(score, 1)}
            </span>
            <span className="text-[11px] font-bold uppercase" style={{ color: scoreLabelColor }}>{scoreLabel}</span>
          </div>
        ) : (
          <span className="text-sm italic opacity-40">—</span>
        )}
      </div>

      {/* Status badge */}
      <div className="px-3.5 py-3">
        {badge.next ? (
          <Link
            href={badge.next.href}
            title={badge.next.title}
            data-testid={`badge-next-step-${ev.id}`}
            className="text-[11px] font-bold uppercase px-2 py-1 rounded-full whitespace-nowrap inline-flex items-center gap-1 transition-opacity hover:opacity-80 underline-offset-2 hover:underline"
            style={{ backgroundColor: badge.bg, color: badge.fg }}
          >
            {badge.label} <ChevronRight size={9} aria-hidden="true" />
          </Link>
        ) : (
          <span className="text-[11px] font-bold uppercase px-2 py-1 rounded-full whitespace-nowrap" style={{ backgroundColor: badge.bg, color: badge.fg }}>{badge.label}</span>
        )}
      </div>

      {/* Action */}
      <div className="px-2.5 py-3 flex items-center justify-center gap-1.5">
        <Link
          href={evaluationsHref}
          data-testid={`link-evaluations-event-${ev.id}`}
          title="Avaliações deste evento"
          aria-label={`Avaliações de ${ev.name}`}
          className="h-7 w-7 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70"
          style={{ backgroundColor: "var(--secondary)", border: "2px solid var(--border)", color: "var(--foreground)" }}
        >
          <ClipboardList size={13} aria-hidden="true" />
        </Link>
        <Link
          href={`/events/${ev.id}`}
          data-testid={`button-view-event-${ev.id}`}
          title="Gerenciar evento"
          aria-label={`Gerenciar ${ev.name}`}
          className="h-7 w-7 rounded-lg flex items-center justify-center transition-opacity hover:opacity-80"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          <ChevronRight size={13} aria-hidden="true" />
        </Link>
        {user && (["admin", "rh", "diretoria"].includes(user.role) || hasRole(user, "operador")) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Mais ações para ${ev.name}`}
                title="Mais ações"
                className="h-7 w-7 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70"
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
      </div>
    </div>
  );
}
