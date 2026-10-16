import type { Dispatch, SetStateAction } from "react";
import { BellRing, CheckCircle2, ClipboardCheck, ListChecks, UsersRound } from "lucide-react";
import { cn, plural } from "@/lib/utils";
import { initials } from "./helpers";
import { EventCombobox } from "./pickers";
import { Chip, EmptyBlock, Eyebrow, Segmented, btnPrimary, btnSmall, surfaceCls } from "./console-ui";
import type { ToastFn } from "./use-event-mutations";
import type { AreaResponderRow, ConsoleView, EnrichedEvent, EvaluatorsScope, EventEvaluatorCard, GlobalEvaluatorCard } from "./types";

type SetState<T> = Dispatch<SetStateAction<T>>;
const small = cn(btnSmall, "min-h-11 lg:min-h-8 px-2.5 text-[12.5px]");

function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden className="w-9 h-9 rounded-full bg-secondary text-foreground inline-flex items-center justify-center shrink-0 font-condensed text-[13px] font-black">
      {initials(name)}
    </span>
  );
}

/**
 * Ciclo por área: quem respondeu, agrupado por área — nome, quantos critérios
 * respondeu e em quais eventos (visão global). Sem "atribuir" nem "cobrar":
 * qualquer avaliador da área responde.
 */
