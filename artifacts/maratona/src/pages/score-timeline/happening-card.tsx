// Um acontecimento na linha do dia: o nó (ícone no tom da categoria), a causa
// (título, detalhe, quem fez, selos) e as pessoas afetadas, com antes → depois,
// variação, faixa, bônus, elegibilidade e nº de eventos.
import { useState } from "react";
import type { ScoreTimelineEntry } from "@workspace/api-client-react";
import { ArrowRight, Award, CalendarCheck2, CheckCircle2, ChevronDown, Clock, Gavel, History, LogIn, Megaphone, RefreshCw, SlidersHorizontal, UserMinus, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip, DeltaPill, FaixaChip, FOCUS_RING, UP_TEXT, DOWN_TEXT } from "./tl-ui";
import { brl, deltaOf, faixaChanged, moveOf, score, timeOf, type Category, type Happening } from "./describe";

export { FaixaChip } from "./tl-ui";

const ICON: Record<Category, typeof Award> = {
  event: CalendarCheck2, penalty: Gavel, merit: Award, calibration: SlidersHorizontal,
  publish: Megaphone, confirm: CheckCircle2, exclusion: UserMinus, other: RefreshCw,
};
/** Tom do nó por categoria (fundo suave + ícone na tinta do status: contraste AA nos dois temas). */
const NODE: Record<Category, string> = {
  event: "bg-primary text-primary-foreground",
  confirm: "bg-primary text-primary-foreground",
  penalty: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
  merit: "bg-[var(--status-ok-bg)] text-[var(--status-ok-text)]",
  calibration: "bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
  publish: "bg-[var(--status-warn-bg)] text-[var(--status-warn-text)]",
  exclusion: "bg-secondary text-foreground",
  other: "bg-secondary text-muted-foreground",
};
const COLLAPSED = 6;

