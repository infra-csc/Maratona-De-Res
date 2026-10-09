// As partes da Apresentação para a equipe: um recado por parte, números
// grandes e pouco texto — pensado para o telão (1920×1080 ou 1366×768). A
// moldura e a escala ficam em ./stage.
import type { ReactNode } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList, Tooltip } from "recharts";
import { Award, CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";
import { AMBER } from "@/lib/premium-theme";
import { cn, fmtNum, faixaEdge, plural } from "@/lib/utils";
import type { Highlight, TeamStory } from "./derive";
import { ColumnHeading, SlideNote, TYPE, u, type SlideTone } from "./stage";

const SERIES = "var(--viz-series-1)";
const GRID = "var(--viz-grid)";
/** Trilho das barras: um passo acima da superfície, visível no claro e no escuro. */
const TRACK = "color-mix(in srgb, var(--foreground) 9%, transparent)";
const n1 = (v: number | null | undefined) => (v == null ? "—" : fmtNum(v, 1));
const pct0 = (v: number) => `${Math.round(v)}%`;

export interface SlideDef { id: string; eyebrow: string; title: string; tone?: SlideTone; lead?: ReactNode; body: ReactNode }

// ── Peças ───────────────────────────────────────────────────────────────────

/** Barras horizontais com rótulo e valor; a cor só no traço, o texto nos tokens de texto. */
function Bars({ items, tone, format, max = 100 }: { items: Highlight[]; tone: SlideTone; format: (v: number) => string; max?: number }) {
  const fill = tone === "improve" ? AMBER : SERIES;
  return (
    <ul className="flex flex-col" style={{ gap: u(34, 16) }}>
      {items.map(it => (
        <li key={`${it.label}|${it.detail ?? ""}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-end" style={{ columnGap: u(32, 12), rowGap: u(14, 6) }}>
          <span className="min-w-0">
            <span className="block font-semibold text-foreground break-words" style={TYPE.label}>{it.label}</span>
            {it.detail ? <span className="block text-muted-foreground" style={{ ...TYPE.detail, marginTop: u(4, 2) }}>{it.detail}</span> : null}
          </span>
          <span className="font-condensed font-black text-foreground whitespace-nowrap" style={TYPE.value}>{format(it.value)}</span>
          <span aria-hidden className="col-span-2 rounded-full overflow-hidden" style={{ height: u(16, 8), backgroundColor: TRACK }}>
            <span className="block h-full rounded-full" style={{ width: `${Math.max(1.5, Math.min(100, (it.value / max) * 100))}%`, backgroundColor: fill }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Número de apoio com contorno em cima (a mesma "faixa com contorno" das outras telas). */
function Stat({ value, label, accent }: { value: ReactNode; label: ReactNode; accent?: boolean }) {
  return (
    <div className="min-w-0" style={{ borderTop: `${accent ? u(6, 3) : u(2, 1)} solid ${accent ? "var(--accent)" : "var(--border)"}`, paddingTop: u(28, 12) }}>
      <div className="font-condensed font-black text-foreground whitespace-nowrap" style={TYPE.stat}>{value}</div>
      <div className="font-condensed font-bold uppercase text-muted-foreground" style={{ ...TYPE.heading, marginTop: u(18, 8) }}>{label}</div>
    </div>
  );
}

/** Recado positivo de uma parte inteira (nada a corrigir). */
function Cheer({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center font-condensed font-black uppercase text-foreground text-balance" style={{ fontSize: u(64, 24), lineHeight: 1.02, gap: u(28, 12), maxWidth: "32ch" }}>
      <CheckCircle2 aria-hidden className="shrink-0" style={{ width: u(80, 30), height: u(80, 30), color: "var(--accent-text)" }} />
      <span>{children}</span>
    </p>
  );
}

/** Rótulo de valor da linha: só no último ponto e no melhor (nunca em todos). */
function TrendChart({ trend }: { trend: TeamStory["trend"] }) {
  const values = trend.map(t => t.avgScore);
  const lo = Math.max(0, Math.floor((Math.min(...values) - 10) / 10) * 10);
  const step = 100 - lo <= 50 ? 10 : 25;
  const ticks: number[] = [];
  for (let v = lo; v <= 100; v += step) ticks.push(v);
  const best = values.indexOf(Math.max(...values));
  const last = values.length - 1;
  const tick = (anchor: "middle" | "end") => (p: { x?: number | string; y?: number | string; payload?: { value?: string | number } }) => (
    <text x={Number(p.x)} y={Number(p.y)} dy={anchor === "end" ? 4 : 16} dx={anchor === "end" ? -6 : 0} textAnchor={anchor}
      style={{ fontSize: u(22, 11), fill: "var(--muted-foreground)" }}>
      {anchor === "end" ? fmtNum(Number(p.payload?.value), 0) : String(p.payload?.value ?? "")}
    </text>
  );
  return (
    <div className="w-full" style={{ height: u(560, 220) }} role="img"
      aria-label={`Nota média por fim de semana: ${trend.map(t => `${t.label}, ${n1(t.avgScore)}`).join("; ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trend} margin={{ top: 40, right: 36, bottom: 8, left: 4 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" axisLine={{ stroke: GRID }} tickLine={false} tick={tick("middle")} interval="preserveStartEnd" minTickGap={12} />
          <YAxis domain={[lo, 100]} ticks={ticks} axisLine={false} tickLine={false} tick={tick("end")} width={44} />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              const row = active ? (payload?.[0]?.payload as TeamStory["trend"][number] | undefined) : undefined;
              if (!row) return null;
              return (
                <div className="rounded-lg border border-border bg-popover text-popover-foreground shadow-md px-3 py-2 text-[13px]">
                  <div className="font-condensed text-[12px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Fim de semana de {row.label}</div>
                  <div className="mt-0.5"><span className="font-condensed text-[20px] font-black">{n1(row.avgScore)}</span> <span className="text-muted-foreground">· {plural(row.events, "evento")}</span></div>
                </div>
              );
            }}
          />
          <Line type="monotone" dataKey="avgScore" stroke={SERIES} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" isAnimationActive={false}
            dot={{ r: 5, fill: SERIES, stroke: "var(--card)", strokeWidth: 2 }} activeDot={{ r: 7, fill: SERIES, stroke: "var(--card)", strokeWidth: 2 }}>
            <LabelList dataKey="avgScore" content={({ x, y, value, index }) => (index === last || index === best) ? (
              <text x={Number(x)} y={Number(y) - 16} textAnchor={index === last ? "end" : "middle"} dx={index === last ? 8 : 0}
                style={{ fontSize: u(30, 13), fontWeight: 800, fill: "var(--foreground)", fontFamily: "var(--font-condensed)" }}>
                {n1(Number(value))}
              </text>
            ) : null} />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── As partes ───────────────────────────────────────────────────────────────

/** Rodapé de cada parte: de onde vêm os números. */
export const slideMeta = (s: TeamStory) => `Maratona de Resultados · ${s.cycleName}`;

export function buildSlides(s: TeamStory): SlideDef[] {
  const all = s.scopeKind === "all";
  const past = s.scopeKind === "past";
  const slides: SlideDef[] = [];

  // Ciclo sem evento confirmado (o caso de um ciclo que acabou de começar):
  // nada de oito partes com "—"; a capa diz o que vem e as regras explicam o jogo.
  if (s.eventsConfirmed === 0) {
    slides.push({
      id: "capa", eyebrow: s.period ?? s.cycleName,
      title: past ? "Este ciclo não teve resultado confirmado" : all ? "Ainda sem resultado confirmado" : "O ciclo está começando",
      lead: past || all
        ? "Sem evento com resultado confirmado, não há notas da equipe para mostrar."
        : "Os números da equipe aparecem aqui quando o primeiro evento tiver o resultado confirmado. Até lá, vale combinar como a nota é formada.",
      body: (
        <div className="grid gap-x-[6%] gap-y-8 @3xl:grid-cols-2 items-end">
          <Stat accent value={fmtNum(s.eventsTotal, 0)} label={s.eventsTotal === 1 ? "evento no ciclo até agora" : "eventos no ciclo até agora"} />
          <Stat value="0" label="com resultado confirmado" />
        </div>
      ),
    });
    pushRules(slides, s);
    return slides;
  }

  slides.push({
    id: "capa", eyebrow: s.period ? `${s.cycleName} · ${s.period}` : s.cycleName,
    title: all ? "Como a equipe foi em todos os ciclos" : "Como a equipe foi no ciclo",
    lead: "O resultado de todos, pela média dos eventos confirmados. Aqui não aparece quem avaliou nem a nota de ninguém em particular.",
    body: (
      <div className="grid gap-y-10 @3xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] @3xl:gap-x-[7%] items-end">
        <div className="min-w-0">
          <div className="font-condensed font-bold uppercase text-muted-foreground" style={{ ...TYPE.heading, marginBottom: u(20, 8) }}>Nota média dos eventos</div>
          <div className="flex items-baseline flex-wrap" style={{ gap: u(24, 10) }}>
            <span className="font-condensed font-black text-foreground" style={TYPE.hero} data-testid="team-score">{n1(s.teamScore)}</span>
            <span className="font-condensed font-bold uppercase text-muted-foreground" style={{ fontSize: u(40, 16) }}>de 100</span>
          </div>
        </div>
        <div className="grid grid-cols-2 min-w-0" style={{ columnGap: u(56, 16) }}>
          <Stat accent
            value={<>{fmtNum(s.eventsConfirmed, 0)}{s.eventsTotal > s.eventsConfirmed ? <span className="text-muted-foreground font-bold" style={{ fontSize: u(44, 18), letterSpacing: 0, marginLeft: u(14, 6) }}>de {fmtNum(s.eventsTotal, 0)}</span> : null}</>}
            label={s.eventsConfirmed === 1 ? "evento confirmado" : "eventos confirmados"} />
          <Stat value={fmtNum(s.people, 0)} label={all ? "participações nos rankings" : s.people === 1 ? "pessoa no ranking" : "pessoas no ranking"} />
        </div>
      </div>
    ),
  });

  if (s.trend.length > 0) {
    const d = s.trendDelta;
    const flat = d == null || Math.abs(d) < 0.5;
    const TrendIcon = d != null && d < 0 ? TrendingDown : TrendingUp;
    const metade = all ? "período" : "ciclo";
    slides.push({
      id: "evolucao", eyebrow: all ? "Ao longo dos ciclos" : "Ao longo do ciclo", title: "Nossa evolução", tone: flat || d > 0 ? "good" : "improve",
      lead: d == null ? "Um fim de semana com eventos confirmados até agora."
        : flat ? `A nota média ficou estável da primeira para a segunda metade do ${metade}.`
        : d > 0 ? `Da primeira para a segunda metade do ${metade}, a nota média subiu.` : `Da primeira para a segunda metade do ${metade}, a nota média caiu.`,
      body: (
        <div className="grid gap-y-8 @4xl:grid-cols-[minmax(0,0.9fr)_minmax(0,2.4fr)] @4xl:gap-x-[5%] items-center">
          <div className="grid grid-cols-2 @4xl:grid-cols-1 min-w-0" style={{ columnGap: u(48, 16), rowGap: u(56, 20) }}>
            {d == null ? null : (
              <Stat accent
                value={<span className="inline-flex items-center" style={{ gap: u(16, 6) }}>
                  {flat ? null : <TrendIcon aria-hidden style={{ width: u(84, 32), height: u(84, 32), color: d > 0 ? "var(--accent-text)" : "var(--status-warn-text)" }} />}
                  {flat ? "Estável" : `${d > 0 ? "+" : "−"}${n1(Math.abs(d))}`}
                </span>}
                label={flat ? "da 1ª para a 2ª metade" : "pontos da 1ª para a 2ª metade"} />
            )}
            {s.bestWeekend ? <Stat accent={d == null} value={s.bestWeekend.label} label={`${d == null ? "fim de semana" : "melhor fim de semana"} · ${n1(s.bestWeekend.avgScore)}`} /> : null}
          </div>
          <TrendChart trend={s.trend} />
        </div>
      ),
    });
  }

  slides.push({
    id: "bom", eyebrow: "Para manter", title: "O que foi bom", tone: "good",
    lead: "O que a equipe já faz bem e precisa manter.",
    body: (
      <div className="grid gap-y-12 @3xl:grid-cols-2 @3xl:gap-x-[7%] items-start">
        <div className="min-w-0">
          <ColumnHeading hint="nota de 0 a 100">Critérios mais fortes</ColumnHeading>
          {s.strengths.length ? <Bars items={s.strengths} tone="good" format={n1} /> : <SlideNote>Ainda sem critérios avaliados.</SlideNote>}
        </div>
        <div className="min-w-0">
          <ColumnHeading hint="% de Sim">Matriz de conformidade</ColumnHeading>
          {s.conformityGood.length ? <Bars items={s.conformityGood} tone="good" format={pct0} /> : <SlideNote>Sem respostas da matriz ainda.</SlideNote>}
          {s.merits.occurrences > 0 ? (
            <p className="flex items-center font-semibold text-foreground" style={{ ...TYPE.body, gap: u(14, 8), marginTop: u(44, 18) }}>
              <Award aria-hidden className="shrink-0" style={{ width: u(36, 18), height: u(36, 18), color: "var(--accent-text)" }} />
              {s.merits.occurrences === 1 ? "1 mérito reconhecido" : `${fmtNum(s.merits.occurrences, 0)} méritos reconhecidos`} {all ? "em todos os ciclos" : "no ciclo"}
            </p>
          ) : null}
        </div>
      </div>
    ),
  });

  if (s.topEvents.length) {
    slides.push({
      id: "destaques", eyebrow: "Para comemorar", title: "Eventos destaque", tone: "good",
      lead: `As maiores notas finais ${all ? "de todos os ciclos" : "do ciclo"}, já com a calibração e a matriz aplicadas.`,
      body: (
        <ol className="grid gap-y-10 @3xl:grid-cols-3 @3xl:gap-x-[4%]">
          {s.topEvents.map((e, i) => (
            <li key={`${e.name}|${i}`} className="min-w-0 flex flex-col"
              style={{ borderTop: `${i === 0 ? u(6, 3) : u(2, 1)} solid ${i === 0 ? "var(--accent)" : "var(--border)"}`, paddingTop: u(28, 12) }}>
              <span className="font-condensed font-black" style={{ fontSize: u(40, 16), color: i === 0 ? "var(--accent-text)" : "var(--muted-foreground)" }}>{i + 1}º</span>
              <span className="font-condensed font-black uppercase text-foreground break-words" style={{ fontSize: u(46, 19), lineHeight: 1, marginTop: u(14, 6) }}>{e.name}</span>
              <span className="text-muted-foreground" style={{ ...TYPE.detail, marginTop: u(12, 6) }}>{e.detail}</span>
              <span className="font-condensed font-black text-foreground mt-auto" style={{ ...TYPE.stat, paddingTop: u(36, 14) }}>{n1(e.score)}</span>
            </li>
          ))}
        </ol>
      ),
    });
  }

  slides.push({
    id: "melhorar", eyebrow: "Para evoluir", title: "O que precisa melhorar",
    tone: s.improvements.length || s.conformityImprove.length || s.commonPenalties.length ? "improve" : "good",
    lead: "É aqui que a equipe ganha pontos no próximo ciclo.",
    // Nada abaixo da média, nenhum "Não" e nenhuma ocorrência: um recado só, não três colunas vazias.
    body: !s.improvements.length && !s.conformityImprove.length && !s.commonPenalties.length ? (
      <Cheer>Nada abaixo da média da equipe, nenhum &quot;Não&quot; na matriz e nenhuma ocorrência.</Cheer>
    ) : (
      // Com ocorrências, três colunas lado a lado no telão: tudo cabe no quadro sem apertar.
      <div className={cn("grid gap-y-12 @3xl:grid-cols-2 items-start", s.commonPenalties.length ? "@3xl:gap-x-[6%] @6xl:grid-cols-3 @6xl:gap-x-[4.5%]" : "@3xl:gap-x-[7%]")}>
        <div className="min-w-0">
          <ColumnHeading hint="nota de 0 a 100">Critérios a desenvolver</ColumnHeading>
          {s.improvements.length ? <Bars items={s.improvements} tone="improve" format={n1} /> : <SlideNote>Nenhum critério abaixo da média da equipe.</SlideNote>}
        </div>
        <div className="min-w-0">
          <ColumnHeading hint={"% de \"Não\""}>Matriz de conformidade</ColumnHeading>
          {s.conformityImprove.length ? <Bars items={s.conformityImprove} tone="improve" format={pct0} /> : <SlideNote>Nenhum &quot;Não&quot; na matriz. Excelente.</SlideNote>}
        </div>
        {s.commonPenalties.length ? (
          <div className="min-w-0">
            <ColumnHeading>Ocorrências mais comuns</ColumnHeading>
            <ul className="flex flex-col" style={{ gap: u(32, 14) }}>
              {s.commonPenalties.map(p => (
                <li key={p.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline" style={{ columnGap: u(24, 12) }}>
                  <span className="font-semibold text-foreground min-w-0 break-words" style={TYPE.label}>{p.label}</span>
                  <span className="font-condensed font-black text-foreground whitespace-nowrap" style={TYPE.value}>
                    {fmtNum(p.value, 0)}<span className="font-bold uppercase text-muted-foreground" style={{ ...TYPE.heading, marginLeft: u(10, 5) }}>{p.value === 1 ? "vez" : "vezes"}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    ),
  });

  if (s.areas.length >= 2) {
    slides.push({
      id: "areas", eyebrow: "Visão por área", title: "Como cada área avaliou a entrega",
      lead: "Média dos critérios que cada área avalia, de 0 a 100: onde a equipe brilha e onde há espaço para crescer.",
      body: <div className="max-w-full @4xl:max-w-[78%]"><Bars items={s.areas} tone="neutral" format={n1} /></div>,
    });
  }

  const faixas = s.faixas.filter(f => f.count > 0 || f.minScore != null);
  if (faixas.length) {
    const max = Math.max(1, ...faixas.map(f => f.count));
    slides.push({
      id: "faixas", eyebrow: "Bônus", title: "Onde a equipe está nas faixas",
      lead: (
        <>
          {all
            ? <>Cada pessoa conta uma vez por ciclo. Em <strong className="text-foreground">{fmtNum(s.reachedMinEvents, 0)} de {fmtNum(s.people, 0)}</strong> participações a pessoa atingiu o mínimo de eventos do ciclo.</>
            : <><strong className="text-foreground">{fmtNum(s.reachedMinEvents, 0)} de {fmtNum(s.people, 0)}</strong> {past ? "pessoas tiveram" : "pessoas já têm"} o mínimo de {plural(s.minEvents, "evento")} do ciclo.</>}
          {!all && s.nearNextFaixa > 0 ? <> <strong className="text-foreground">{s.nearNextFaixa === 1 ? "1 pessoa está" : `${fmtNum(s.nearNextFaixa, 0)} pessoas estão`}</strong> a menos de 3 pontos da próxima faixa.</> : null}
        </>
      ),
      body: (
        <ul className="flex flex-col" style={{ gap: u(22, 12) }}>
          {faixas.map(f => {
            const zero = f.count === 0;
            return (
              <li key={f.name} className="grid items-center grid-cols-[minmax(0,1fr)_auto] @3xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)_auto]" style={{ columnGap: u(36, 12), rowGap: u(8, 6) }}>
                <span className="flex items-baseline flex-wrap min-w-0" style={{ columnGap: u(16, 8) }}>
                  <span aria-hidden className="shrink-0 self-center rounded-[3px]" style={{ width: u(26, 12), height: u(26, 12), backgroundColor: f.color ?? "var(--muted-foreground)", ...faixaEdge(f.color) }} />
                  <span className={cn("font-semibold break-words", zero ? "text-muted-foreground" : "text-foreground")} style={{ fontSize: u(34, 16), lineHeight: 1.1 }}>{f.name}</span>
                  {f.minScore != null ? <span className="text-muted-foreground whitespace-nowrap" style={TYPE.detail}>a partir de {n1(f.minScore)}</span> : null}
                </span>
                <span aria-hidden className="order-last col-span-2 @3xl:order-none @3xl:col-span-1 rounded-full overflow-hidden" style={{ height: u(16, 6), backgroundColor: TRACK }}>
                  {!zero && <span className="block h-full rounded-full" style={{ width: `${(f.count / max) * 100}%`, backgroundColor: SERIES }} />}
                </span>
                <span className={cn("font-condensed font-black text-right tabular-nums", zero ? "text-muted-foreground" : "text-foreground")} style={{ fontSize: u(52, 22), lineHeight: 1, minWidth: u(72, 28) }}>
                  {fmtNum(f.count, 0)}
                </span>
              </li>
            );
          })}
        </ul>
      ),
    });
  }

  pushRules(slides, s);

  const focus = [
    ...s.improvements.map(c => ({ label: c.detail ? `${c.label} · ${c.detail}` : c.label, action: "Subir a nota deste critério em cada evento." })),
    ...s.conformityImprove.map(c => ({ label: c.label, action: "Zerar os \"Não\" da matriz." })),
    ...s.commonPenalties.slice(0, 1).map(p => ({ label: p.label, action: "Reduzir as ocorrências." })),
  ].slice(0, 5);
  slides.push({
    id: "proximos", eyebrow: "Próximo ciclo", title: "Nosso foco", tone: focus.length ? "improve" : "good",
    lead: "Cada ponto a mais na nota do evento vale para toda a equipe que trabalhou nele.",
    body: focus.length ? (
      <ol className={cn("grid", focus.length > 3 && "@6xl:grid-flow-col @6xl:grid-rows-3 @6xl:grid-cols-2 @6xl:gap-x-[6%]")} style={{ rowGap: u(36, 14) }}>
        {focus.map((f, i) => (
          <li key={f.label} className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline" style={{ columnGap: u(32, 12) }}>
            <span className="font-condensed font-black text-[var(--accent-text)] tabular-nums" style={{ fontSize: u(64, 26), lineHeight: 1 }}>{i + 1}</span>
            <span className="min-w-0">
              <span className="block font-semibold text-foreground break-words" style={TYPE.label}>{f.label}</span>
              <span className="block text-muted-foreground" style={{ ...TYPE.body, marginTop: u(4, 2) }}>{f.action}</span>
            </span>
          </li>
        ))}
      </ol>
    ) : (
      <Cheer>Tudo acima da média: o foco é manter o padrão.</Cheer>
    ),
  });

  return slides;
}

/** "Como a nota é formada": vale para qualquer ciclo, inclusive o que acabou de começar. */
function pushRules(slides: SlideDef[], s: TeamStory) {
  const pts = Number.isInteger(s.pointsPerNo) ? String(s.pointsPerNo) : n1(s.pointsPerNo);
  const steps: [string, string][] = [
    ["Nota de cada evento", "As áreas avaliam os critérios de 0 a 10 e a calibração ajusta quando precisa. A média ponderada vira a nota do evento, de 0 a 100."],
    ["Matriz de conformidade", `Cada "Não" na matriz desconta ${pts} pontos da nota do evento, para toda a equipe que trabalhou nele.`],
    ["Nota do ciclo", "Média das notas dos eventos confirmados de que você participou. Penalidades descontam e méritos somam."],
    ["Bônus", `Com pelo menos ${plural(s.minEvents, "evento")} no ciclo, a nota final define a faixa, e a faixa define o bônus e o valor de cada evento extra.`],
  ];
  slides.push({
    id: "regras", eyebrow: "Transparência", title: "Como a nota é formada",
    body: (
      <ol className="grid gap-y-10 @3xl:grid-cols-2 @6xl:grid-cols-4 @3xl:gap-x-[4%]">
        {steps.map(([t, d], i) => (
          <li key={t} className="min-w-0" style={{ borderTop: `${u(2, 1)} solid var(--border)`, paddingTop: u(28, 12) }}>
            <span className="block font-condensed font-black text-[var(--accent-text)]" style={{ fontSize: u(96, 36), lineHeight: 0.9 }}>{i + 1}</span>
            <span className="block font-condensed font-black uppercase text-foreground" style={{ fontSize: u(36, 17), lineHeight: 1.05, marginTop: u(22, 8) }}>{t}</span>
            <span className="block text-muted-foreground" style={{ ...TYPE.body, marginTop: u(14, 6) }}>{d}</span>
          </li>
        ))}
      </ol>
    ),
  });
}
