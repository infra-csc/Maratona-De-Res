import { Award, TrendingUp, TrendingDown } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { scoreColor, scoreBarColor } from "./helpers";
import type { EventSummary } from "./types";

/** Item 6 — Destaques do Ciclo (critério mais forte / mais fraco + ranking). */
export function CycleHighlights({ events }: { events: EventSummary[] }) {
  const scoredEvents = (events ?? []).filter(ev => ev.resultsConfirmed && ev.countsForScore && ev.eventScore > 0);
  // Agrupa scoreUsed por criterionName (apenas critérios finalizados com peso)
  const map = new Map<string, number[]>();
  for (const ev of scoredEvents) {
    for (const c of ev.criteriaDetails) {
      if (c.scoreUsed === null || !c.finalPublishedAt || Number(c.weight) <= 0) continue;
      const name = c.criterionName;
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(c.scoreUsed);
    }
  }
  if (map.size < 2) return null;
  const entries = [...map.entries()].map(([name, scores]) => ({
    name,
    avg: scores.reduce((s, v) => s + v, 0) / scores.length,
    count: scores.length,
  })).sort((a, b) => b.avg - a.avg);
  const best = entries[0];
  const worst = entries[entries.length - 1];
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
        <Award size={13} /> Destaques do Ciclo
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Ponto forte */}
        <div className="rounded-lg p-4" style={{ backgroundColor: "rgba(204,255,0,0.06)", border: "1px solid rgba(204,255,0,0.2)" }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} style={{ color: "var(--accent-text)" }} />
            <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: "var(--accent-text)" }}>Ponto Forte</span>
          </div>
          <p className="font-black text-[14px] text-foreground leading-tight mb-1">{best.name}</p>
          <div className="flex items-baseline gap-1">
            <span className="font-black text-[22px] leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--accent-text)" }}>{fmtNum(best.avg, 1)}</span>
            <span className="text-[11px] text-muted-foreground">/10 média · {best.count} evento{best.count !== 1 ? "s" : ""}</span>
          </div>
          <div className="mt-2 h-[4px] rounded-full overflow-hidden" style={{ backgroundColor: "var(--muted)" }}>
            <div className="h-full rounded-full" style={{ width: `${(best.avg / 10) * 100}%`, backgroundColor: "var(--accent)" }} />
          </div>
        </div>
        {/* A desenvolver */}
        <div className="rounded-lg p-4" style={{ backgroundColor: "rgba(134,34,0,0.06)", border: "1px solid rgba(134,34,0,0.2)" }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={14} className="text-[var(--status-danger-text)]" />
            <span className="text-[11px] font-black uppercase tracking-wider text-[var(--status-danger-text)]">A Desenvolver</span>
          </div>
          <p className="font-black text-[14px] text-foreground leading-tight mb-1">{worst.name}</p>
          <div className="flex items-baseline gap-1">
            <span className="font-black text-[22px] leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: scoreColor(worst.avg * 10) }}>{fmtNum(worst.avg, 1)}</span>
            <span className="text-[11px] text-muted-foreground">/10 média · {worst.count} evento{worst.count !== 1 ? "s" : ""}</span>
          </div>
          <div className="mt-2 h-[4px] rounded-full overflow-hidden" style={{ backgroundColor: "var(--muted)" }}>
            <div className="h-full rounded-full" style={{ width: `${(worst.avg / 10) * 100}%`, backgroundColor: scoreBarColor(worst.avg * 10) }} />
          </div>
        </div>
      </div>
      {/* Ranking completo de todos os critérios */}
      <div className="mt-4 pt-3 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
        <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-2">Ranking de Quesitos</p>
        {entries.map((e, i) => {
          const isFirst = i === 0;
          const isLast = i === entries.length - 1;
          return (
            <div key={e.name} className="flex items-center gap-3">
              <span className="text-[11px] font-black text-muted-foreground w-4 shrink-0 text-right">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-bold text-foreground truncate">{e.name}</span>
                  {isFirst && <span className="text-[11px] font-black uppercase tracking-wider shrink-0 px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(204,255,0,0.15)", color: "var(--status-ok-text)" }}>melhor</span>}
                  {isLast && entries.length > 1 && <span className="text-[11px] font-black uppercase tracking-wider shrink-0 px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(134,34,0,0.08)", color: "var(--status-danger-text)" }}>a desenvolver</span>}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                    <div className="h-full rounded-full" style={{ width: `${(e.avg / 10) * 100}%`, backgroundColor: isFirst ? "var(--accent)" : scoreBarColor(e.avg * 10) }} />
                  </div>
                  <span className="text-[12px] font-black shrink-0 w-[28px] text-right" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: isFirst ? "var(--status-ok-text)" : scoreColor(e.avg * 10) }}>
                    {fmtNum(e.avg, 1)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
