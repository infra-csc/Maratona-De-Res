// Peças visuais da tela Ciclos (lista, ciclo atual, histórico e diálogos). A
// base — Chip, Eyebrow, botões, cabeçalho de diálogo, campos, faixa de
// indicadores, blocos de vazio/erro — vem das telas já redesenhadas
// (Avaliações, Calibração, Central, Eventos e Resultados): um produto só.
import type { CycleSummary } from "@workspace/api-client-react";
import { CalendarClock, CircleDot, Lock, Star } from "lucide-react";
import { cn, fmtDate, plural, todayBR } from "@/lib/utils";
import { Chip, Eyebrow } from "../results/results-ui";

export {
  Chip, Eyebrow, DialogHeading, btnPrimary, btnSecondary, btnSmall, btnGhost, inputCls, dialogCls, Bone, FOCUS_RING,
  EmptyBlock, ErrorBlock, Notice, surfaceCls, FieldLabel, FieldErrorText, iconBtn, StatCell, SearchField, SectionTitle, type Tone,
} from "../results/results-ui";

export const FULL_DATE: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };
export const fmtFull = (d: string | null | undefined) => fmtDate(d, FULL_DATE);
export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
/** Nota sempre com 1 casa ("79,0"), como em todo o app. */
export const n1 = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

export function cyclePeriod(c: { startDate?: string | null; endDate?: string | null }): string {
  if (c.startDate && c.endDate) return `${fmtFull(c.startDate)} a ${fmtFull(c.endDate)}`;
  if (c.startDate) return `A partir de ${fmtFull(c.startDate)}`;
  if (c.endDate) return `Até ${fmtFull(c.endDate)}`;
  return "Período não definido";
}

const DAY = 86_400_000;
const dayNum = (iso: string) => Date.parse(`${iso.slice(0, 10)}T12:00:00Z`) / DAY;
/** Dias corridos do período (início e fim inclusos). */
export function periodDays(start?: string | null, end?: string | null): number | null {
  if (!start || !end || start > end) return null;
  return Math.round(dayNum(end) - dayNum(start)) + 1;
}

export function addDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Mínimo de eventos que vale no ciclo e de onde vem (do ciclo ou da regra geral). */
export function minEventsText(c: Pick<CycleSummary, "minEvents" | "effectiveMinEvents">): { value: string; note: string } {
  const min = c.effectiveMinEvents ?? c.minEvents;
  if (min == null) return { value: "Regra geral", note: "Definido em Regras do Sistema" };
  return { value: plural(min, "evento", "eventos"), note: c.minEvents == null ? "Da regra geral (Regras do Sistema)" : "Definido neste ciclo" };
}

/** Situação do ciclo em texto + cor (a cor nunca é o único sinal). */
export function CycleStatusChip({ cycle, className }: { cycle: Pick<CycleSummary, "isCurrent" | "status" | "closedAt">; className?: string }) {
  const closed = cycle.status === "closed";
  const on = cycle.closedAt ? ` em ${new Date(cycle.closedAt).toLocaleDateString("pt-BR")}` : "";
  if (cycle.isCurrent && !closed) return <Chip tone="brand" icon={Star} className={className}>Atual · aberto</Chip>;
  if (cycle.isCurrent && closed) return <Chip tone="info" icon={Lock} className={className}>Atual · fechado{on}</Chip>;
  if (closed) return <Chip icon={Lock} className={className}>Fechado{on}</Chip>;
  return <Chip tone="warn" icon={CircleDot} className={className} title="Ciclo aberto que não é o atual: ainda não foi fechado">Aberto · fora do atual</Chip>;
}

/**
 * Onde o ciclo está no calendário: barra do período com o "hoje" marcado e a
 * frase do dia ("Dia 200 de 361 · faltam 161 dias", "Começa em…", "Terminou…").
 */
export function PeriodTrack({ start, end, closed, className }: { start?: string | null; end?: string | null; closed?: boolean; className?: string }) {
  const total = periodDays(start, end);
  if (!start || !end || total == null) return null;
  const today = todayBR();
  const elapsed = Math.round(dayNum(today) - dayNum(start)) + 1;
  const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
  let text: string;
  if (today < start) text = `Começa em ${fmtFull(start)} · ${plural(total, "dia", "dias")}`;
  else if (today > end) text = `Período encerrado em ${fmtFull(end)} · ${plural(total, "dia", "dias")}`;
  else {
    const left = total - elapsed;
    text = `Dia ${elapsed.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} · ${left === 0 ? "último dia" : `${left === 1 ? "falta 1 dia" : `faltam ${left.toLocaleString("pt-BR")} dias`}`}`;
  }
  return (
    <div className={cn("min-w-0", className)} data-testid="cycle-period-track">
      <div className="flex items-center justify-between gap-3 text-[12px] font-semibold tabular-nums text-muted-foreground">
        <span>{fmtFull(start)}</span>
        <span>{fmtFull(end)}</span>
      </div>
      <div className="relative mt-1.5 h-1.5 rounded-full bg-secondary" aria-hidden>
        <span className={cn("absolute inset-y-0 left-0 rounded-full", closed ? "bg-muted-foreground/50" : "bg-foreground")} style={{ width: `${pct}%` }} />
        {today >= start && today <= end && (
          <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-card bg-[var(--accent)]" style={{ left: `${pct}%` }} />
        )}
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
        <CalendarClock size={13} aria-hidden className="shrink-0" /> {text}
      </p>
    </div>
  );
}

/** Rótulo + valor de uma regra (lista de regras do ciclo). */
export function RuleItem({ label, value, note, testId, className }: { label: string; value: React.ReactNode; note?: React.ReactNode; testId?: string; className?: string }) {
  return (
    <div className={cn("min-w-0", className)} data-testid={testId}>
      <dt><Eyebrow as="span" className="block">{label}</Eyebrow></dt>
      <dd className="mt-1.5 text-[15px] font-semibold leading-tight text-foreground">{value}</dd>
      {note && <dd className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{note}</dd>}
    </div>
  );
}

/**
 * Linha de alternância do formulário (switch + título + explicação). A linha
 * inteira é o rótulo; travada, mostra o cadeado e o motivo logo abaixo.
 */
export function SwitchRow({ id, title, children, control, locked, lockedNote, lockedNoteId, testId }: {
  id: string; title: React.ReactNode; children: React.ReactNode; control: React.ReactNode;
  locked?: boolean; lockedNote?: React.ReactNode; lockedNoteId?: string; testId?: string;
}) {
  return (
    <div data-testid={testId} className={cn(
      "rounded-xl border px-3.5 py-3 transition-colors duration-150",
      locked ? "border-border bg-secondary/50" : "border-border hover:border-foreground/25",
    )}>
      <label htmlFor={id} className={cn("flex items-start gap-3", locked ? "cursor-not-allowed" : "cursor-pointer")}>
        <span className="pt-0.5">{control}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-semibold leading-snug text-foreground">
            {title}
            {locked && <Chip icon={Lock} className="h-5 text-[11px]">Travado</Chip>}
          </span>
          <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{children}</span>
        </span>
      </label>
      {locked && lockedNote && (
        <p id={lockedNoteId} className="mt-2 ml-12 text-[12.5px] font-semibold leading-snug text-[var(--status-warn-text)]" data-testid={lockedNoteId}>{lockedNote}</p>
      )}
    </div>
  );
}
