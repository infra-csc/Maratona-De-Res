import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import type { ScoreTimelineEntry } from "@workspace/api-client-react";
import { CONDENSED } from "@/lib/premium-theme";
import { score, sentenceOf, shortDate } from "./describe";

const SERIES = "var(--viz-series-1)";
const GRID = "var(--viz-grid)";

interface Point { t: number; at: string; value: number; kind: "reconstructed" | "recorded" | "now"; label: string }

/**
 * Nota final ao longo do ciclo, em degraus (a nota só muda num instante).
 * Parte remontada tracejada, registro exato contínuo; as faixas aparecem
 * como linhas de referência com o nome à direita. Um eixo só (0–100, recortado
 * em volta dos valores para enxergar diferenças de décimos).
 */
export function TimelineChart({ entries, currentFinal, platoons, name, height }: {
  entries: ScoreTimelineEntry[]; currentFinal: number | null; platoons: { name: string; color?: string | null; minScore: number }[]; name: string; height: number;
}) {
  const { rows, domain, thresholds, hasRecon, hasRecorded } = useMemo(() => {
    const pts: Point[] = [];
    for (const e of entries) {
      if (e.kind === "info" || e.finalAfter == null) continue;
      pts.push({ t: new Date(e.at).getTime(), at: e.at, value: e.finalAfter, kind: e.kind as Point["kind"], label: sentenceOf(e).title });
    }
    if (currentFinal != null) pts.push({ t: Date.now(), at: new Date().toISOString(), value: currentFinal, kind: "now", label: "Hoje" });
    pts.sort((a, b) => a.t - b.t);
    // Duas séries no mesmo eixo: a remontada termina onde o registro começa
    // (o ponto de junção entra nas duas para a linha não quebrar).
    const firstRecorded = pts.findIndex(p => p.kind !== "reconstructed");
    const rows = pts.map((p, i) => ({
      t: p.t, at: p.at, label: p.label, value: p.value,
      recon: p.kind === "reconstructed" || (firstRecorded > 0 && i === firstRecorded) ? p.value : null,
      rec: p.kind !== "reconstructed" || (firstRecorded > 0 && i === firstRecorded - 1) ? p.value : null,
    }));
    const values = pts.map(p => p.value);
    // Eixo em múltiplos de 5, com folga, recortado em volta dos valores.
    const lo = values.length ? Math.max(0, Math.floor((Math.min(...values) - 2) / 5) * 5) : 0;
    const hi = values.length ? Math.min(100, Math.ceil((Math.max(...values) + 2) / 5) * 5) : 100;
    const thresholds = platoons.filter(f => f.minScore > lo && f.minScore < hi);
    return { rows, domain: [lo, hi] as [number, number], thresholds, hasRecon: pts.some(p => p.kind === "reconstructed"), hasRecorded: pts.some(p => p.kind !== "reconstructed") };
  }, [entries, currentFinal, platoons]);

  if (rows.length === 0) return null;
  const legend = [
    hasRecon && { key: "recon", label: "Remontado (com as notas de hoje)", dash: true },
    hasRecorded && { key: "rec", label: "Registrado no recálculo", dash: false },
  ].filter(Boolean) as { key: string; label: string; dash: boolean }[];

  return (
    <figure className="min-w-0">
      <div style={{ height }} role="img" aria-label={`Nota final de ${name} ao longo do ciclo: ${rows.map(r => `${shortDate(r.at)} ${score(r.value)}`).join("; ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 12, right: 112, bottom: 4, left: -12 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis
              dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]}
              tickFormatter={(v: number) => shortDate(new Date(v).toISOString())}
              axisLine={{ stroke: GRID }} tickLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} minTickGap={28}
            />
            <YAxis domain={domain} ticks={Array.from({ length: Math.floor((domain[1] - domain[0]) / 5) + 1 }, (_, i) => domain[0] + i * 5)} allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={44} />
            {thresholds.map(f => (
              <ReferenceLine
                key={f.name} y={f.minScore} stroke={f.color ?? "var(--border)"} strokeDasharray="2 4" strokeWidth={1.5}
                label={{ value: `${f.name} · ${score(f.minScore)}`, position: "right", fontSize: 11, fill: "var(--muted-foreground)" }}
              />
            ))}
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const r = payload[0].payload as (typeof rows)[number];
                return (
                  <div className="rounded-lg px-3 py-2 text-[12px] shadow-md" style={{ backgroundColor: "var(--popover)", color: "var(--popover-foreground)", border: "1px solid var(--border)" }}>
                    <div className="font-bold">{shortDate(r.at)} · {r.label}</div>
                    <div className="mt-0.5 flex justify-between gap-6"><span style={{ color: "var(--muted-foreground)" }}>Nota final</span><strong className="tabular-nums">{score(r.value)}</strong></div>
                  </div>
                );
              }}
            />
            <Line type="stepAfter" dataKey="recon" stroke={SERIES} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 5, fill: SERIES, stroke: "var(--card)", strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />
            <Line type="stepAfter" dataKey="rec" stroke={SERIES} strokeWidth={2} dot={{ r: 3.5, fill: SERIES, stroke: "var(--card)", strokeWidth: 2 }} activeDot={{ r: 6, fill: SERIES, stroke: "var(--card)", strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {legend.length > 1 && (
        <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
          {legend.map(l => (
            <span key={l.key} className="inline-flex items-center gap-2">
              <svg width="22" height="6" aria-hidden><line x1="0" y1="3" x2="22" y2="3" stroke={SERIES} strokeWidth="2" strokeDasharray={l.dash ? "5 4" : undefined} /></svg>
              {l.label}
            </span>
          ))}
        </figcaption>
      )}
      <p className="sr-only" style={{ fontFamily: CONDENSED }}>Linhas pontilhadas horizontais: início de cada faixa de bônus.</p>
    </figure>
  );
}
