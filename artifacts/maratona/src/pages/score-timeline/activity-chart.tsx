import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";
import type { DayGroup } from "./describe";
import { shortDay, dayTitle } from "./describe";

const UP = "var(--status-ok)";
const DOWN = "var(--status-danger)";
const GRID = "var(--viz-grid)";

/**
 * Atividade por dia: quantas notas SUBIRAM (barra para cima) e quantas
 * CAÍRAM (barra para baixo) em cada dia. Clicar num dia filtra a lista por ele.
 * Duas cores de status + rótulo na legenda (cor nunca é o único sinal).
 */
export function ActivityChart({ days, selected, onPick, height = 180 }: {
  days: DayGroup[]; selected: string | null; onPick: (key: string) => void; height?: number;
}) {
  const rows = useMemo(() => [...days].reverse()
    .filter(d => d.ups > 0 || d.downs > 0)
    .map(d => ({ key: d.key, label: shortDay(d.key), ups: d.ups, downs: -d.downs, faixas: d.faixas, people: d.people })), [days]);
  if (rows.length === 0) return null;
  // Eixo simétrico com marcas redondas: ±n, ±n/2 e 0.
  const peak = Math.max(1, ...rows.map(r => Math.max(r.ups, -r.downs)));
  const max = [2, 4, 6, 10, 20, 30, 40, 50, 100, 200, 500, 1000].find(n => n >= peak) ?? Math.ceil(peak / 1000) * 1000;
  const ticks = [-max, -max / 2, 0, max / 2, max];
  return (
    <figure className="min-w-0">
      <div style={{ height }} role="img" aria-label={rows.map(r => `${r.label}: ${r.ups} altas, ${-r.downs} quedas`).join("; ")}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} stackOffset="sign" margin={{ top: 6, right: 8, bottom: 0, left: -18 }} barCategoryGap={rows.length > 40 ? 1 : 3}
            onClick={(s: { activePayload?: { payload: { key: string } }[] }) => { const k = s?.activePayload?.[0]?.payload.key; if (k) onPick(k); }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} minTickGap={16} />
            <YAxis domain={[-max, max]} ticks={ticks} allowDecimals={false} tickFormatter={(v: number) => String(Math.abs(v))} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={40} />
            <ReferenceLine y={0} stroke="var(--border)" />
            <Tooltip
              cursor={{ fill: "var(--secondary)", opacity: 0.6 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const r = payload[0].payload as (typeof rows)[number];
                return (
                  <div className="rounded-lg px-3 py-2 text-[12px] shadow-md" style={{ backgroundColor: "var(--popover)", color: "var(--popover-foreground)", border: "1px solid var(--border)" }}>
                    <div className="font-bold mb-1">{dayTitle(r.key)}</div>
                    <div className="flex justify-between gap-6"><span>Notas que subiram</span><strong className="tabular-nums">{r.ups}</strong></div>
                    <div className="flex justify-between gap-6"><span>Notas que caíram</span><strong className="tabular-nums">{-r.downs}</strong></div>
                    {r.faixas > 0 && <div className="flex justify-between gap-6"><span>Mudanças de faixa</span><strong className="tabular-nums">{r.faixas}</strong></div>}
                    <div className="mt-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>Clique para ver o dia</div>
                  </div>
                );
              }}
            />
            <Bar dataKey="ups" stackId="d" radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} style={{ cursor: "pointer" }}>
              {rows.map(r => <Cell key={r.key} fill={UP} fillOpacity={selected && selected !== r.key ? 0.35 : 1} />)}
            </Bar>
            <Bar dataKey="downs" stackId="d" radius={[0, 0, 3, 3]} maxBarSize={22} isAnimationActive={false} style={{ cursor: "pointer" }}>
              {rows.map(r => <Cell key={r.key} fill={DOWN} fillOpacity={selected && selected !== r.key ? 0.35 : 1} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: UP }} /> Notas que subiram</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: DOWN }} /> Notas que caíram</span>
        <span>Clique num dia para filtrar.</span>
      </figcaption>
    </figure>
  );
}
