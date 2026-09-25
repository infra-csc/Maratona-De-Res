import type { MyPerformanceSummary } from "@workspace/api-client-react";
import { fmtDate, fmtNum } from "@/lib/utils";
import { scoreColor, scoreBarColor } from "./helpers";
import type { EventSummary } from "./types";

/** "Como sua nota é calculada": eventos que compõem a média + fórmula em blocos. */
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
  // Exibe o footer com "Soma ÷ Qtd = Média" apenas quando o cálculo
  // ao vivo é consistente com o snapshot (mesma qtd de eventos e avg
  // com diferença ≤ 0,1). Quando há divergência (ex.: evento
  // confirmado/desconfirmado depois do snapshot), mostra a média
  // oficial diretamente para não exibir uma conta que não fecha.
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
  const finalVal = result ?? Math.min(100, Math.max(0, Math.round(rawFinal * 100) / 100));
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
          Como sua nota é calculada
        </p>
      </div>

      {/* Lista de eventos */}
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {scoredEvts.map((ev, i) => (
          <div key={ev.eventId} className="flex items-center gap-3 px-5 py-3">
            <span className="text-[11px] font-black text-muted-foreground w-5 shrink-0 text-right">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <p className="text-[12px] font-bold text-foreground truncate">{ev.eventName}</p>
                {ev.startDate && (
                  <span className="text-[11px] text-muted-foreground shrink-0">{fmtDate(ev.startDate)}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-[4px] rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                  <div className="h-full rounded-full" style={{ width: `${ev.eventScore}%`, backgroundColor: scoreBarColor(ev.eventScore) }} />
                </div>
                <span className="text-[15px] font-black shrink-0 w-[42px] text-right" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: scoreColor(ev.eventScore) }}>
                  {fmtNum(ev.eventScore, 1)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Fórmula de cálculo */}
      <div className="px-5 py-5" style={{ backgroundColor: "var(--muted)", borderTop: "1px solid var(--border)" }}>
        {/* Rótulo da fórmula */}
        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-4">
          {netPenalty !== 0
            ? `( soma das notas ${pen > 0 ? "− penalidades" : ""}${mer > 0 ? " + méritos" : ""} ) ÷ nº de provas = nota final`
            : "soma das notas ÷ nº de provas = nota final"}
        </p>

        {/* Blocos da fórmula */}
        <div className="flex items-stretch gap-0 flex-wrap">

          {/* SOMA */}
          <div className="flex flex-col items-center justify-center px-4 py-3 rounded-l-lg min-w-[72px]" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1">Soma</span>
            <span className="font-black text-[24px] leading-none text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              {liveConsistent ? fmtNum(liveTotal, 1) : fmtNum((displayAvg * N), 1)}
            </span>
          </div>

          {/* − PENALIDADES */}
          {pen > 0 && (
            <>
              <div className="flex items-center px-2 self-center">
                <span className="text-[18px] font-black text-muted-foreground">−</span>
              </div>
              <div className="flex flex-col items-center justify-center px-4 py-3 min-w-[72px]" style={{ backgroundColor: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,0.25)" }}>
                <span className="text-[11px] font-black uppercase tracking-wider mb-1" style={{ color: "var(--status-danger-text)" }}>Penalidades</span>
                <span className="font-black text-[24px] leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--status-danger-text)" }}>{pen}</span>
              </div>
            </>
          )}

          {/* + MÉRITOS */}
          {mer > 0 && (
            <>
              <div className="flex items-center px-2 self-center">
                <span className="text-[18px] font-black text-muted-foreground">+</span>
              </div>
              <div className="flex flex-col items-center justify-center px-4 py-3 min-w-[72px]" style={{ backgroundColor: "rgba(22,163,74,0.10)", border: "1px solid rgba(22,163,74,0.30)" }}>
                <span className="text-[11px] font-black uppercase tracking-wider mb-1" style={{ color: "var(--status-ok-text)" }}>Méritos</span>
                <span className="font-black text-[24px] leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--status-ok-text)" }}>{mer}</span>
              </div>
            </>
          )}

          {/* ÷ N PROVAS */}
          <div className="flex items-center px-2 self-center">
            <span className="text-[18px] font-black text-muted-foreground">÷</span>
          </div>
          <div className="flex flex-col items-center justify-center px-4 py-3 min-w-[72px]" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1">Provas</span>
            <span className="font-black text-[24px] leading-none text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{N}</span>
          </div>

          {/* = NOTA FINAL */}
          <div className="flex items-center px-2 self-center">
            <span className="text-[18px] font-black text-muted-foreground">=</span>
          </div>
          <div className="flex flex-col items-center justify-center px-4 py-3 rounded-r-lg flex-1 min-w-[88px]" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1">
              Nota Final{isClamped ? " (limitado a 0–100)" : ""}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="font-black text-[28px] leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: scoreColor(finalVal) }}>{fmtNum(finalVal, 1)}</span>
              <span className="text-[11px] text-muted-foreground">/100</span>
            </div>
          </div>
        </div>

        {/* Explicação textual — só quando há penalidade/mérito */}
        {netPenalty !== 0 && (
          <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
            Penalidades e méritos são somados ao total antes de dividir pelas provas —
            {" "}por isso o impacto depende de quantos eventos você participou.
          </p>
        )}
      </div>
    </div>
  );
}
