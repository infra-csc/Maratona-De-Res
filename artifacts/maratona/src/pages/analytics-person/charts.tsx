import { useMemo, useState } from "react";
import {
  ComposedChart, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, LabelList,
} from "recharts";
import type { ScoreTimelineEntry } from "@workspace/api-client-react";
import { fmtDate } from "@/lib/utils";
import { DANGER_TEXT, GOOD_TEXT } from "@/lib/premium-theme";
import { inkOn, n1, scoreDomain, signed, type CriterionCompare, type Faixa, type PersonEvent } from "./derive";
import { AXIS_TICK, GRID, SERIES, SERIES_2, VizTooltipBox, useWidth } from "./ui";

const dm = (iso: string | null) => (iso ? fmtDate(iso.slice(0, 10)) : "—");
const dmy = (iso: string | null) => (iso ? fmtDate(iso.slice(0, 10), { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");

/** Marcas sobre as cores das faixas: tinta escura com halo branco, iguais nos dois temas. */
const MARK_INK = "#111111";
const MARK_HALO = "#ffffff";

// ── Régua das faixas ──────────────────────────────────────────────────────
export interface ScaleMarker { key: string; value: number; label: string; kind: "main" | "ghost" | "team" }

/**
 * Faixas lado a lado numa régua (recortada em volta dos valores), com a nota
 * final em destaque, a nota sem penalidades (anel) e a média da equipe (traço).
 * A legenda embaixo nomeia cada marca com o valor: a cor nunca é o único sinal.
 */
export function FaixaRuler({ faixas, markers, extraDomain = [] }: { faixas: Faixa[]; markers: ScaleMarker[]; extraDomain?: number[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [lo, hi] = scoreDomain([...markers.map(m => m.value), ...extraDomain], 3);
  const x = (v: number) => ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * 100;
  const segs = faixas.filter(f => f.maxScore >= lo && f.minScore <= hi);
  const ticks = segs.map(f => f.minScore).filter(v => v > lo && v < hi);
  const main = markers.find(m => m.kind === "main");
  const pxPerPt = (width || 600) / (hi - lo);
  return (
    <figure className="min-w-0">
      <div ref={ref} className="relative" role="img"
        aria-label={`Régua das faixas de ${n1(lo)} a ${n1(hi)}: ${markers.map(m => `${m.label} ${n1(m.value)}`).join("; ")}`}>
        {/* Rótulo da nota final, acima da régua */}
        <div className="relative h-9">
          {main && (
            <div className="absolute bottom-0 flex flex-col items-center" style={{ left: `${x(main.value)}%`, transform: "translateX(-50%)" }}>
              <span className="text-[12px] font-black tabular-nums whitespace-nowrap px-1.5 rounded" style={{ backgroundColor: "var(--foreground)", color: "var(--background)" }}>{n1(main.value)}</span>
              <svg width="10" height="6" aria-hidden><path d="M0 0 L10 0 L5 6 Z" fill="var(--foreground)" /></svg>
            </div>
          )}
        </div>
        {/* Faixas */}
        <div className="relative h-7 rounded-md overflow-hidden flex" style={{ boxShadow: "inset 0 0 0 1px var(--border)" }}>
          {segs.map(f => {
            const a = x(Math.max(lo, f.minScore)), b = x(Math.min(hi, f.maxScore + 0.01));
            const w = b - a;
            // Nome dentro da faixa, onde não cobre nenhuma marca (centro, começo ou fim); se não couber, some (o title e a legenda nomeiam).
            const W = width || 600;
            const segL = (a / 100) * W, segR = (b / 100) * W, textW = f.name.length * 6.6 + 12;
            const marks = markers.map(m => (x(m.value) / 100) * W);
            const clear = (l: number) => l >= segL + 2 && l + textW <= segR - 2 && marks.every(px => px < l - 10 || px > l + textW + 10);
            const options: [string, number][] = [["center", (segL + segR - textW) / 2], ["flex-start", segL + 4], ["flex-end", segR - textW - 4]];
            const place = options.find(([, l]) => clear(l))?.[0];
            return (
              <div key={f.name} className="h-full flex items-center overflow-hidden" title={`${f.name}: ${n1(f.minScore)} a ${n1(f.maxScore)}`}
                style={{ width: `${w}%`, backgroundColor: f.color, borderRight: "2px solid var(--card)", justifyContent: place ?? "center" }}>
                {place && <span className="text-[11px] font-bold uppercase whitespace-nowrap px-1.5" style={{ color: inkOn(f.color), letterSpacing: "0.03em" }}>{f.name}</span>}
              </div>
            );
          })}
          {/* Marcas sobre a régua */}
          {markers.map(m => (
            m.kind === "team" ? (
              <span key={m.key} aria-hidden className="absolute top-[-3px] bottom-[-3px] w-[3px] rounded-full" style={{ left: `calc(${x(m.value)}% - 1.5px)`, backgroundColor: MARK_INK, boxShadow: `0 0 0 2px ${MARK_HALO}` }} />
            ) : m.kind === "ghost" ? (
              <span key={m.key} aria-hidden className="absolute top-1/2 h-3.5 w-3.5 rounded-full" style={{ left: `${x(m.value)}%`, transform: "translate(-50%,-50%)", border: `2.5px solid ${MARK_INK}`, backgroundColor: MARK_HALO }} />
            ) : (
              <span key={m.key} aria-hidden className="absolute top-1/2 h-4 w-4 rounded-full" style={{ left: `${x(m.value)}%`, transform: "translate(-50%,-50%)", backgroundColor: MARK_INK, boxShadow: `0 0 0 2.5px ${MARK_HALO}` }} />
            )
          ))}
        </div>
        {/* Limites das faixas */}
        <div className="relative h-5 text-[11px] tabular-nums" style={{ color: "var(--muted-foreground)" }}>
          <span className="absolute left-0 top-1">{n1(lo)}</span>
          {ticks.map(t => (pxPerPt * Math.min(t - lo, hi - t) > 18) && (
            <span key={t} className="absolute top-1" style={{ left: `${x(t)}%`, transform: "translateX(-50%)" }}>{n1(t)}</span>
          ))}
          <span className="absolute right-0 top-1">{n1(hi)}</span>
        </div>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
        {markers.map(m => (
          <span key={m.key} className="inline-flex items-center gap-2">
            {/* Amostra sobre um fundo de faixa, igual ao que aparece na régua (lê igual nos dois temas). */}
            <span aria-hidden className="inline-flex h-4 w-6 items-center justify-center rounded" style={{ backgroundColor: "#cbd5e1" }}>
            {m.kind === "main" && <span aria-hidden className="h-3 w-3 rounded-full" style={{ backgroundColor: MARK_INK, boxShadow: `0 0 0 2px ${MARK_HALO}` }} />}
            {m.kind === "ghost" && <span aria-hidden className="h-3 w-3 rounded-full" style={{ border: `2px solid ${MARK_INK}`, backgroundColor: MARK_HALO }} />}
            {m.kind === "team" && <span aria-hidden className="h-3.5 w-[3px] rounded-full" style={{ backgroundColor: MARK_INK, boxShadow: `0 0 0 1.5px ${MARK_HALO}` }} />}
            </span>
            {m.label} <strong className="tabular-nums" style={{ color: "var(--foreground)" }}>{n1(m.value)}</strong>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

// ── Equipe numa linha (cada ponto é uma pessoa) ───────────────────────────
export interface StripPerson { id: number; name: string; final: number; color: string | null }

export function TeamStrip({ people, faixas, highlightId, onPick, teamAvg }: {
  people: StripPerson[]; faixas: Faixa[]; highlightId?: number | null; onPick: (id: number) => void; teamAvg: number | null;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [lo, hi] = scoreDomain(people.map(p => p.final), 2);
  const x = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const D = width > 0 && width < 520 ? 11 : 14; // diâmetro do ponto
  // Empilha pontos que se sobreporiam (enxame simples, por níveis).
  const placed = useMemo(() => {
    const w = width || 800;
    const levels: number[] = [];
    return [...people].sort((a, b) => a.final - b.final).map(p => {
      const px = ((p.final - lo) / (hi - lo)) * w;
      let lvl = levels.findIndex(last => px - last >= D + 2);
      if (lvl === -1) { lvl = levels.length; levels.push(px); } else levels[lvl] = px;
      return { ...p, lvl };
    });
  }, [people, width, lo, hi]);
  const maxLvl = Math.max(0, ...placed.map(p => p.lvl));
  const plotH = Math.max(60, (maxLvl + 1) * (D + 3) + 30);
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += 5) ticks.push(t);
  const hovered = placed.find(p => p.id === hover) ?? placed.find(p => p.id === highlightId) ?? null;
  return (
    <div ref={ref} className="relative min-w-0" style={{ paddingTop: 34 }}>
      <div className="relative rounded-md" style={{ height: plotH }}>
        {/* Fundo: faixas */}
        {faixas.filter(f => f.maxScore >= lo && f.minScore <= hi).map(f => {
          const a = x(Math.max(lo, f.minScore)), b = x(Math.min(hi, f.maxScore + 0.01));
          return (
            <div key={f.name} aria-hidden className="absolute inset-y-0" style={{ left: `${a}%`, width: `${b - a}%`, backgroundColor: `color-mix(in srgb, ${f.color} 22%, transparent)`, borderRight: "1px dashed var(--border)" }}>
              <span className="absolute left-1.5 top-1 text-[10.5px] font-bold uppercase truncate max-w-[calc(100%-8px)]" style={{ color: "var(--muted-foreground)", letterSpacing: "0.03em" }}>{f.name}</span>
            </div>
          );
        })}
        {teamAvg != null && teamAvg >= lo && teamAvg <= hi && (
          <div aria-hidden className="absolute inset-y-0 w-0" style={{ left: `${x(teamAvg)}%`, borderLeft: "2px dashed var(--muted-foreground)" }} />
        )}
        {placed.map(p => {
          const isHi = p.id === highlightId;
          return (
            <button key={p.id} type="button" onClick={() => onPick(p.id)}
              onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(p.id)} onBlur={() => setHover(null)}
              aria-label={`${p.name}: nota final ${n1(p.final)}. Abrir análise.`}
              className="absolute rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-transform hover:scale-125"
              style={{
                left: `${x(p.final)}%`, bottom: 6 + p.lvl * (D + 3), width: isHi ? D + 4 : D, height: isHi ? D + 4 : D,
                transform: "translateX(-50%)", backgroundColor: isHi ? "var(--foreground)" : SERIES,
                boxShadow: `0 0 0 2px var(--card)${isHi ? ", 0 0 0 4px var(--foreground)" : ""}`, zIndex: isHi ? 3 : 1,
              }} />
          );
        })}
        {hovered && (
          <div className="absolute z-10 pointer-events-none" style={{ left: `${Math.min(88, Math.max(12, x(hovered.final)))}%`, bottom: plotH + 4, transform: "translateX(-50%)" }}>
            <div className="rounded-md px-2 py-1 text-[12px] whitespace-nowrap shadow-md" style={{ backgroundColor: "var(--popover)", color: "var(--popover-foreground)", border: "1px solid var(--border)" }}>
              <strong>{hovered.name}</strong> <span className="tabular-nums" style={{ color: "var(--muted-foreground)" }}>· {n1(hovered.final)}</span>
            </div>
          </div>
        )}
      </div>
      <div className="relative h-5 mt-1 text-[11px] tabular-nums" style={{ color: "var(--muted-foreground)" }}>
        {ticks.map(t => <span key={t} className="absolute" style={{ left: `${x(t)}%`, transform: t === lo ? "none" : t === hi ? "translateX(-100%)" : "translateX(-50%)" }}>{t}</span>)}
      </div>
    </div>
  );
}

// ── Nota evento a evento ──────────────────────────────────────────────────
export function EventsChart({ events, teamAvg, faixas, name }: { events: PersonEvent[]; teamAvg: number | null; faixas: Faixa[]; name: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const rows = events.map((e, i) => ({ ...e, i, label: dm(e.date) }));
  const domain = scoreDomain([...rows.map(r => r.score), teamAvg], 3);
  const wide = width === 0 || width >= 560;
  const thresholds = wide ? faixas.filter(f => f.minScore > domain[0] && f.minScore < domain[1]) : [];
  const showValues = rows.length <= (wide ? 16 : 7);
  return (
    <figure className="min-w-0">
      <div ref={ref} style={{ height: 280 }} role="img"
        aria-label={`Nota de cada evento de ${name}: ${rows.map(r => `${r.label} ${r.name} ${n1(r.score)}`).join("; ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 22, right: wide ? 112 : 12, bottom: 4, left: -14 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="i" tickFormatter={(i: number) => rows[i]?.label ?? ""} axisLine={{ stroke: GRID }} tickLine={false} tick={AXIS_TICK} interval="preserveStartEnd" minTickGap={14} padding={{ left: 18, right: 18 }} />
            <YAxis domain={domain} ticks={Array.from({ length: Math.floor((domain[1] - domain[0]) / 5) + 1 }, (_, k) => domain[0] + k * 5)} allowDecimals={false} axisLine={false} tickLine={false} tick={AXIS_TICK} width={44} />
            {thresholds.map(f => (
              <ReferenceLine key={f.name} y={f.minScore} stroke={f.color} strokeOpacity={teamAvg != null && Math.abs(f.minScore - teamAvg) < 1 ? 0 : 1} strokeDasharray="2 4" strokeWidth={1.5}
                label={{ value: `${f.name} · ${n1(f.minScore)}`, position: "right", fontSize: 11, fill: "var(--muted-foreground)" }} />
            ))}
            {teamAvg != null && <ReferenceLine y={teamAvg} stroke="var(--muted-foreground)" strokeDasharray="6 4" strokeWidth={1.5} />}
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const r = payload[0].payload as (typeof rows)[number];
                return (
                  <VizTooltipBox title={r.name} lines={[
                    { label: "Data", value: dmy(r.date) },
                    { label: "Nota do evento", value: n1(r.score) },
                    { label: "Média até aqui", value: n1(r.runningAvg) },
                    ...(r.faixaName ? [{ label: "Faixa do evento", value: r.faixaName }] : []),
                    ...(r.conformityPenalty ? [{ label: "Matriz de conformidade", value: `−${n1(r.conformityPenalty)}` }] : []),
                    ...(teamAvg != null ? [{ label: "Média dos eventos do ciclo", value: n1(teamAvg) }] : []),
                  ]} />
                );
              }}
            />
            <Line type="monotone" dataKey="runningAvg" stroke={SERIES_2} strokeWidth={2} strokeDasharray="6 3" dot={false} activeDot={{ r: 5, fill: SERIES_2, stroke: "var(--card)", strokeWidth: 2 }} isAnimationActive={false} />
            <Line type="linear" dataKey="score" stroke={SERIES} strokeWidth={2} isAnimationActive={false}
              dot={{ r: 5, fill: SERIES, stroke: "var(--card)", strokeWidth: 2 }} activeDot={{ r: 7, fill: SERIES, stroke: "var(--card)", strokeWidth: 2 }}>
              {showValues && (
                <LabelList dataKey="score" content={({ x, y, value }) => (
                  <text x={Number(x)} y={Number(y) - 11} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--foreground)">{n1(Number(value))}</text>
                )} />
              )}
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
        <LegendLine color={SERIES} label="Nota de cada evento" dot />
        <LegendLine color={SERIES_2} label="Média até o evento (média bruta acumulada)" dash="6 3" />
        {teamAvg != null && <LegendLine color="var(--muted-foreground)" label={`Média dos eventos do ciclo · ${n1(teamAvg)}`} dash="6 4" />}
        {thresholds.length > 0 && <LegendLine color="var(--muted-foreground)" label="Início de cada faixa" dash="2 4" />}
      </figcaption>
    </figure>
  );
}

function LegendLine({ color, label, dash, dot }: { color: string; label: string; dash?: string; dot?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="24" height="10" aria-hidden>
        <line x1="0" y1="5" x2="24" y2="5" stroke={color} strokeWidth="2" strokeDasharray={dash} />
        {dot && <circle cx="12" cy="5" r="4" fill={color} stroke="var(--card)" strokeWidth="1.5" />}
      </svg>
      {label}
    </span>
  );
}

// ── Evolução da nota final (linha do tempo, só admin e RH) ────────────────
const ENTRY_LABEL: Record<string, string> = {
  event_counted: "Evento entrou na nota", penalty: "Penalidade", merit: "Mérito",
  penalty_removed: "Penalidade excluída", merit_removed: "Mérito excluído",
  calibrate: "Calibração", recalibrate_released: "Recalibração", cycle_excluded: "Retirado do ciclo", cycle_included: "Devolvido ao ciclo",
};
export const entryTitle = (e: ScoreTimelineEntry) => {
  const base = ENTRY_LABEL[e.type] ?? (e.type.startsWith("publish_") ? "Nota publicada" : "Nota recalculada");
  return e.type === "penalty" || e.type === "merit" ? `${base} · ${e.label ?? "lançamento"}` : base;
};

export function EvolutionChart({ entries, currentFinal, faixas, name }: { entries: ScoreTimelineEntry[]; currentFinal: number | null; faixas: Faixa[]; name: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const rows = useMemo(() => {
    const pts = entries
      .filter(e => e.kind !== "info" && e.finalAfter != null)
      .map(e => ({ t: new Date(e.at).getTime(), at: e.at, value: e.finalAfter as number, title: entryTitle(e), detail: e.eventName ?? null, before: e.finalBefore ?? null }));
    if (currentFinal != null) pts.push({ t: Date.now(), at: new Date().toISOString(), value: currentFinal, title: "Hoje", detail: null, before: null });
    return pts.sort((a, b) => a.t - b.t);
  }, [entries, currentFinal]);
  if (rows.length < 2) return null;
  const domain = scoreDomain(rows.map(r => r.value), 2);
  const wide = width === 0 || width >= 560;
  const thresholds = faixas.filter(f => f.minScore > domain[0] && f.minScore < domain[1]);
  return (
    <figure className="min-w-0">
      <div ref={ref} style={{ height: 240 }} role="img" aria-label={`Nota final de ${name} ao longo do ciclo: ${rows.map(r => `${dm(r.at)} ${n1(r.value)}`).join("; ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 12, right: wide ? 112 : 12, bottom: 4, left: -14 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={(v: number) => dm(new Date(v).toISOString())}
              axisLine={{ stroke: GRID }} tickLine={false} tick={AXIS_TICK} minTickGap={28} />
            <YAxis domain={domain} ticks={Array.from({ length: Math.floor((domain[1] - domain[0]) / 5) + 1 }, (_, k) => domain[0] + k * 5)} allowDecimals={false} axisLine={false} tickLine={false} tick={AXIS_TICK} width={44} />
            {thresholds.map(f => (
              <ReferenceLine key={f.name} y={f.minScore} stroke={f.color} strokeDasharray="2 4" strokeWidth={1.5}
                label={wide ? { value: `${f.name} · ${n1(f.minScore)}`, position: "right", fontSize: 11, fill: "var(--muted-foreground)" } : undefined} />
            ))}
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const r = payload[0].payload as (typeof rows)[number];
                return (
                  <VizTooltipBox title={`${dmy(r.at)} · ${r.title}`} lines={[
                    ...(r.detail ? [{ label: "Evento", value: r.detail }] : []),
                    ...(r.before != null ? [{ label: "Antes", value: n1(r.before) }] : []),
                    { label: "Nota final", value: n1(r.value) },
                  ]} />
                );
              }}
            />
            <Line type="stepAfter" dataKey="value" stroke={SERIES} strokeWidth={2} isAnimationActive={false}
              dot={{ r: 3.5, fill: SERIES, stroke: "var(--card)", strokeWidth: 2 }} activeDot={{ r: 6, fill: SERIES, stroke: "var(--card)", strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {thresholds.length > 0 && !wide && (
        <figcaption className="mt-2 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
          Linhas pontilhadas: início das faixas {thresholds.map(f => `${f.name} (${n1(f.minScore)})`).join(", ")}.
        </figcaption>
      )}
    </figure>
  );
}

// ── Critérios: dele × ciclo ───────────────────────────────────────────────
export function CriteriaDumbbell({ rows }: { rows: CriterionCompare[] }) {
  const [lo, hi] = scoreDomain(rows.flatMap(r => [r.mine, r.team]), 3);
  const x = (v: number) => ((v - lo) / (hi - lo)) * 100;
  return (
    <figure className="min-w-0">
      <ul className="space-y-3" aria-label="Critérios: média nos eventos dele e média do ciclo">
        {rows.map(r => {
          const up = r.diff >= 0.05, down = r.diff <= -0.05;
          const a = x(Math.min(r.mine, r.team)), b = x(Math.max(r.mine, r.team));
          return (
            <li key={r.key} className="grid grid-cols-1 sm:grid-cols-[minmax(0,38%)_1fr_64px] items-center gap-x-3 gap-y-1">
              <div className="min-w-0 flex items-baseline justify-between gap-2 sm:block">
                <p className="text-[12.5px] font-semibold leading-tight truncate" title={`${r.name}${r.area ? ` · ${r.area}` : ""}`}>{r.name}</p>
                <p className="text-[11px] leading-tight truncate" style={{ color: "var(--muted-foreground)" }}>{r.area ? `${r.area} · ` : ""}{r.myEvents} de {r.teamEvents} eventos</p>
              </div>
              <div className="relative h-5" role="img" aria-label={`${r.name}: ${n1(r.mine)} nos eventos dele, ${n1(r.team)} no ciclo`}>
                <div aria-hidden className="absolute inset-x-0 top-1/2 h-px" style={{ backgroundColor: GRID }} />
                <div aria-hidden className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full" style={{ left: `${a}%`, width: `${Math.max(0, b - a)}%`, backgroundColor: up ? "var(--status-ok)" : down ? "var(--status-danger)" : "var(--border)" }} />
                <span aria-hidden className="absolute top-1/2 h-3 w-3 rounded-full -translate-x-1/2 -translate-y-1/2" style={{ left: `${x(r.team)}%`, border: "2px solid var(--muted-foreground)", backgroundColor: "var(--card)" }} />
                <span aria-hidden className="absolute top-1/2 h-3.5 w-3.5 rounded-full -translate-x-1/2 -translate-y-1/2" style={{ left: `${x(r.mine)}%`, backgroundColor: SERIES, boxShadow: "0 0 0 2px var(--card)" }} />
              </div>
              <div className="hidden sm:block text-right leading-tight">
                <p className="text-[13px] font-black tabular-nums">{n1(r.mine)}</p>
                <p className="text-[11px] font-bold tabular-nums" style={{ color: up ? GOOD_TEXT : down ? DANGER_TEXT : "var(--muted-foreground)" }}>
                  {up ? "▲" : down ? "▼" : "="} {signed(r.diff)}
                </p>
              </div>
              <p className="sm:hidden text-[12px] tabular-nums" style={{ color: "var(--muted-foreground)" }}>
                <strong style={{ color: "var(--foreground)" }}>{n1(r.mine)}</strong> × ciclo {n1(r.team)}{" "}
                <strong style={{ color: up ? GOOD_TEXT : down ? DANGER_TEXT : "var(--muted-foreground)" }}>{up ? "▲" : down ? "▼" : "="} {signed(r.diff)}</strong>
              </p>
            </li>
          );
        })}
      </ul>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
        <span className="inline-flex items-center gap-2"><span aria-hidden className="h-3 w-3 rounded-full" style={{ backgroundColor: SERIES }} /> Média nos eventos dele</span>
        <span className="inline-flex items-center gap-2"><span aria-hidden className="h-3 w-3 rounded-full" style={{ border: "2px solid var(--muted-foreground)" }} /> Média de todos os eventos do ciclo</span>
        <span className="tabular-nums">Escala {lo} a {hi}</span>
      </figcaption>
    </figure>
  );
}
