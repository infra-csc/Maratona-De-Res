// "Como sua nota é calculada": os eventos que entram na conta (nota de cada
// um) e a conta em forma de recibo — soma, penalidades, méritos, ÷ eventos =
// nota. A matemática é a mesma de antes; só a apresentação mudou.
import type { MyPerformanceSummary } from "@workspace/api-client-react";
import { Calculator } from "lucide-react";
import { cn, fmtDate, fmtNum } from "@/lib/utils";
import { scoreBarColor } from "./helpers";
import { Meter, Section, n1, scoreInk, surfaceCls } from "./mp-ui";
import type { EventSummary } from "./types";

function ReceiptLine({ op, label, value, tone, strong }: { op?: string; label: string; value: string; tone?: "danger" | "ok"; strong?: boolean }) {
  const ink = tone === "danger" ? "text-[var(--status-danger-text)]" : tone === "ok" ? "text-[var(--status-ok-text)]" : "text-foreground";
  return (
    <div className={cn("flex items-baseline gap-3 py-2", strong && "pt-3")}>
      <span aria-hidden className="w-4 shrink-0 font-condensed text-[18px] font-black text-muted-foreground text-center">{op}</span>
      <span className={cn("flex-1 min-w-0 text-[14px]", strong ? "font-bold text-foreground" : "text-muted-foreground")}>{label}</span>
      <span className={cn("font-condensed font-black tabular-nums leading-none", strong ? "text-[28px]" : "text-[20px]", ink)}>{value}</span>
    </div>
  );
}

export function ScoreBreakdown({ events, summary, result }: {
  events: EventSummary[];
  summary: MyPerformanceSummary;
  result: number | null;
}) {
  const scoredEvts = (events ?? [])
    .filter(ev => ev.resultsConfirmed && ev.countsForScore && ev.eventScore > 0)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  // Usa o grossAverage do snapshot quando disponível (já vem do API
  // com o valor oficial); fallback para o cálculo ao vivo.
  const officialAvg = summary.grossAverage ?? null;
  const officialCount = summary.scoredEventsCount ?? scoredEvts.length;
  if (scoredEvts.length === 0 && officialAvg === null) return null;
  const liveTotal = scoredEvts.reduce((s, e) => s + e.eventScore, 0);
  const liveAvg = scoredEvts.length > 0 ? liveTotal / scoredEvts.length : null;
  // A soma ao vivo só aparece quando bate com o snapshot (mesma qtd de eventos
  // e média com diferença ≤ 0,1); senão mostra a soma derivada da média oficial.
  const liveConsistent = liveAvg !== null
    && officialAvg !== null
    && scoredEvts.length === officialCount
    && Math.abs(liveAvg - officialAvg) < 0.11;
  const displayAvg = officialAvg ?? liveAvg ?? 0;
  const N = officialCount > 0 ? officialCount : scoredEvts.length;
  const pen = summary.penaltyPoints ?? 0;
  const mer = summary.meritPoints ?? 0;
  const netPenalty = pen - mer;
  const penPerEvent = N > 0 ? netPenalty / N : 0;
  const rawFinal = displayAvg - penPerEvent;
  const isClamped = rawFinal < 0 || rawFinal > 100;
  // Mesma regra da nota final oficial: 1 casa, arredondada uma vez.
  const finalVal = result ?? Math.min(100, Math.max(0, Math.round(rawFinal * 10 + 1e-7) / 10));
  const sum = liveConsistent ? liveTotal : displayAvg * N;

  return (
    <Section id="mp-calc" icon={Calculator} title="Como sua nota é calculada" testId="my-score-breakdown"
      hint="Somamos a nota de cada evento que conta, tiramos as penalidades, somamos os méritos e dividimos pelo número de eventos.">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <ol className={cn(surfaceCls, "divide-y divide-border overflow-hidden")} aria-label="Eventos que contam na nota">
          {scoredEvts.map((ev, i) => (
            <li key={ev.eventId} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <span aria-hidden className="w-5 shrink-0 text-right font-condensed text-[14px] font-bold tabular-nums text-muted-foreground">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 text-[14px] font-semibold leading-snug text-foreground break-words">{ev.eventName}</p>
                  <span className={cn("shrink-0 font-condensed text-[20px] font-black leading-none tabular-nums", scoreInk(ev.eventScore))}>{n1(ev.eventScore)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <Meter pct={ev.eventScore} fill={scoreBarColor(ev.eventScore)} className="h-1" />
                  {ev.startDate && <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">{fmtDate(ev.startDate)}</span>}
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className={cn(surfaceCls, "px-4 py-3 sm:px-5 lg:sticky lg:top-20")} data-testid="my-score-receipt">
          <p className="font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground pt-1 pb-1">A conta</p>
          <div className="divide-y divide-dashed divide-border">
            <ReceiptLine label={`Soma das notas (${N === 1 ? "1 evento" : `${N} eventos`})`} value={fmtNum(sum, 1)} />
            {pen > 0 && <ReceiptLine op="−" label="Penalidades" value={fmtNum(pen, 0)} tone="danger" />}
            {mer > 0 && <ReceiptLine op="+" label="Méritos" value={fmtNum(mer, 0)} tone="ok" />}
            <ReceiptLine op="÷" label="Número de eventos" value={String(N)} />
          </div>
          <div className="mt-1 border-t-2 border-foreground">
            <ReceiptLine op="=" label={`Sua nota${isClamped ? " (fica entre 0 e 100)" : ""}`} value={n1(finalVal)} strong />
          </div>
          {netPenalty !== 0 && (
            <p className="mt-1 mb-1.5 text-[12.5px] leading-snug text-muted-foreground">
              Penalidades e méritos entram antes da divisão: quanto mais eventos você tem, menor o peso de cada um.
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}
