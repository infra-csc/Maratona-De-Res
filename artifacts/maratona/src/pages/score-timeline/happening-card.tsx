import { useState } from "react";
import type { ScoreTimelineEntry } from "@workspace/api-client-react";
import { ArrowRight, Award, CalendarCheck2, CheckCircle2, ChevronDown, Gavel, LogIn, Megaphone, RefreshCw, SlidersHorizontal, TrendingDown, TrendingUp, UserMinus, UserPlus } from "lucide-react";
import { CONDENSED, GOOD_TEXT, DANGER_TEXT } from "@/lib/premium-theme";
import { brl, deltaOf, faixaChanged, moveOf, score, signed, timeOf, type Category, type Happening } from "./describe";

const ICON: Record<Category, typeof Award> = {
  event: CalendarCheck2, penalty: Gavel, merit: Award, calibration: SlidersHorizontal,
  publish: Megaphone, confirm: CheckCircle2, exclusion: UserMinus, other: RefreshCw,
};
/** Cor só no nó (ícone); textos ficam nos tokens de texto. */
const NODE: Record<Category, string> = {
  event: "var(--viz-series-1)", penalty: "var(--status-danger)", merit: "var(--status-ok)",
  calibration: "var(--status-info)", publish: "var(--status-warn)", confirm: "var(--viz-series-1)",
  exclusion: "#5f6b7a", other: "var(--muted-foreground)",
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
    <li className="relative grid grid-cols-[40px_32px_1fr] md:grid-cols-[52px_32px_1fr] gap-x-2.5 md:gap-x-3 pb-5 last:pb-1" data-testid={`happening-${h.id}`}>
      <span aria-hidden className="absolute left-[calc(40px+10px+15px)] md:left-[calc(52px+12px+15px)] top-8 bottom-0 w-px" style={{ backgroundColor: "var(--border)" }} />
      <time dateTime={h.at} className="pt-1.5 text-right text-[12px] font-bold tabular-nums" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>
        {timeOf(h.at)}
      </time>
      <span aria-hidden className="relative z-[1] mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: info ? "var(--card)" : NODE[h.category], border: info ? `2px solid ${NODE[h.category]}` : "2px solid var(--card)", color: info ? NODE[h.category] : "#fff", boxShadow: "0 0 0 3px var(--background)" }}>
        <Icon size={15} strokeWidth={2.4} />
      </span>

      <article className="min-w-0 rounded-xl overflow-hidden" style={{ backgroundColor: info ? "transparent" : "var(--card)", border: `1px ${info ? "dashed" : "solid"} var(--border)` }}>
        <header className="px-4 py-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-semibold leading-snug break-words" style={{ color: info ? "var(--muted-foreground)" : "var(--foreground)" }}>{h.title}</h3>
            {h.detail && <p className="mt-0.5 text-[13px] leading-snug break-words" style={{ color: "var(--muted-foreground)" }}>{h.detail}</p>}
            {(h.by || h.kind === "reconstructed" || h.pendingPublish) && (
              <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.05em", color: "var(--muted-foreground)" }}>
                {h.by && <span>por {h.by}</span>}
                {h.kind === "reconstructed" && <span title="Remontado a partir dos dados atuais: eventos confirmados e lançamentos, na ordem em que entraram na nota.">remontado</span>}
                {h.pendingPublish && <span style={{ color: "var(--status-warn-text)" }}>só muda a nota quando publicar</span>}
              </p>
            )}
          </div>
          {(h.people.length > 1 || partial) && (
            <p className="shrink-0 basis-full sm:basis-auto text-[12px] tabular-nums text-left sm:text-right" style={{ color: "var(--muted-foreground)" }}>
              <strong className="text-[14px]" style={{ color: "var(--foreground)" }}>{h.people.length}</strong>
              {partial ? ` de ${h.totalPeople} pessoas` : ` ${h.people.length === 1 ? "pessoa" : "pessoas"}`}
              {ups > 0 && <span className="ml-2 font-bold" style={{ color: GOOD_TEXT }} title={`${ups} subiram`}>▲{ups}</span>}
              {downs > 0 && <span className="ml-1.5 font-bold" style={{ color: DANGER_TEXT }} title={`${downs} caíram`}>▼{downs}</span>}
              {entered > 0 && <span className="ml-1.5 font-bold" title={`${entered} entraram na nota`}>+{entered} na nota</span>}
              {left > 0 && <span className="ml-1.5 font-bold" title={`${left} saíram do ciclo`}>−{left} do ciclo</span>}
            </p>
          )}
        </header>

        {h.people.length > 0 && (
          <ul className="border-t" style={{ borderColor: "var(--border)" }}>
            {visible.map(p => <PersonRow key={p.id} p={p} onPick={focusPerson ? null : onPickPerson} platoonColor={platoonColor} />)}
          </ul>
        )}
        {h.people.length > COLLAPSED && (
          <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-[12px] font-bold uppercase border-t transition-colors hover:bg-[var(--secondary)]"
            style={{ fontFamily: CONDENSED, letterSpacing: "0.04em", borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
            <ChevronDown size={14} aria-hidden style={{ transform: open ? "rotate(180deg)" : undefined }} />
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
  const name = p.employeeName ?? "Colaborador";
  return (
    <li className="px-4 py-2.5 grid gap-x-4 gap-y-1.5 md:grid-cols-[minmax(160px,1.2fr)_auto_1.6fr] items-center border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
      <div className="min-w-0">
        {onPick && p.employeeId != null ? (
          <button type="button" onClick={() => onPick(p.employeeId!)} className="text-left text-[13px] font-semibold max-w-full break-words hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            title={`Ver só ${name}`}>
            {name}
          </button>
        ) : (
          <span className="text-[13px] font-semibold break-words">{name}</span>
        )}
        {p.type === "event_counted" && p.eventScore != null && (
          <span className="ml-2 text-[12px]" style={{ color: "var(--muted-foreground)" }}>evento {score(p.eventScore)}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums" style={{ fontFamily: CONDENSED }}>
        <span className="text-[14px] font-bold" style={{ color: "var(--muted-foreground)" }}>{score(p.finalBefore)}</span>
        <ArrowRight size={13} aria-label="para" style={{ color: "var(--muted-foreground)" }} />
        <span className="text-[18px] font-black leading-none">{score(p.finalAfter)}</span>
        {d != null && d !== 0 && (
          <span className="ml-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[12px] font-bold"
            style={{ color: d > 0 ? GOOD_TEXT : DANGER_TEXT, backgroundColor: d > 0 ? "var(--status-ok-bg)" : "var(--status-danger-bg)" }}>
            {d > 0 ? <TrendingUp size={12} aria-hidden /> : <TrendingDown size={12} aria-hidden />}{signed(d)}
          </span>
        )}
        {move === "same" && <span className="ml-1 text-[12px]" style={{ fontFamily: "inherit", color: "var(--muted-foreground)" }}>nota igual</span>}
        {(move === "entered" || move === "left") && (
          <span className="ml-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[12px] font-bold whitespace-nowrap"
            style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}>
            {move === "entered" ? <LogIn size={12} aria-hidden /> : <UserMinus size={12} aria-hidden />}
            {move === "entered" ? "entrou na nota" : "saiu do ciclo"}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] md:justify-end min-w-0">
        {faixa && (
          <span className="flex flex-wrap items-center gap-1.5 min-w-0 max-w-full">
            <FaixaChip name={p.platoonBefore} color={platoonColor(p.platoonBefore)} />
            <ArrowRight size={12} aria-label="para" className="shrink-0" style={{ color: "var(--muted-foreground)" }} />
            <FaixaChip name={p.platoonAfter} color={platoonColor(p.platoonAfter)} strong />
          </span>
        )}
        {bonus && (
          <span className="tabular-nums" style={{ color: "var(--muted-foreground)" }}>
            Bônus {brl(p.bonusBefore)} → <strong style={{ color: (p.bonusAfter ?? 0) > (p.bonusBefore ?? 0) ? GOOD_TEXT : DANGER_TEXT }}>{brl(p.bonusAfter)}</strong>
          </span>
        )}
        {elig && <span className="font-semibold" style={{ color: p.eligibleAfter ? GOOD_TEXT : DANGER_TEXT }}>{p.eligibleAfter ? "Ficou elegível" : "Deixou de ser elegível"}</span>}
        {p.eventsBefore != null && p.eventsAfter != null && p.eventsBefore !== p.eventsAfter && (
          <span style={{ color: "var(--muted-foreground)" }}>{p.eventsBefore} → {p.eventsAfter} eventos</span>
        )}
      </div>
    </li>
  );
}

/** Nome da faixa nunca é cortado: em tela estreita o chip quebra a linha. */
export function FaixaChip({ name, color, strong }: { name: string | null | undefined; color: string | null; strong?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 max-w-full" style={{ backgroundColor: "var(--secondary)", fontWeight: strong ? 700 : 500 }}>
      <span aria-hidden className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color ?? "var(--muted-foreground)", boxShadow: "inset 0 0 0 1px var(--border)" }} />
      <span className="min-w-0 break-words">{name ?? "Sem faixa"}</span>
    </span>
  );
}
