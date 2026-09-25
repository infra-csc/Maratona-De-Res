import type { MyPerformanceSummary } from "@workspace/api-client-react";
import { cn, fmtNum } from "@/lib/utils";
import { scoreColor, scoreBarColor, scoreLabel } from "./helpers";

type SummaryProps = { summary: MyPerformanceSummary };

/** Grade de resumo: Média do Ciclo, Elegibilidade ao Bônus e Faixa. */
export function SummaryCards({ summary, result }: SummaryProps & { result: number | null }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px]">
      {/* Média do Ciclo */}
      <div className="rounded-xl p-[18px] relative overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Média do Ciclo</span>
        {result !== null ? (
          <>
            <div className="mt-1.5 flex items-baseline gap-2" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              <span className="font-black text-[34px] leading-none" style={{ color: scoreColor(result) }}>{fmtNum(result, 1)}</span>
              <span className="text-[15px] text-muted-foreground">/100</span>
            </div>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <p className="text-[11px] font-bold uppercase text-muted-foreground">
                {summary.isQuarterClosed ? "Resultado oficial" : "Projeção parcial"}
              </p>
              {result !== null && (
                <span className="text-[11px] font-bold text-muted-foreground">{scoreLabel(result)}</span>
              )}
            </div>
          </>
        ) : (
          <div className="text-lg text-muted-foreground mt-4">—</div>
        )}
        <div className="mt-3 h-[5px] rounded-full overflow-hidden" style={{ backgroundColor: "var(--muted)" }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${result ?? 0}%`, backgroundColor: scoreBarColor(result) }} />
        </div>
      </div>

      {/* Eventos Confirmados — barra de progresso para elegibilidade */}
      <EligibilityCard summary={summary} />

      {/* Faixa — 3ª coluna da grade de resumo */}
      {summary.currentPlatoon && <BandCard summary={summary} />}
    </div>
  );
}

function EligibilityCard({ summary }: SummaryProps) {
  // Elegibilidade usa eventos PARTICIPADOS (mesma métrica do grid
  // de colaboradores), não eventos com nota já calculada.
  const confirmed = summary.participatedEventsCount ?? summary.confirmedEvents ?? 0;
  const target = summary.minEventsForEligibility ?? 8;
  const faltam = Math.max(0, target - confirmed);
  const atingiu = confirmed >= target;
  const steps = Array.from({ length: target }, (_, i) => i < confirmed);
  return (
    <div className="rounded-xl p-[18px]" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Elegibilidade ao Bônus</span>
      <div className="mt-1.5 flex items-baseline gap-2" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
        <span className="font-black text-[34px] leading-none" style={{ color: atingiu ? "var(--accent-text)" : "var(--foreground)" }}>{confirmed}</span>
        <span className="text-[15px] text-muted-foreground">/ {target} eventos</span>
      </div>
      <p className={cn("mt-1 text-[11px] font-bold uppercase", atingiu ? "text-[var(--status-ok-text)]" : "text-[var(--status-warn-text)]")}>
        {atingiu ? "✓ Meta atingida — elegível ao bônus" : `Faltam ${faltam} evento${faltam !== 1 ? "s" : ""} confirmados`}
      </p>
      {/* Step dots */}
      <div className="mt-3 flex gap-1 flex-wrap">
        {steps.map((filled, i) => (
          <div
            key={i}
            className="rounded-sm transition-all duration-300"
            style={{
              width: `calc(${100 / target}% - 3px)`,
              minWidth: 10,
              height: 8,
              backgroundColor: filled ? (atingiu ? "var(--accent)" : "var(--foreground)") : "var(--muted)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Faixa atual, progresso dentro dela, distância até a próxima e bônus projetado. */
function BandCard({ summary }: SummaryProps) {
  const score = summary.finalResult;
  const min = summary.currentPlatoonMinScore;
  const max = summary.currentPlatoonMaxScore;
  const progressPct = (score != null && min != null && max != null && max > min)
    ? Math.min(100, Math.max(0, ((score - min) / (max - min)) * 100))
    : null;
  const gapToNext = (score != null && summary.nextPlatoonMinScore != null)
    ? Math.max(0, summary.nextPlatoonMinScore - score)
    : null;
  return (
    <div
      className="rounded-xl p-[18px] relative overflow-hidden"
      style={{
        backgroundColor: summary.currentPlatoonColor ? `${summary.currentPlatoonColor}18` : "var(--card)",
        border: `1px solid ${summary.currentPlatoonColor ? `${summary.currentPlatoonColor}55` : "var(--border)"}`,
        borderLeft: `4px solid ${summary.currentPlatoonColor ?? "var(--accent)"}`,
      }}
    >
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Faixa</span>
      <div className="mt-1.5 flex items-center gap-2">
        {summary.currentPlatoonColor && (
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: summary.currentPlatoonColor, boxShadow: "0 0 0 1px var(--border)" }} />
        )}
        <span
          className="font-black text-[24px] leading-none"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--foreground)" }}
        >
          {summary.currentPlatoon}
        </span>
      </div>
      {min != null && max != null && (
        <p className="text-[11px] font-bold mt-1 text-muted-foreground">
          {min}–{max}
        </p>
      )}

      {/* Barra de progresso dentro da faixa atual */}
      {progressPct !== null && (
        <div className="mt-2.5">
          <div
            className="w-full h-1.5 rounded-full overflow-hidden"
            style={{ backgroundColor: summary.currentPlatoonColor ? `${summary.currentPlatoonColor}30` : "var(--muted)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                backgroundColor: summary.currentPlatoonColor ?? "var(--accent)",
              }}
            />
          </div>
        </div>
      )}

      {/* Falta para a próxima faixa */}
      {gapToNext !== null && summary.nextPlatoon && (
        <p className="text-[11px] font-semibold mt-2 leading-tight" style={{ color: summary.nextPlatoonColor ?? "var(--muted-foreground)" }}>
          +{gapToNext.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pts → {summary.nextPlatoon}
        </p>
      )}

      {/* Mensagem de conquista para o tier máximo */}
      {!summary.nextPlatoon && summary.currentPlatoon && (
        <p className="text-[11px] font-semibold mt-2 leading-tight" style={{ color: summary.currentPlatoonColor ?? "var(--accent)" }}>
          🏆 Nível máximo atingido!
        </p>
      )}

      {summary.projectedBonus != null && summary.eligible && summary.projectedBonus > 0 && (
        <p
          className="text-[11px] font-bold mt-1.5"
          style={{ color: summary.currentPlatoonColor ?? "var(--accent)" }}
        >
          Bônus: {summary.projectedBonus.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
        </p>
      )}
    </div>
  );
}
