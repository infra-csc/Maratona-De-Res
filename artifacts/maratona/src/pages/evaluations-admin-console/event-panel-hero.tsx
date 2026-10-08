// Cabeçalho do evento selecionado na Central: quem é o evento, em que pé está
// (selos), a ação de confirmar resultados e o PROGRESSO — quantas respostas
// já chegaram, quantas estão em rascunho e quantas faltam.
import { useState } from "react";
import { AlertTriangle, ArrowLeft, CalendarClock, CalendarDays, CheckCircle, CheckCircle2, Loader2, MapPin } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn, fmtDate, plural } from "@/lib/utils";
import { NEXT_CYCLE_NOTICE } from "../events/rules";
import { Chip, DialogHeading, Eyebrow, StackBar, btnGhost, btnPrimary, btnSecondary, dialogCls } from "./console-ui";
import type { ConfirmResultsMutation } from "./use-event-mutations";
import type { EnrichedEvent } from "./types";

export function EventPanelHero({ selected, canManage, todayStr, confirmResults, onBack }: {
  selected: EnrichedEvent;
  canManage: boolean;
  todayStr: string;
  confirmResults: ConfirmResultsMutation;
  /** Celular/tablet: volta para a fila (a lista fica acima do painel). */
  onBack: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Ainda não aceita avaliação: do próximo ciclo ou o evento não terminou — não é "A fazer".
  const waiting = selected.queueTab === "waiting" && !!selected.opensLabel;
  const areaMode = selected.areaMode;
  const partial = selected.criteria.filter(c => c.state === "partial").length;
  const pending = selected.criteria.filter(c => c.state === "pending").length;
  const fmtFull = (d: string) => fmtDate(d, { day: "2-digit", month: "2-digit", year: "numeric" });
  const sameDay = !selected.endDate || selected.endDate === selected.startDate;
  const place = selected.city ? `${selected.city}${selected.state ? `, ${selected.state}` : ""}` : null;
  const stateChip = selected.isDone
    ? <Chip tone="ok" icon={CheckCircle2}>Concluído</Chip>
    : selected.done > 0 ? <Chip tone="warn">Em andamento</Chip> : <Chip>A fazer</Chip>;

  return (
    <header>
      <div className="px-4 sm:px-5 lg:px-6 pt-4 lg:pt-5 pb-4">
        <button type="button" onClick={onBack} className={cn(btnGhost, "lg:hidden -ml-2 mb-2 px-2")}>
          <ArrowLeft size={15} aria-hidden /> Eventos
        </button>
        <div className="flex flex-col @2xl:flex-row @2xl:items-start justify-between gap-4">
          <div className="min-w-0">
            <Eyebrow>{selected.clientName ? `Evento · ${selected.clientName}` : "Evento"}</Eyebrow>
            <h2 data-testid="panel-event-name" className="font-condensed mt-2 text-[26px] @2xl:text-[30px] font-black uppercase leading-[0.98] tracking-[-0.015em] text-foreground break-words">{selected.name}</h2>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] text-muted-foreground">
              {selected.startDate && <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} aria-hidden />{sameDay ? fmtFull(selected.startDate) : `${fmtDate(selected.startDate)} – ${fmtFull(selected.endDate!)}`}</span>}
              {place && <span className="inline-flex items-center gap-1.5"><MapPin size={14} aria-hidden />{place}</span>}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {waiting ? (
                // Um selo só: "Próximo ciclo" ou "Abre em DD/MM".
                <Chip tone="info" icon={CalendarClock} data-testid="panel-opens" title={selected.nextCycle ? NEXT_CYCLE_NOTICE : "A avaliação abre sozinha no dia seguinte ao fim do evento."}>{selected.opensLabel}</Chip>
              ) : stateChip}
              {(selected.finalCalibratedCriteria > 0 || selected.partialPublishedCount > 0) && (
                <Chip tone="ok" icon={CheckCircle}
                  title={selected.finalCalibratedCriteria > 0
                    ? `${selected.finalCalibratedCriteria} de ${plural(selected.total, "critério")} com publicação final`
                    : `${selected.partialPublishedCount} de ${plural(selected.total, "critério")} com publicação parcial`}>
                  {selected.finalCalibratedCriteria > 0 ? "Publicação final" : "Publicação parcial"}
                </Chip>
              )}
              {selected.isDone && selected.unassigned > 0 && !!selected.endDate && selected.endDate < todayStr && (
                <Chip tone="warn" icon={AlertTriangle}>Sem avaliador</Chip>
              )}
            </div>
          </div>
          {canManage && (
            <div className="flex flex-col items-start @2xl:items-end gap-1.5 @2xl:shrink-0">
              <button
                type="button"
                disabled={!selected.isDone || confirmResults.isPending}
                onClick={() => setConfirmOpen(true)}
                className={btnPrimary}
                data-testid="button-confirm-results"
              >
                {confirmResults.isPending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <CheckCircle2 size={15} aria-hidden />}
                {confirmResults.isPending ? "Confirmando..." : "Confirmar resultados"}
              </button>
              {!selected.isDone && (
                <p className="text-[12.5px] text-muted-foreground @2xl:text-right max-w-[260px]">Libera quando todos os critérios estiverem completos.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progresso: respondidos × rascunho × pendentes (× sem avaliador no fluxo antigo). */}
      <div className="border-t border-border bg-secondary/35 px-4 sm:px-5 lg:px-6 py-3.5" data-testid="panel-progress">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <p className="flex items-baseline gap-2">
            <span className="font-condensed text-[30px] font-black leading-none tracking-[-0.02em] tabular-nums text-foreground">{selected.done}<span className="text-muted-foreground text-[20px]">/{selected.total}</span></span>
            <span className="text-[13.5px] text-muted-foreground">{areaMode ? (selected.total === 1 ? "resposta das áreas" : "respostas das áreas") : (selected.total === 1 ? "critério completo" : "critérios completos")}</span>
          </p>
          <span className="font-condensed text-[20px] font-black tabular-nums text-foreground">{selected.pct}%</span>
        </div>
        <StackBar
          className="mt-2.5"
          label={`${selected.done} respondidos, ${partial} em rascunho, ${pending} pendentes${selected.unassigned > 0 ? `, ${selected.unassigned} sem avaliador` : ""}`}
          parts={[
            { value: selected.done, cls: "bg-[var(--status-ok)]" },
            { value: partial, cls: "bg-[var(--status-warn)]" },
            { value: pending, cls: "bg-muted-foreground/25" },
            { value: selected.unassigned, cls: "bg-[var(--status-danger)]" },
          ]}
        />
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground" aria-hidden>
          <li className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--status-ok)]" />{plural(selected.done, "respondido", "respondidos")}</li>
          {partial > 0 && <li className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--status-warn)]" />{plural(partial, "em rascunho", "em rascunho")}</li>}
          <li className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-muted-foreground/40" />{plural(pending, "pendente", "pendentes")}</li>
          {selected.unassigned > 0 && <li className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--status-danger)]" />{plural(selected.unassigned, "sem avaliador", "sem avaliador")}</li>}
        </ul>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className={dialogCls} data-testid="dialog-confirm-results">
          <DialogHeading
            icon={CheckCircle2}
            tone="brand"
            Title={AlertDialogTitle}
            Description={AlertDialogDescription}
            title="Confirmar resultados?"
            description={<><b className="font-semibold text-foreground">{selected.name}</b> passa a contar na elegibilidade dos colaboradores ao bônus.</>}
          />
          <AlertDialogFooter className="gap-2 sm:gap-2 sm:space-x-0">
            <AlertDialogCancel className={cn(btnSecondary, "mt-0")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className={btnPrimary} onClick={() => confirmResults.mutate({ id: selected.id })}>
              <CheckCircle2 size={15} aria-hidden /> Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