export function HappeningCard({ h, onPickPerson, platoonColor, focusPerson }: {
  h: Happening;
  onPickPerson: (employeeId: number) => void;
  platoonColor: (name: string | null | undefined) => string | null;
  /** Com colaborador filtrado, a linha dele já é o assunto: sem botão de filtrar. */
  focusPerson: boolean;
}) {
  const [open, setOpen] = useState(false);
  const Icon = h.type === "cycle_included" ? UserPlus : ICON[h.category] ?? RefreshCw;
  const info = h.kind === "info";
  const visible = open ? h.people : h.people.slice(0, COLLAPSED);
  let ups = 0, downs = 0, entered = 0, left = 0;
  for (const p of h.people) {
    const m = moveOf(p);
    if (m === "up") ups++; else if (m === "down") downs++; else if (m === "entered") entered++; else if (m === "left") left++;
  }
  const partial = h.people.length !== h.totalPeople;

  return (
    <li className="relative grid grid-cols-[32px_minmax(0,1fr)] md:grid-cols-[44px_32px_minmax(0,1fr)] gap-x-3 pb-4 last:pb-0" data-testid={`happening-${h.id}`}>
      {/* Fio da linha do tempo, ligando os nós do dia. */}
      <span aria-hidden className="absolute left-[15.5px] md:left-[calc(44px+12px+15.5px)] top-9 bottom-0 w-px bg-border" />
      <time dateTime={h.at} className="hidden md:block pt-2 text-right font-condensed text-[13px] font-bold tabular-nums text-muted-foreground">
        {timeOf(h.at)}
      </time>
      <span aria-hidden className={cn("relative z-[1] mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-background", info ? "bg-card border border-dashed border-border text-muted-foreground" : NODE[h.category])}>
        <Icon size={15} strokeWidth={2.2} />
      </span>

      <article className={cn("@container min-w-0 rounded-xl border overflow-hidden transition-[border-color,box-shadow] duration-150", info ? "border-dashed border-border bg-transparent" : "border-border bg-card hover:border-foreground/20")}>
        <header className="px-3.5 py-3 sm:px-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <h3 className={cn("text-[14.5px] font-semibold leading-snug break-words", info ? "text-muted-foreground" : "text-foreground")}>{h.title}</h3>
            {h.detail && <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground break-words">{h.detail}</p>}
            <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[12.5px] text-muted-foreground">
              <span className="md:hidden inline-flex items-center gap-1 font-condensed text-[13px] font-bold tabular-nums"><Clock size={12} aria-hidden />{timeOf(h.at)}</span>
              {h.by && <span>por <span className="font-semibold text-foreground">{h.by}</span></span>}
              {h.kind === "reconstructed" && (
                <Chip icon={History} className="h-5 text-[11px]" title="Remontado a partir dos dados atuais: eventos confirmados e lançamentos, na ordem em que entraram na nota.">Remontado</Chip>
              )}
              {h.pendingPublish && <Chip tone="warn" icon={Clock} className="h-5 text-[11px]">Só muda a nota quando publicar</Chip>}
            </p>
          </div>
          {(h.people.length > 1 || partial) && (
            <p className="shrink-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] tabular-nums text-muted-foreground" data-testid="happening-people-count">
              <span><strong className="font-condensed text-[16px] font-black text-foreground">{h.people.length}</strong>{partial ? ` de ${h.totalPeople} pessoas` : " pessoas"}</span>
              {ups > 0 && <span className={cn("font-bold", UP_TEXT)} title={`${ups} subiram`}><span aria-hidden>▲</span>{ups}<span className="sr-only"> subiram</span></span>}
              {downs > 0 && <span className={cn("font-bold", DOWN_TEXT)} title={`${downs} caíram`}><span aria-hidden>▼</span>{downs}<span className="sr-only"> caíram</span></span>}
              {entered > 0 && <span className="font-semibold text-foreground">+{entered} na nota</span>}
              {left > 0 && <span className="font-semibold text-foreground">−{left} do ciclo</span>}
            </p>
          )}
        </header>

        {h.people.length > 0 && (
          <ul className="border-t border-border divide-y divide-border">
            {visible.map(p => <PersonRow key={p.id} p={p} onPick={focusPerson ? null : onPickPerson} platoonColor={platoonColor} />)}
          </ul>
        )}
        {h.people.length > COLLAPSED && (
          <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
            className={cn("w-full flex items-center justify-center gap-1.5 min-h-11 lg:min-h-9 font-condensed text-[12.5px] font-bold uppercase tracking-[0.05em] border-t border-border text-muted-foreground transition-colors duration-150 hover:bg-secondary/60 hover:text-foreground", FOCUS_RING, "focus-visible:ring-inset focus-visible:ring-offset-0")}>
            <ChevronDown size={14} aria-hidden className={cn("transition-transform duration-150 motion-reduce:transition-none", open && "rotate-180")} />
            {open ? "Mostrar menos" : `Ver todas as ${h.people.length} pessoas`}
          </button>
        )}
      </article>
    </li>
  );
}

function PersonRow({ p, onPick, platoonColor }: { p: ScoreTimelineEntry; onPick: ((id: number) => void) | null; platoonColor: (n: string | null | undefined) => string | null }) {
  const d = deltaOf(p);
  const move = moveOf(p);
  const faixa = faixaChanged(p);
  const bonus = p.bonusBefore != null && p.bonusAfter != null && p.bonusBefore !== p.bonusAfter;
  const elig = p.eligibleBefore != null && p.eligibleAfter != null && p.eligibleBefore !== p.eligibleAfter;
  const events = p.eventsBefore != null && p.eventsAfter != null && p.eventsBefore !== p.eventsAfter;
  const name = p.employeeName ?? "Colaborador";
  const hasSide = faixa || bonus || elig || events;
  return (
    <li className="px-3.5 sm:px-4 py-2.5 grid gap-x-4 gap-y-2 @md:grid-cols-[minmax(0,1fr)_auto] @md:items-center @2xl:grid-cols-[minmax(150px,1.1fr)_auto_minmax(0,1.5fr)]">
      <div className="min-w-0 flex flex-wrap items-baseline gap-x-2">
        {onPick && p.employeeId != null ? (
          <button type="button" onClick={() => onPick(p.employeeId!)} title={`Ver só ${name}`}
            className={cn("-mx-1 px-1 min-h-8 text-left text-[13.5px] font-semibold text-foreground max-w-full break-words rounded underline-offset-2 decoration-foreground/30 hover:underline", FOCUS_RING)}>
            {name}
          </button>
        ) : (
          <span className="text-[13.5px] font-semibold text-foreground break-words">{name}</span>
        )}
        {p.type === "event_counted" && p.eventScore != null && (
          <span className="text-[12.5px] text-muted-foreground tabular-nums">nota do evento {score(p.eventScore)}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
        <span className="font-condensed text-[15px] font-bold text-muted-foreground">{score(p.finalBefore)}</span>
        <ArrowRight size={13} aria-label="para" className="text-muted-foreground" />
        <span className="font-condensed text-[19px] font-black leading-none text-foreground">{score(p.finalAfter)}</span>
        {d != null && d !== 0 && <DeltaPill d={d} className="ml-0.5" />}
        {move === "same" && <span className="text-[12.5px] text-muted-foreground">nota igual</span>}
        {(move === "entered" || move === "left") && (
          <Chip icon={move === "entered" ? LogIn : UserMinus} tone={move === "left" ? "danger" : "neutral"} className="ml-0.5">
            {move === "entered" ? "Entrou na nota" : "Saiu do ciclo"}
          </Chip>
        )}
      </div>
      {hasSide && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] @md:col-span-2 @2xl:col-span-1 @2xl:justify-end min-w-0">
          {faixa && (
            <span className="flex flex-wrap items-center gap-1.5 min-w-0 max-w-full">
              <span className="sr-only">Faixa:</span>
              <FaixaChip name={p.platoonBefore} color={platoonColor(p.platoonBefore)} />
              <ArrowRight size={12} aria-label="para" className="shrink-0 text-muted-foreground" />
              <FaixaChip name={p.platoonAfter} color={platoonColor(p.platoonAfter)} strong />
            </span>
          )}
          {bonus && (
            <span className="tabular-nums text-muted-foreground whitespace-nowrap">
              Bônus {brl(p.bonusBefore)} → <strong className={(p.bonusAfter ?? 0) > (p.bonusBefore ?? 0) ? UP_TEXT : DOWN_TEXT}>{brl(p.bonusAfter)}</strong>
            </span>
          )}
          {elig && <span className={cn("font-semibold", p.eligibleAfter ? UP_TEXT : DOWN_TEXT)}>{p.eligibleAfter ? "Ficou elegível" : "Deixou de ser elegível"}</span>}
          {events && <span className="tabular-nums text-muted-foreground whitespace-nowrap">{p.eventsBefore} → {p.eventsAfter} eventos</span>}
        </div>
      )}
    </li>
  );
}
