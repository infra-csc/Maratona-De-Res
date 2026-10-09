// "Leitura do ciclo": a pergunta da tela — onde estamos bem, onde estamos mal
// e onde agir — respondida em frases curtas, tiradas só dos números do painel
// (nada inventado: cada frase aponta para o bloco ou a tela que a sustenta).
import type { ReactNode } from "react";
import { Link } from "wouter";
import type { AnalyticsOverview } from "@workspace/api-client-react";
import { ArrowDown, ArrowRight, Compass, TrendingDown, TrendingUp } from "lucide-react";
import { displayCriterionName } from "@/lib/criterion-name";
import { cn, plural } from "@/lib/utils";
import { Block } from "./block";
import { n1 } from "./indicators";

type Item = { key: string; text: ReactNode; href?: string; cta?: string };

const crit = (c: { name: string; area?: string | null }) => (
  <><b className="font-semibold text-foreground">{displayCriterionName(c.name)}</b>{c.area ? <span className="text-muted-foreground"> · {c.area}</span> : null}</>
);

export function ReadingPanel({ data, isAll, readOnly, withCycle }: {
  data: AnalyticsOverview; isAll: boolean; readOnly: boolean; withCycle: (href: string) => string;
}) {
  const k = data.kpis;
  const good: Item[] = [];
  const bad: Item[] = [];
  const act: Item[] = [];

  // Critérios (vêm do mais fraco ao mais forte).
  const weakest = data.criteria[0];
  const strongest = data.criteria.length > 1 ? data.criteria[data.criteria.length - 1] : null;
  // Todos com a mesma média: não existe "mais forte" nem "mais fraco".
  const tied = !!weakest && !!strongest && Math.abs(strongest.avgScore - weakest.avgScore) < 0.05;
  if (tied) good.push({ key: "crit", text: <>Todos os {data.criteria.length} critérios com a mesma média: <b className="tabular-nums text-foreground">{n1(weakest.avgScore)}</b>.</>, href: "#criterios" });
  else if (weakest && strongest) {
    good.push({ key: "crit", text: <>Critério mais forte: {crit(strongest)}, média <b className="tabular-nums text-foreground">{n1(strongest.avgScore)}</b>.</>, href: "#criterios" });
    bad.push({ key: "crit", text: <>Critério mais fraco: {crit(weakest)}, média <b className="tabular-nums text-foreground">{n1(weakest.avgScore)}</b>.</>, href: "#criterios" });
  }

  // Matriz: o item com mais "Não" (só se houve algum) e os itens sem nenhum "Não".
  const answered = data.conformity.filter(c => c.naoPct != null);
  const worst = [...answered].filter(c => c.nao > 0).sort((a, b) => (b.naoPct ?? 0) - (a.naoPct ?? 0))[0];
  const clean = answered.filter(c => c.nao === 0);
  if (worst) bad.push({ key: "matriz", text: <>Matriz: <b className="font-semibold text-foreground">{worst.label}</b> com “Não” em <b className="tabular-nums text-foreground">{n1(worst.naoPct)}%</b> das respostas.</>, href: "#matriz" });
  if (answered.length > 0 && clean.length === answered.length) good.push({ key: "matriz", text: <>Matriz de conformidade sem nenhum “Não” nos eventos confirmados.</>, href: "#matriz" });
  else if (clean.length > 0) good.push({ key: "matriz", text: <>Matriz sem “Não” em {clean.map(c => c.label).join(", ")}.</>, href: "#matriz" });

  // Bônus: quanto da equipe chegou lá.
  if (k.collaborators > 0 && k.withBonus > 0) {
    good.push({ key: "bonus", text: <><b className="tabular-nums text-foreground">{k.withBonus}</b> de {plural(k.collaborators, isAll ? "participação" : "colaborador", isAll ? "participações" : "colaboradores")} com bônus{readOnly ? "" : " hoje"}.</>, href: "#funil" });
  }
  const penalties = data.adjustments.filter(a => a.kind !== "merit");
  if (penalties.length > 0) {
    const pts = penalties.reduce((s, a) => s + a.points, 0);
    const people = data.topPenalized.length;
    bad.push({ key: "pen", text: <>{plural(k.penaltiesCount, "penalidade lançada", "penalidades lançadas")} (<b className="tabular-nums text-foreground">−{n1(pts)}</b> pontos){people > 0 ? <> em {plural(people, "pessoa", "pessoas")}</> : null}.</>, href: "#lancamentos" });
  }

  // Quem participou e ainda não chegou ao mínimo de eventos do bônus.
  const short = Math.max(0, k.collaborators - k.reachedMinEvents);
  if (k.collaborators > 0 && short > 0) {
    bad.push({ key: "min", text: <><b className="tabular-nums text-foreground">{short}</b> de {plural(k.collaborators, isAll ? "participação" : "colaborador", isAll ? "participações" : "colaboradores")} {readOnly ? (short === 1 ? "não chegou" : "não chegaram") : (short === 1 ? "ainda não chegou" : "ainda não chegaram")} ao mínimo de eventos do bônus{isAll ? "" : ` (${k.minEvents})`}.</>, href: "#funil" });
  }

  // Avaliadores que a calibração costuma corrigir em 5 pontos ou mais (a partir de 3 casos).
  const offBias = data.evaluators.filter(e => e.biasSamples >= 3 && e.calibrationBias != null && Math.abs(e.calibrationBias) >= 5).length;
  if (offBias > 0) bad.push({ key: "bias", text: <>{plural(offBias, "avaliador tem", "avaliadores têm")} nota que a calibração costuma corrigir em 5 pontos ou mais.</>, href: "#avaliadores" });

  // Onde agir: só no ciclo atual (fora dele, nada mais muda).
  const unconfirmed = Math.max(0, k.eventsTotal - k.eventsConfirmed);
  if (!readOnly) {
    if (unconfirmed > 0) act.push({ key: "conf", text: <>{plural(unconfirmed, "evento ainda sem confirmação", "eventos ainda sem confirmação")} — não {unconfirmed === 1 ? "entra" : "entram"} na nota.</>, href: "/events?status=unconfirmed", cta: "Ver eventos" });
    if (data.nearNextFaixa.length > 0) act.push({ key: "perto", text: <>{plural(data.nearNextFaixa.length, "elegível está", "elegíveis estão")} a até 3 pontos da próxima faixa que paga bônus.</>, href: "#perto", cta: "Ver quem" });
    if (k.evaluationsDraft > 0) act.push({ key: "draft", text: <>{plural(k.evaluationsDraft, "avaliação em rascunho", "avaliações em rascunho")} — ainda não {k.evaluationsDraft === 1 ? "conta" : "contam"}.</>, href: "/evaluations", cta: "Abrir a Central" });
    if (act.length < 3) act.push({ key: "cal", text: <>Ajustar e publicar as notas dos critérios.</>, href: "/calibrations", cta: "Calibrações" });
  } else {
    act.push({ key: "ev", text: <>Nota final, critérios e equipe de cada evento confirmado.</>, href: withCycle("/analytics/eventos"), cta: "Por evento" });
    act.push({ key: "res", text: <>Ranking e pagamento do bônus {isAll ? "de cada ciclo" : "deste ciclo"}.</>, href: withCycle("/results"), cta: "Resultados" });
  }

  return (
    <Block
      id="leitura"
      testId="analytics-reading"
      icon={Compass}
      title={isAll ? "Leitura de todos os ciclos" : "Leitura do ciclo"}
      sub={isAll ? "Todos os ciclos somados: o que vai bem, o que vai mal e para onde olhar." : "Onde estamos bem, onde estamos mal e onde agir — tirado dos números abaixo."}
    >
      <div className="grid md:grid-cols-3 border-t border-border md:divide-x divide-border">
        <Column tone="ok" icon={TrendingUp} title="Onde estamos bem" items={good.slice(0, 3)} empty="Nada a destacar ainda." testId="reading-good" />
        <Column tone="danger" icon={TrendingDown} title="Onde estamos mal" items={bad.slice(0, 3)} empty="Nenhum ponto fraco nos números até aqui." testId="reading-bad" className="border-t md:border-t-0 border-border" />
        <Column tone="act" icon={ArrowRight} title={readOnly ? "Para consultar" : "Onde agir"} items={act.slice(0, 3)} empty="" testId="analytics-where-to-act" className="border-t md:border-t-0 border-border" />
      </div>
    </Block>
  );
}

