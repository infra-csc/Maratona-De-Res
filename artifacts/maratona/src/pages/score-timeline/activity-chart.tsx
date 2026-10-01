import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";
import type { DayGroup } from "./describe";
import { shortDay, dayTitle } from "./describe";

const UP = "var(--status-ok)";
const DOWN = "var(--status-danger)";
const GRID = "var(--viz-grid)";
/** "Entrou na nota" / "saiu do ciclo": a mesma cor do lado, mais clara. */
const SOFT = 0.4;

/**
 * Atividade por dia: acima do eixo, notas que SUBIRAM (cheio) e quem ENTROU
 * NA NOTA (claro); abaixo, notas que CAÍRAM (cheio) e quem SAIU DO CICLO
 * (claro). Clicar num dia filtra a lista por ele; o período escolhido fica
 * destacado. Cor nunca é o único sinal: legenda + dica com os números.
 */
export function ActivityChart({ days, from, to, onPick, height = 180 }: {
  days: DayGroup[]; from: string; to: string; onPick: (key: string) => void; height?: number;
}) {
  const rows = useMemo(() => [...days].reverse()
    .filter(d => d.ups > 0 || d.downs > 0 || d.entered > 0 || d.left > 0)
    .map(d => ({ key: d.key, label: shortDay(d.key), ups: d.ups, entered: d.entered, downs: -d.downs, left: -d.left, faixas: d.faixas })), [days]);
  if (rows.length === 0) return null;
  const has = { entered: rows.some(r => r.entered > 0), left: rows.some(r => r.left < 0) };
  // Eixo simétrico com marcas redondas: ±n, ±n/2 e 0.
  const peak = Math.max(1, ...rows.map(r => Math.max(r.ups + r.entered, -(r.downs + r.left))));
  const max = [2, 4, 6, 10, 20, 30, 40, 50, 100, 200, 500, 1000].find(n => n >= peak) ?? Math.ceil(peak / 1000) * 1000;
  const ticks = [-max, -max / 2, 0, max / 2, max];
  const ranged = !!(from || to);
  const inRange = (k: string) => (!from || k >= from) && (!to || k <= to);
  const op = (k: string, base = 1) => (ranged && !inRange(k) ? base * 0.35 : base);
  const describe = (r: (typeof rows)[number]) => [
    `${r.ups} subiram`, `${-r.downs} caíram`,
    r.entered > 0 ? `${r.entered} entraram na nota` : null, r.left < 0 ? `${-r.left} saíram do ciclo` : null,
  ].filter(Boolean).join(", ");
  return (
    <figure className="min-w-0">
      <div style={{ height }} role="img" aria-label={rows.map(r => `${r.label}: ${describe(r)}`).join("; ")}>
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
                const line = (label: string, n: number) => <div className="flex justify-between gap-6"><span>{label}</span><strong className="tabular-nums">{n}</strong></div>;
                return (
                  <div className="rounded-lg px-3 py-2 text-[12px] shadow-md" style={{ backgroundColor: "var(--popover)", color: "var(--popover-foreground)", border: "1px solid var(--border)" }}>
                    <div className="font-bold mb-1">{dayTitle(r.key)}</div>
                    {line("Notas que subiram", r.ups)}
                    {line("Notas que caíram", -r.downs)}
                    {r.entered > 0 && line("Entraram na nota", r.entered)}
                    {r.left < 0 && line("Saíram do ciclo", -r.left)}
                    {r.faixas > 0 && line("Mudanças de faixa", r.faixas)}
                    <div className="mt-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>Clique para ver o dia</div>
                  </div>
                );
              }}
            />
            <Bar dataKey="ups" stackId="d" radius={[2, 2, 0, 0]} maxBarSize={22} isAnimationActive={false} style={{ cursor: "pointer" }}>
              {rows.map(r => <Cell key={r.key} fill={UP} fillOpacity={op(r.key)} />)}
            </Bar>
            {has.entered && (
              <Bar dataKey="entered" stackId="d" radius={[2, 2, 0, 0]} maxBarSize={22} isAnimationActive={false} style={{ cursor: "pointer" }}>
                {rows.map(r => <Cell key={r.key} fill={UP} fillOpacity={op(r.key, SOFT)} />)}
              </Bar>
            )}
            <Bar dataKey="downs" stackId="d" radius={[0, 0, 2, 2]} maxBarSize={22} isAnimationActive={false} style={{ cursor: "pointer" }}>
              {rows.map(r => <Cell key={r.key} fill={DOWN} fillOpacity={op(r.key)} />)}
            </Bar>
            {has.left && (
              <Bar dataKey="left" stackId="d" radius={[0, 0, 2, 2]} maxBarSize={22} isAnimationActive={false} style={{ cursor: "pointer" }}>
                {rows.map(r => <Cell key={r.key} fill={DOWN} fillOpacity={op(r.key, SOFT)} />)}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
        <Swatch color={UP} label="Notas que subiram" />
        {has.entered && <Swatch color={UP} soft label="Entraram na nota" />}
        <Swatch color={DOWN} label="Notas que caíram" />
        {has.left && <Swatch color={DOWN} soft label="Saíram do ciclo" />}
        <span>Clique num dia para filtrar.</span>
      </figcaption>
    </figure>
  );
}

function Swatch({ color, label, soft }: { color: string; label: string; soft?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color, opacity: soft ? SOFT : 1 }} /> {label}
    </span>
  );
}
