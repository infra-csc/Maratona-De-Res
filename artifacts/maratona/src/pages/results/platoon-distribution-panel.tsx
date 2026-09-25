import type { QuarterlyResult } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";
import { BarChart3 } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { CONDENSED } from "@/lib/premium-theme";
import { fmtBRLShort } from "./helpers";
import { FaixaBadge } from "./badges";

type PlatoonGroup = {
  platoon: string;
  color: string | null;
  minScore: number | null;
  maxScore: number | null;
  count: number;
  avgScore: number;
  totalBonus: number;
};

function buildPlatoonGroups(rows: QuarterlyResult[]): PlatoonGroup[] {
  const grouped = new Map<string, { items: QuarterlyResult[]; color: string | null; min: number | null; max: number | null }>();
  for (const r of rows) {
    const key = r.platoon ?? "Sem faixa";
    if (!grouped.has(key)) {
      grouped.set(key, { items: [], color: r.platoonColor ?? null, min: r.platoonMinScore ?? null, max: r.platoonMaxScore ?? null });
    }
    grouped.get(key)!.items.push(r);
  }
  return [...grouped.entries()]
    .map(([platoon, { items, color, min, max }]) => ({
      platoon,
      color,
      minScore: min,
      maxScore: max,
      count: items.length,
      avgScore: items.reduce((s, r) => s + r.finalResult, 0) / items.length,
      totalBonus: items.reduce((s, r) => s + (r.bonusValue ?? 0), 0),
    }))
    .sort((a, b) => (b.minScore ?? -1) - (a.minScore ?? -1));
}

export function PlatoonDistributionPanel({ rows }: { rows: QuarterlyResult[] }) {
  const groups = buildPlatoonGroups(rows);
  if (groups.length === 0) return null;

  const chartData = groups.map(g => ({ name: g.platoon, count: g.count, color: g.color }));
  const chartHeight = Math.max(groups.length * 48, 100);

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <BarChart3 size={16} style={{ color: "var(--accent-text)" }} />
        <span className="font-black uppercase tracking-tight text-xs" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>
          Distribuição por Faixa
        </span>
        <span className="ml-auto text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>
          {rows.length} colaborador{rows.length !== 1 ? "es" : ""}
        </span>
      </div>

      <div className="p-5 grid md:grid-cols-2 gap-6 items-start">
        {/* Horizontal bar chart */}
        <div style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 4 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={80}
                tick={{ fontSize: 11, fontWeight: 700, fill: "var(--foreground)", fontFamily: CONDENSED }}
                axisLine={false}
                tickLine={false}
              />
              <RechartsTooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const item = payload[0];
                  return (
                    <div className="rounded-lg px-3 py-2 text-xs font-bold shadow-lg" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                      <span style={{ color: "var(--muted-foreground)" }}>{item.payload.name}: </span>
                      <span style={{ fontFamily: CONDENSED, fontWeight: 900 }}>{item.value as number} colaborador{(item.value as number) !== 1 ? "es" : ""}</span>
                    </div>
                  );
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11, fontWeight: 900, fontFamily: CONDENSED, fill: "var(--foreground)" }}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color ?? "var(--primary)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary table */}
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="grid grid-cols-[1.4fr_0.6fr_0.7fr_1fr]" style={{ backgroundColor: "var(--secondary)" }}>
            {(["Faixa", "Qtd", "Média", "Bônus Total"] as const).map(h => (
              <div key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)", textAlign: h === "Faixa" ? "left" : "center" }}>{h}</div>
            ))}
          </div>
          {groups.map((g, i) => (
            <div key={g.platoon} className="grid grid-cols-[1.4fr_0.6fr_0.7fr_1fr] items-center" style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
              <div className="px-3 py-2.5">
                <FaixaBadge name={g.platoon} minScore={g.minScore} maxScore={g.maxScore} color={g.color} compact />
              </div>
              <div className="px-3 py-2.5 text-center">
                <span className="font-black text-sm" style={{ fontFamily: CONDENSED }}>{g.count}</span>
              </div>
              <div className="px-3 py-2.5 text-center">
                <span className="font-black text-sm" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>{fmtNum(g.avgScore, 1)}</span>
              </div>
              <div className="px-3 py-2.5 text-center">
                <span className="font-black text-xs" style={{ fontFamily: CONDENSED, color: "var(--primary)" }}>{fmtBRLShort(g.totalBonus)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