function Column({ tone, icon: Icon, title, items, empty, testId, className }: {
  tone: "ok" | "danger" | "act"; icon: typeof TrendingUp; title: string; items: Item[]; empty: string; testId: string; className?: string;
}) {
  const color = tone === "ok" ? "text-[var(--status-ok-text)]" : tone === "danger" ? "text-[var(--status-danger-text)]" : "text-foreground";
  return (
    <div data-testid={testId} className={cn("px-4 lg:px-5 py-4 min-w-0", className)}>
      <h3 className={cn("flex items-center gap-1.5 font-condensed text-[13px] font-bold uppercase tracking-[0.08em]", color)}>
        <Icon size={15} aria-hidden /> {title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-2.5 text-[13.5px] text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map(it => (
            <li key={it.key} className="text-[13.5px] leading-snug text-muted-foreground">
              {it.text}
              {it.href && (
                <>
                  {" "}
                  {it.href.startsWith("#") ? (
                    <a href={it.href} onClick={e => { e.preventDefault(); scrollToBlock(it.href!.slice(1)); }}
                      className="group inline-flex items-center gap-0.5 whitespace-nowrap font-semibold text-foreground underline decoration-border underline-offset-[3px] hover:decoration-foreground transition-colors duration-150 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {it.cta ?? "Ver"}<ArrowDown size={12} aria-hidden className="transition-transform duration-150 group-hover:translate-y-0.5 motion-reduce:transition-none" />
                    </a>
                  ) : (
                    <Link href={it.href} className="group inline-flex items-center gap-0.5 whitespace-nowrap font-semibold text-foreground underline decoration-border underline-offset-[3px] hover:decoration-foreground transition-colors duration-150 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {it.cta ?? "Abrir"}<ArrowRight size={12} aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                    </Link>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Rola até um bloco do painel (respeita "reduzir movimento") e leva o foco junto. */
export function scrollToBlock(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
}