function AreaRespondersList({ rows, scope }: { rows: AreaResponderRow[]; scope: EvaluatorsScope }) {
  if (rows.length === 0) {
    return (
      <div className={surfaceCls}>
        <EmptyBlock icon={UsersRound} testId="area-responders-empty" title={scope === "all" ? "Ninguém respondeu ainda neste ciclo" : "Ninguém respondeu ainda neste evento"}>
          No ciclo por área, qualquer avaliador da área responde. Quem enviar aparece aqui, com a área e os critérios.
        </EmptyBlock>
      </div>
    );
  }
  const areas = [...new Set(rows.map(r => r.area))];
  return (
    <div className="grid gap-4 xl:grid-cols-2 items-start" data-testid="area-responders">
      {areas.map(area => {
        const list = rows.filter(r => r.area === area);
        return (
          <section key={area} className={cn(surfaceCls, "overflow-hidden")} aria-label={`Área ${area}`}>
            <h3 className="px-4 py-3 flex items-baseline justify-between gap-2 border-b border-border">
              <span className="font-condensed text-[17px] font-black uppercase leading-tight text-foreground">{area}</span>
              <span className="text-[12.5px] text-muted-foreground">{plural(list.reduce((n, r) => n + r.answered, 0), "critério respondido", "critérios respondidos")}</span>
            </h3>
            <ul className="divide-y divide-border">
              {list.map(r => (
                <li key={r.key} className="px-4 py-3 flex items-start gap-3" data-testid="area-responder-row">
                  <Avatar name={r.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className="text-[14.5px] font-semibold text-foreground break-words">{r.name}</span>
                      <Chip tone="ok" icon={CheckCircle2}>{plural(r.answered, "critério", "critérios")}</Chip>
                    </div>
                    {scope === "all" && (
                      <p className="text-[12.5px] mt-1 leading-snug text-muted-foreground break-words">
                        {plural(r.events.length, "evento", "eventos")}: {r.events.map(e => e.name).join(" · ")}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Uma linha de avaliador (fluxo antigo): progresso, pendências e ações. */
function EvaluatorRow({ name, sub, submitted, assigned, pct, label, pendingEvents, onCharge, onSeeCriteria }: {
  name: string; sub: string; submitted: number; assigned: number; pct: number; label: string;
  pendingEvents?: { id: number; name: string }[]; onCharge: () => void; onSeeCriteria: () => void;
}) {
  const done = submitted >= assigned;
  return (
    <li className="px-4 py-3.5 grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] md:items-center">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar name={name} />
        <div className="min-w-0">
          <p className="text-[14.5px] font-semibold text-foreground truncate">{name}</p>
          <p className="text-[12.5px] text-muted-foreground truncate">{sub}</p>
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <span className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden" aria-hidden>
            <span className={cn("block h-full rounded-full", done ? "bg-[var(--status-ok)]" : "bg-[var(--status-warn)]")} style={{ width: `${pct}%` }} />
          </span>
          <span className="font-condensed text-[13px] font-bold tabular-nums text-muted-foreground shrink-0">{submitted}/{assigned}</span>
          <Chip tone={done ? "ok" : "warn"}>{label}</Chip>
        </div>
        {pendingEvents && pendingEvents.length > 0 && (
          <p className="mt-1.5 text-[12.5px] leading-snug text-muted-foreground"><b className="font-semibold text-foreground">Falta:</b> {pendingEvents.map(e => e.name).join(" · ")}</p>
        )}
      </div>
      <div className="flex gap-1.5 md:justify-end">
        <button type="button" onClick={onCharge} className={small}><BellRing size={13} aria-hidden /> Cobrar</button>
        <button type="button" onClick={onSeeCriteria} className={small}><ListChecks size={13} aria-hidden /> Ver critérios</button>
      </div>
    </li>
  );
}

/** Aba Avaliadores — visão global (todos os eventos do ciclo) ou por evento. */
export function EvaluatorsView(props: {
  evaluatorsScope: EvaluatorsScope;
  setEvaluatorsScope: SetState<EvaluatorsScope>;
  enrichedEvents: EnrichedEvent[];
  selected: EnrichedEvent | null;
  setSelectedEventId: SetState<number | null>;
  globalEvaluatorCards: GlobalEvaluatorCard[];
  evaluatorCards: EventEvaluatorCard[];
  toast: ToastFn;
  setEvaluatorFilter: SetState<string>;
  setView: SetState<ConsoleView>;
  /** Ciclo por área: ninguém é designado — a aba mostra quem RESPONDEU, por área. */
  areaMode?: boolean;
  globalAreaResponders?: AreaResponderRow[];
  eventAreaResponders?: AreaResponderRow[];
}) {
  const {
    evaluatorsScope, setEvaluatorsScope, enrichedEvents, selected, setSelectedEventId,
    globalEvaluatorCards, evaluatorCards, toast, setEvaluatorFilter, setView,
    areaMode = false, globalAreaResponders = [], eventAreaResponders = [],
  } = props;
  const responders = evaluatorsScope === "all" ? globalAreaResponders : eventAreaResponders;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
        <Segmented<EvaluatorsScope>
          label="Abrangência"
          value={evaluatorsScope}
          onChange={setEvaluatorsScope}
          options={[{ value: "all", label: "Todos os eventos" }, { value: "event", label: "Este evento" }]}
        />
        {evaluatorsScope === "event" && (
          <EventCombobox events={enrichedEvents} value={selected?.id ?? null} onChange={setSelectedEventId} />
        )}
        <p className="text-[13.5px] text-muted-foreground" aria-live="polite">
          {areaMode
            ? <>{plural(new Set(responders.map(r => r.name)).size, "pessoa respondeu", "pessoas responderam")} · {plural(responders.reduce((n, r) => n + r.answered, 0), "critério", "critérios")}</>
            : evaluatorsScope === "all"
              ? <>{plural(globalEvaluatorCards.length, "avaliador", "avaliadores")} · {globalEvaluatorCards.filter(c => c.submitted < c.assigned).length} com pendência</>
              : null}
        </p>
      </div>

      {areaMode ? (
        <AreaRespondersList rows={responders} scope={evaluatorsScope} />
      ) : evaluatorsScope === "all" ? (
        globalEvaluatorCards.length === 0 ? (
          <div className={surfaceCls}><EmptyBlock icon={UsersRound} title="Nenhum avaliador atribuído no ciclo">Atribua avaliadores aos critérios dos eventos para acompanhar o progresso aqui.</EmptyBlock></div>
        ) : (
          <section className={cn(surfaceCls, "overflow-hidden")} aria-label="Avaliadores do ciclo">
            <Eyebrow as="h2" className="px-4 py-3 border-b border-border">Avaliadores do ciclo</Eyebrow>
            <ul className="divide-y divide-border">
              {globalEvaluatorCards.map(av => (
                <EvaluatorRow key={av.id} name={av.name} sub={`${av.submitted} de ${plural(av.assigned, "critério")} no ciclo`} submitted={av.submitted} assigned={av.assigned} pct={av.pct} label={av.label}
                  pendingEvents={av.pendingEvents}
                  onCharge={() => toast({ title: `${plural(av.assigned - av.submitted, "pendência", "pendências")} no ciclo`, description: `${av.name} ainda não enviou ${av.assigned - av.submitted} de ${plural(av.assigned, "critério")}.` })}
                  onSeeCriteria={() => { setEvaluatorFilter(av.name); setView("assign"); }} />
              ))}
            </ul>
          </section>
        )
      ) : (
        evaluatorCards.length === 0 ? (
          <div className={surfaceCls}>
            <EmptyBlock icon={UsersRound} title="Nenhum avaliador atribuído neste evento"
              action={<button type="button" onClick={() => setView("assign")} className={btnPrimary}><ClipboardCheck size={15} aria-hidden /> Ir para Atribuição</button>}>
              Atribua avaliadores aos critérios do evento para ver o progresso aqui.
            </EmptyBlock>
          </div>
        ) : (
          <section className={cn(surfaceCls, "overflow-hidden")} aria-label="Avaliadores do evento">
            <Eyebrow as="h2" className="px-4 py-3 border-b border-border">Avaliadores · {selected?.name}</Eyebrow>
            <ul className="divide-y divide-border">
              {evaluatorCards.map(av => (
                <EvaluatorRow key={av.id} name={av.name} sub={av.area} submitted={av.submitted} assigned={av.assigned} pct={av.pct} label={av.label}
                  onCharge={() => toast({ title: `${plural(av.assigned - av.submitted, "pendência", "pendências")} neste evento`, description: `${av.name} ainda não enviou ${av.assigned - av.submitted} de ${plural(av.assigned, "critério atribuído", "critérios atribuídos")}.` })}
                  onSeeCriteria={() => { setEvaluatorFilter(av.name); setView("assign"); }} />
              ))}
            </ul>
          </section>
        )
      )}
    </div>
  );
}
