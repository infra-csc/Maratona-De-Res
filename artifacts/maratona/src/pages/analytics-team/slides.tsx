import type { ReactNode } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList } from "recharts";
import { ThumbsUp, Target, Trophy, Award, Sparkles, Calculator, Flag, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { CONDENSED, AMBER, GOOD_TEXT, AMBER_TEXT } from "@/lib/premium-theme";
import { cn, fmtNum } from "@/lib/utils";
import type { Highlight, TeamStory } from "./derive";

const SERIES = "var(--viz-series-1)";
const GRID = "var(--viz-grid)";
const n1 = (v: number | null | undefined) => (v == null ? "—" : fmtNum(v, 1));

// ── Moldura de cada "slide" ─────────────────────────────────────────────────
// `big` = modo apresentação (tela cheia): mesma peça, tipografia maior.
export function Slide({ id, index, total, eyebrow, title, lead, big, icon: Icon, children }: {
  id: string; index: number; total: number; eyebrow: string; title: string; lead?: ReactNode;
  big?: boolean; icon?: typeof ThumbsUp; children: ReactNode;
}) {
  return (
    <section
      id={`slide-${id}`}
      aria-labelledby={`slide-${id}-title`}
      data-testid={`team-slide-${id}`}
      className={cn("rounded-2xl flex flex-col min-w-0 print-avoid-break", big ? "p-10 gap-8 h-full" : "p-6 md:p-8 gap-5")}
      style={{ backgroundColor: "var(--card)", border: big ? "none" : "1px solid var(--border)" }}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={cn("font-bold uppercase", big ? "text-[15px]" : "text-[11px]")} style={{ fontFamily: CONDENSED, letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>
            {eyebrow}
          </p>
          <h2
            id={`slide-${id}-title`}
            className={cn("font-black uppercase leading-[0.95]", big ? "text-[56px] mt-2" : "text-[26px] md:text-[30px] mt-1")}
            style={{ fontFamily: CONDENSED, letterSpacing: "-0.01em" }}
          >
            {title}
          </h2>
          {lead ? <p className={cn("mt-3 max-w-3xl leading-relaxed", big ? "text-[22px]" : "text-[14px]")} style={{ color: "var(--muted-foreground)" }}>{lead}</p> : null}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {Icon ? <Icon size={big ? 40 : 26} aria-hidden style={{ color: "var(--accent-text)" }} /> : null}
          <span className={cn("tabular-nums font-bold", big ? "text-[16px]" : "text-[12px]")} style={{ color: "var(--muted-foreground)" }} aria-label={`Parte ${index + 1} de ${total}`}>
            {index + 1}/{total}
          </span>
        </div>
      </header>
      <div className="flex-1 min-h-0">{children}</div>
    </section>
  );
}

function Empty({ children, big }: { children: ReactNode; big?: boolean }) {
  return <p className={big ? "text-[20px]" : "text-[14px]"} style={{ color: "var(--muted-foreground)" }}>{children}</p>;
}

/** Barra com rótulo e valor; `tone` só colore a barra — o texto fica nos tokens de texto. */
function Bars({ items, tone, format, big, max = 100 }: { items: Highlight[]; tone: "good" | "improve" | "neutral"; format: (v: number) => string; big?: boolean; max?: number }) {
  const fill = tone === "improve" ? AMBER : SERIES;
  return (
    <ul className={big ? "space-y-6" : "space-y-4"}>
      {items.map(it => (
        <li key={`${it.label}|${it.detail ?? ""}`} className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1.5">
          <span className="min-w-0">
            <span className={cn("font-bold", big ? "text-[26px]" : "text-[16px]")}>{it.label}</span>
            {it.detail ? <span className={cn("ml-2", big ? "text-[18px]" : "text-[13px]")} style={{ color: "var(--muted-foreground)" }}>{it.detail}</span> : null}
          </span>
          <span className={cn("font-black tabular-nums", big ? "text-[32px]" : "text-[20px]")} style={{ fontFamily: CONDENSED }}>{format(it.value)}</span>
          <div className={cn("col-span-2 rounded-full overflow-hidden", big ? "h-4" : "h-2.5")} style={{ backgroundColor: "var(--secondary)" }} aria-hidden>
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, (it.value / max) * 100))}%`, backgroundColor: fill }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Column({ title, children, big }: { title: string; children: ReactNode; big?: boolean }) {
  return (
    <div className="min-w-0 flex flex-col gap-4">
      <h3 className={cn("font-black uppercase", big ? "text-[22px]" : "text-[14px]")} style={{ fontFamily: CONDENSED, letterSpacing: "0.04em", color: "var(--muted-foreground)" }}>{title}</h3>
      {children}
    </div>
  );
}

function BigNumber({ value, label, big }: { value: string; label: string; big?: boolean }) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--secondary)" }}>
      <div className={cn("font-black leading-none tabular-nums", big ? "text-[72px]" : "text-[44px]")} style={{ fontFamily: CONDENSED }}>{value}</div>
      <div className={cn("mt-2 font-bold uppercase", big ? "text-[18px]" : "text-[12px]")} style={{ fontFamily: CONDENSED, letterSpacing: "0.06em", color: "var(--muted-foreground)" }}>{label}</div>
    </div>
  );
}

// ── As partes da apresentação ───────────────────────────────────────────────
export interface SlideDef { id: string; eyebrow: string; title: string; icon?: typeof ThumbsUp; lead?: (big: boolean) => ReactNode; body: (big: boolean) => ReactNode }

export function buildSlides(s: TeamStory): SlideDef[] {
  const pts = (v: number) => n1(v);
  const pct0 = (v: number) => `${Math.round(v)}%`;
  const slides: SlideDef[] = [];

  slides.push({
    id: "capa", eyebrow: `Maratona de Resultados · ${s.cycleName}`, title: "Como a equipe foi no ciclo", icon: Sparkles,
    lead: () => <>Resultado de todos, pela média dos eventos confirmados{s.period ? ` (${s.period})` : ""}. Aqui não aparece quem avaliou nem a nota de ninguém em particular.</>,
    body: big => (
      <div className={cn("grid gap-4", big ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-3")}>
        <BigNumber big={big} value={n1(s.teamScore)} label="Nota média dos eventos (0 a 100)" />
        <BigNumber big={big} value={String(s.eventsConfirmed)} label={`Eventos com resultado confirmado${s.eventsTotal > s.eventsConfirmed ? ` (de ${s.eventsTotal})` : ""}`} />
        <BigNumber big={big} value={String(s.people)} label="Pessoas da casa no ranking" />
      </div>
    ),
  });

  if (s.trend.length > 0) {
    const TrendIcon = s.trendDelta == null || Math.abs(s.trendDelta) < 0.5 ? Minus : s.trendDelta > 0 ? TrendingUp : TrendingDown;
    slides.push({
      id: "evolucao", eyebrow: "Ao longo do ciclo", title: "Nossa evolução", icon: TrendIcon,
      lead: () => (
        <>
          {s.trendDelta == null ? "Um fim de semana com eventos confirmados até agora." :
            Math.abs(s.trendDelta) < 0.5 ? "A nota ficou estável da primeira para a segunda metade do ciclo." :
            s.trendDelta > 0 ? <>Da primeira para a segunda metade do ciclo a nota média <strong style={{ color: GOOD_TEXT }}>subiu {pts(s.trendDelta)} pontos</strong>.</> :
            <>Da primeira para a segunda metade do ciclo a nota média <strong style={{ color: AMBER_TEXT }}>caiu {pts(Math.abs(s.trendDelta))} pontos</strong>.</>}
          {s.bestWeekend ? <> Melhor fim de semana: <strong>{s.bestWeekend.label}</strong>, com {pts(s.bestWeekend.avgScore)}.</> : null}
        </>
      ),
      body: big => (
        <div style={{ height: big ? 420 : 260 }} role="img" aria-label={s.trend.map(t => `${t.label}: ${n1(t.avgScore)}`).join("; ")}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={s.trend} margin={{ top: 28, right: 28, bottom: 4, left: -8 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="label" axisLine={{ stroke: GRID }} tickLine={false} tick={{ fontSize: big ? 15 : 11, fill: "var(--muted-foreground)" }} />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} axisLine={false} tickLine={false} tick={{ fontSize: big ? 15 : 11, fill: "var(--muted-foreground)" }} />
              <Line type="monotone" dataKey="avgScore" stroke={SERIES} strokeWidth={big ? 3 : 2} isAnimationActive={false}
                dot={{ r: big ? 6 : 4, fill: SERIES, stroke: "var(--card)", strokeWidth: 2 }}>
                <LabelList dataKey="avgScore" position="top" content={({ x, y, value }) => (
                  <text x={Number(x)} y={Number(y) - 12} textAnchor="middle" fontSize={big ? 16 : 11} fontWeight={700} fill="var(--foreground)">{n1(Number(value))}</text>
                )} />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </div>
      ),
    });
  }

  slides.push({
    id: "bom", eyebrow: "Para manter", title: "O que foi bom", icon: ThumbsUp,
    lead: () => "Critérios acima da média da equipe e itens da matriz que a equipe cumpriu com mais frequência.",
    body: big => (
      <div className={cn("grid gap-8", big ? "grid-cols-2" : "grid-cols-1 lg:grid-cols-2")}>
        <Column big={big} title="Critérios mais fortes (nota 0 a 100)">
          {s.strengths.length ? <Bars big={big} items={s.strengths} tone="good" format={pts} /> : <Empty big={big}>Ainda sem critérios avaliados.</Empty>}
        </Column>
        <Column big={big} title="Matriz de conformidade: mais cumpridos (% de Sim)">
          {s.conformityGood.length ? <Bars big={big} items={s.conformityGood} tone="good" format={pct0} /> : <Empty big={big}>Sem respostas da matriz ainda.</Empty>}
          {s.merits.occurrences > 0 ? (
            <p className={cn("flex items-center gap-2 font-semibold", big ? "text-[22px]" : "text-[14px]")}>
              <Award size={big ? 26 : 18} aria-hidden style={{ color: "var(--accent-text)" }} />
              {s.merits.occurrences} {s.merits.occurrences === 1 ? "mérito reconhecido" : "méritos reconhecidos"} no ciclo.
            </p>
          ) : null}
        </Column>
      </div>
    ),
  });

  if (s.topEvents.length) {
    slides.push({
      id: "destaques", eyebrow: "Para comemorar", title: "Eventos destaque", icon: Trophy,
      lead: () => "As maiores notas finais do ciclo, com a calibração do RH e a matriz já aplicadas.",
      body: big => (
        <ol className={cn("grid gap-4", big ? "grid-cols-3" : "grid-cols-1 md:grid-cols-3")}>
          {s.topEvents.map((e, i) => (
            <li key={e.name} className="rounded-xl p-5 flex flex-col gap-2" style={{ backgroundColor: "var(--secondary)" }}>
              <span className={cn("font-bold uppercase", big ? "text-[16px]" : "text-[11px]")} style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)", letterSpacing: "0.08em" }}>{i + 1}º lugar</span>
              <span className={cn("font-black uppercase leading-tight", big ? "text-[28px]" : "text-[18px]")} style={{ fontFamily: CONDENSED }}>{e.name}</span>
              <span className={big ? "text-[16px]" : "text-[12px]"} style={{ color: "var(--muted-foreground)" }}>{e.detail}</span>
              <span className={cn("font-black tabular-nums mt-auto", big ? "text-[56px]" : "text-[36px]")} style={{ fontFamily: CONDENSED }}>{n1(e.score)}</span>
            </li>
          ))}
        </ol>
      ),
    });
  }

  slides.push({
    id: "melhorar", eyebrow: "Para evoluir", title: "O que precisa melhorar", icon: Target,
    lead: () => "Critérios abaixo da média da equipe, itens da matriz que mais receberam \"Não\" e as ocorrências mais comuns. É aqui que a equipe ganha pontos no próximo ciclo.",
    body: big => (
      <div className={cn("grid gap-8", big ? "grid-cols-2" : "grid-cols-1 lg:grid-cols-2")}>
        <Column big={big} title="Critérios a desenvolver (nota 0 a 100)">
          {s.improvements.length ? <Bars big={big} items={s.improvements} tone="improve" format={pts} /> : <Empty big={big}>Nenhum critério abaixo da média da equipe.</Empty>}
        </Column>
        <div className="flex flex-col gap-8 min-w-0">
          <Column big={big} title='Matriz de conformidade: mais "Não" (% das respostas)'>
            {s.conformityImprove.length ? <Bars big={big} items={s.conformityImprove} tone="improve" format={pct0} /> : <Empty big={big}>Nenhum "Não" na matriz. Excelente.</Empty>}
          </Column>
          {s.commonPenalties.length ? (
            <Column big={big} title="Ocorrências mais comuns">
              <ul className={big ? "space-y-3" : "space-y-2"}>
                {s.commonPenalties.map(p => (
                  <li key={p.label} className={cn("flex items-baseline justify-between gap-4", big ? "text-[22px]" : "text-[14px]")}>
                    <span className="font-semibold">{p.label}</span>
                    <span className="tabular-nums" style={{ color: "var(--muted-foreground)" }}>{p.value} {p.value === 1 ? "ocorrência" : "ocorrências"}</span>
                  </li>
                ))}
              </ul>
            </Column>
          ) : null}
        </div>
      </div>
    ),
  });

  if (s.areas.length >= 2) {
    slides.push({
      id: "areas", eyebrow: "Visão por área", title: "Como cada área avaliou a entrega", icon: Flag,
      lead: () => "Média dos critérios que cada área avalia (0 a 100). Mostra onde a equipe brilha e onde está o espaço para crescer.",
      body: big => <Bars big={big} items={s.areas} tone="neutral" format={pts} />,
    });
  }

  const payingFaixas = s.faixas.filter(f => f.count > 0 || f.minScore != null);
  slides.push({
    id: "faixas", eyebrow: "Bônus", title: "Onde a equipe está nas faixas", icon: Award,
    lead: () => (
      <>
        {s.reachedMinEvents} de {s.people} pessoas já têm o mínimo de <strong>{s.minEvents} eventos</strong> do ciclo.
        {s.nearNextFaixa > 0 ? <> <strong>{s.nearNextFaixa}</strong> {s.nearNextFaixa === 1 ? "pessoa está" : "pessoas estão"} a menos de 3 pontos da próxima faixa.</> : null}
      </>
    ),
    body: big => {
      const max = Math.max(1, ...payingFaixas.map(f => f.count));
      return (
        <ul className={cn("grid gap-3", big ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
          {payingFaixas.map(f => (
            <li key={f.name} className="rounded-xl p-4 flex flex-col gap-2" style={{ backgroundColor: "var(--secondary)" }}>
              <span className="flex items-center justify-between gap-3">
                <span className={cn("flex items-center gap-2 font-bold", big ? "text-[24px]" : "text-[15px]")}>
                  <span aria-hidden className={cn("rounded-sm shrink-0", big ? "h-4 w-4" : "h-3 w-3")} style={{ backgroundColor: f.color ?? "var(--muted-foreground)", boxShadow: "inset 0 0 0 1px var(--border)" }} />
                  {f.name}
                  {f.minScore != null ? <span className={big ? "text-[16px]" : "text-[12px]"} style={{ color: "var(--muted-foreground)", fontWeight: 500 }}>a partir de {n1(f.minScore)}</span> : null}
                </span>
                <span className={cn("font-black tabular-nums", big ? "text-[34px]" : "text-[22px]")} style={{ fontFamily: CONDENSED }}>{f.count}</span>
              </span>
              <div className={cn("rounded-full overflow-hidden", big ? "h-3" : "h-2")} style={{ backgroundColor: "var(--card)" }} aria-hidden>
                <div className="h-full rounded-full" style={{ width: `${(f.count / max) * 100}%`, backgroundColor: SERIES }} />
              </div>
            </li>
          ))}
        </ul>
      );
    },
  });

  slides.push({
    id: "regras", eyebrow: "Transparência", title: "Como a nota é formada", icon: Calculator,
    body: big => (
      <ol className={cn("grid gap-4", big ? "grid-cols-2 text-[22px]" : "grid-cols-1 md:grid-cols-2 text-[14px]")}>
        {[
          ["Nota de cada evento", "As áreas avaliam os critérios de 0 a 10 e o RH calibra quando precisa. A média ponderada vira a nota do evento, de 0 a 100."],
          ["Matriz de conformidade", `Cada "Não" na matriz desconta ${Number.isInteger(s.pointsPerNo) ? s.pointsPerNo : n1(s.pointsPerNo)} pontos da nota do evento para toda a equipe que trabalhou nele.`],
          ["Nota do ciclo", "Média das notas dos eventos confirmados de que você participou. Penalidades descontam e méritos somam."],
          ["Bônus", `Com pelo menos ${s.minEvents} eventos no ciclo, a nota final define a faixa, e a faixa define o bônus e o valor de cada evento extra.`],
        ].map(([t, d], i) => (
          <li key={t} className="rounded-xl p-5" style={{ backgroundColor: "var(--secondary)" }}>
            <span className="font-black uppercase block" style={{ fontFamily: CONDENSED }}>{i + 1}. {t}</span>
            <span className="block mt-1.5 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{d}</span>
          </li>
        ))}
      </ol>
    ),
  });

  const focus = [
    ...s.improvements.map(c => `${c.label}${c.detail ? ` (${c.detail})` : ""}: subir a nota deste critério em cada evento.`),
    ...s.conformityImprove.map(c => `${c.label}: zerar os "Não" da matriz.`),
    ...s.commonPenalties.slice(0, 1).map(p => `${p.label}: reduzir as ocorrências.`),
  ].slice(0, 5);
  slides.push({
    id: "proximos", eyebrow: "Próximo ciclo", title: "Nosso foco", icon: Target,
    lead: () => "Cada ponto a mais na nota do evento vale para toda a equipe que trabalhou nele.",
    body: big => focus.length ? (
      <ol className={cn("space-y-3", big ? "text-[26px]" : "text-[16px]")}>
        {focus.map((f, i) => (
          <li key={f} className="flex gap-3 items-baseline">
            <span className="font-black tabular-nums shrink-0" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>{i + 1}.</span>
            <span>{f}</span>
          </li>
        ))}
      </ol>
    ) : <Empty big={big}>Tudo acima da média: o foco é manter o padrão.</Empty>,
  });

  return slides;
}
