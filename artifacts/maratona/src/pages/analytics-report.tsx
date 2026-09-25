import { useEffect, useRef } from "react";
import { Link } from "wouter";
import { useGetAnalyticsOverview, getGetAnalyticsOverviewQueryKey, type AnalyticsOverview } from "@workspace/api-client-react";
import { AlertTriangle, ArrowLeft, Printer } from "lucide-react";
import { EmptyState, LoadingState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { CONDENSED, BODY } from "@/lib/premium-theme";
import { fmtDate, fmtNum } from "@/lib/utils";

/*
 * Relatório do ciclo para imprimir ou salvar em PDF (Análises → Exportar).
 * Documento em A4: resumo em texto, indicadores, as mesmas análises da tela
 * em tabelas legíveis no papel e as regras de negócio com os números em vigor
 * (faixas, mínimo de eventos, peso da matriz) vindos da API — nada fixo aqui.
 */

const FULL: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };
const n1 = (v: number | null | undefined) => (v == null ? "—" : fmtNum(v, 1));
const brl = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }));
/** Limite de faixa com 2 casas: 69,99 não pode virar "70,0". */
const lim = (v: number | null | undefined) => (v == null ? "—" : fmtNum(v, 2));
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const plural = (n: number, one: string, many: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;

function Section({ title, lead, children, breakBefore }: { title: string; lead?: string; children: React.ReactNode; breakBefore?: boolean }) {
  return (
    <section className={`space-y-3 ${breakBefore ? "print-page-break" : ""}`}>
      <header className="print-avoid-break">
        <h2 className="text-[19px] font-black uppercase leading-tight" style={{ fontFamily: CONDENSED, letterSpacing: "0.01em" }}>{title}</h2>
        {lead && <p className="text-[13px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>{lead}</p>}
      </header>
      {children}
    </section>
  );
}

function Table({ head, rows, align }: { head: string[]; rows: React.ReactNode[][]; align?: ("l" | "r")[] }) {
  if (rows.length === 0) return <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>Sem dados neste ciclo.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px] border-collapse">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} className={`py-1.5 px-2 font-bold uppercase text-[11px] ${(align?.[i] ?? (i === 0 ? "l" : "r")) === "l" ? "text-left" : "text-right"}`}
                style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)", borderBottom: "1.5px solid var(--foreground)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="print-avoid-break">
              {r.map((c, ci) => (
                <td key={ci} className={`py-1.5 px-2 align-top ${(align?.[ci] ?? (ci === 0 ? "l" : "r")) === "l" ? "text-left" : "text-right tabular-nums"}`}
                  style={{ borderBottom: "1px solid var(--border)" }}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Barra horizontal simples (imprime em qualquer navegador, ao contrário de SVG animado). */
function Bar({ value, max }: { value: number; max: number }) {
  return (
    <span className="inline-block align-middle h-2 w-24 rounded-sm overflow-hidden mr-2" style={{ backgroundColor: "var(--secondary)" }} aria-hidden>
      <span className="block h-full" style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%`, backgroundColor: "var(--viz-series-1)" }} />
    </span>
  );
}

function Kpi({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="print-avoid-break rounded-lg px-3 py-2.5" style={{ border: "1px solid var(--border)" }}>
      <div className="text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.06em", color: "var(--muted-foreground)" }}>{label}</div>
      <div className="text-[24px] font-black leading-none mt-1 tabular-nums" style={{ fontFamily: CONDENSED }}>{value}</div>
      {detail && <div className="text-[11.5px] mt-1" style={{ color: "var(--muted-foreground)" }}>{detail}</div>}
    </div>
  );
}

/** Frases do resumo executivo, montadas só com o que os dados sustentam. */
function summaryLines(d: AnalyticsOverview): string[] {
  const k = d.kpis;
  const out: string[] = [];
  out.push(`${plural(k.eventsConfirmed, "evento confirmado", "eventos confirmados")} de ${k.eventsTotal} no ciclo (${pct(k.eventsConfirmed, k.eventsTotal)}%). Só os confirmados entram na nota e no bônus.`);
  if (k.avgFinalResult != null) out.push(`Nota final média de ${n1(k.avgFinalResult)} entre ${plural(k.collaborators, "colaborador", "colaboradores")} do ranking; a nota média dos eventos é ${n1(k.avgEventScore)}.`);
  out.push(`${plural(k.eligible, "pessoa elegível", "pessoas elegíveis")} ao bônus e ${plural(k.withBonus, "com bônus", "com bônus")} hoje, somando ${brl(k.bonusTotal)} projetados. ${plural(k.reachedMinEvents, "pessoa atingiu", "pessoas atingiram")} o mínimo de ${k.minEvents} eventos.`);
  const weakest = d.criteria[0];
  const strongest = d.criteria[d.criteria.length - 1];
  if (weakest && strongest && weakest !== strongest) out.push(`Critério mais fraco: ${weakest.name} (${n1(weakest.avgScore)}); mais forte: ${strongest.name} (${n1(strongest.avgScore)}).`);
  const worst = [...d.conformity].filter(c => c.naoPct != null && c.nao > 0).sort((a, b) => (b.naoPct ?? 0) - (a.naoPct ?? 0))[0];
  if (worst) out.push(`Na matriz de conformidade, "${worst.label}" teve mais "Não": ${n1(worst.naoPct)}% das respostas.`);
  if (k.avgCalibrationShift != null) out.push(`A calibração do RH moveu as notas em média ${k.avgCalibrationShift > 0 ? "+" : ""}${n1(k.avgCalibrationShift)} ponto(s) em ${plural(k.calibratedCriteria, "critério", "critérios")}.`);
  if (d.nearNextFaixa.length > 0) out.push(`${plural(d.nearNextFaixa.length, "elegível está", "elegíveis estão")} a até 3 pontos da próxima faixa que paga bônus.`);
  if (k.evaluationsDraft > 0) out.push(`${plural(k.evaluationsDraft, "avaliação parada", "avaliações paradas")} em rascunho.`);
  return out;
}

export default function AnalyticsReportPage() {
  const { data, isLoading, isError, error } = useGetAnalyticsOverview({
    query: { queryKey: getGetAnalyticsOverviewQueryKey(), staleTime: 60_000 },
  });
  const printed = useRef(false);
  // Exportar → "Relatório em PDF" abre esta página com ?imprimir=1: chama a
  // impressão uma vez, quando os dados chegam (o usuário escolhe "Salvar como PDF").
  useEffect(() => {
    if (!data || printed.current) return;
    if (!new URLSearchParams(window.location.search).has("imprimir")) return;
    const t = window.setTimeout(() => {
      printed.current = true;
      // Tira o ?imprimir da URL: recarregar a página não abre a impressão de novo.
      window.history.replaceState(window.history.state, "", window.location.pathname);
      window.print();
    }, 400);
    return () => window.clearTimeout(t);
  }, [data]);

  if (isLoading) return <div className="px-6 py-6"><LoadingState lines={10} withHeader label="Montando o relatório" /></div>;
  if (isError || !data) {
    return (
      <div className="px-6 py-10">
        <EmptyState icon={AlertTriangle} title="Não foi possível montar o relatório" description={(error as { message?: string } | null)?.message ?? "Tente novamente em instantes."}
          action={<Button variant="outline" asChild><Link href="/analytics">Voltar para Análises</Link></Button>} />
      </div>
    );
  }
  return <Report data={data} />;
}

function Report({ data }: { data: AnalyticsOverview }) {
  const { user } = useAuth();
  const k = data.kpis;
  const rs = data.ruleSet;
  const period = data.cycle.startDate && data.cycle.endDate ? `${fmtDate(data.cycle.startDate, FULL)} a ${fmtDate(data.cycle.endDate, FULL)}` : "período não definido";
  const generatedAt = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const paying = data.faixas.filter(f => (f.bonusValue ?? 0) > 0);
  const firstPaying = paying[0];
  const maxTrend = Math.max(1, ...data.scoreTrend.map(t => t.avgScore));
  const maxFaixa = Math.max(1, ...data.faixas.map(f => f.count));

  return (
    <div className="px-4 md:px-6 py-6" style={{ fontFamily: BODY }}>
      {/* Barra de ações (fora do papel) */}
      <div className="no-print max-w-[860px] mx-auto mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/analytics" className="inline-flex items-center gap-1.5 text-[13px] font-semibold hover:underline underline-offset-2" style={{ color: "var(--muted-foreground)" }}>
          <ArrowLeft size={14} aria-hidden /> Voltar para Análises
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>Na janela de impressão, escolha "Salvar como PDF".</span>
          <Button onClick={() => window.print()} data-testid="button-print-report"><Printer size={15} aria-hidden /> Imprimir / salvar PDF</Button>
        </div>
      </div>

      <article className="max-w-[860px] mx-auto rounded-xl px-6 md:px-10 py-8 space-y-8" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }} data-testid="analytics-report">
        {/* Cabeçalho do documento */}
        <header className="space-y-2 pb-4" style={{ borderBottom: "2px solid var(--foreground)" }}>
          <p className="text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.12em", color: "var(--accent-text)" }}>Maratona de Resultados · Relatório do ciclo</p>
          <h1 className="text-[34px] font-black uppercase leading-none" style={{ fontFamily: CONDENSED }}>{data.cycle.name}</h1>
          <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            Período {period} · gerado em {generatedAt}{user?.name ? ` por ${user.name}` : ""}. Números do momento da geração; o ciclo ainda muda enquanto eventos forem confirmados.
          </p>
        </header>

        <Section title="Resumo">
          <ul className="space-y-1.5 text-[13.5px] leading-relaxed list-disc pl-5">
            {summaryLines(data).map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </Section>

        <Section title="Indicadores">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <Kpi label="Nota final média" value={n1(k.avgFinalResult)} detail={`${k.collaborators} no ranking`} />
            <Kpi label="Nota média dos eventos" value={n1(k.avgEventScore)} detail={`${k.eventsScored} com nota oficial`} />
            <Kpi label="Eventos confirmados" value={`${k.eventsConfirmed}/${k.eventsTotal}`} detail={`${pct(k.eventsConfirmed, k.eventsTotal)}% do ciclo`} />
            <Kpi label="Elegíveis ao bônus" value={`${k.eligible}/${k.collaborators}`} detail={`${k.withBonus} com bônus`} />
            <Kpi label="Bônus projetado" value={brl(k.bonusTotal)} detail="Soma dos elegíveis" />
            <Kpi label="Avaliações enviadas" value={String(k.evaluationsSubmitted)} detail={`${k.evaluationsDraft} em rascunho`} />
            <Kpi label="Critérios calibrados" value={String(k.calibratedCriteria)} detail={k.avgCalibrationShift != null ? `ajuste médio ${n1(k.avgCalibrationShift)} pts` : undefined} />
            <Kpi label="Penalidades / méritos" value={`${k.penaltiesCount} / ${k.meritsCount}`} detail="lançamentos no ciclo" />
          </div>
        </Section>

        <Section title="Evolução da nota por fim de semana" lead="Média da nota oficial dos eventos confirmados (0 a 100).">
          <Table head={["Fim de semana", "Nota média", "Eventos"]} rows={data.scoreTrend.map(t => [t.label, <span key="v"><Bar value={t.avgScore} max={maxTrend} />{n1(t.avgScore)}</span>, t.events])} />
        </Section>

        <Section title="Critérios" lead="Eventos confirmados, do mais fraco para o mais forte. Nota usada = calibrada pelo RH quando existe; senão, média dos avaliadores (0 a 100).">
          <Table head={["Critério", "Área", "Nota usada", "Avaliadores", "Calibrada", "Eventos"]} align={["l", "l", "r", "r", "r", "r"]}
            rows={data.criteria.map(c => [c.name, c.area ?? "—", <span key="v"><Bar value={c.avgScore} max={100} />{n1(c.avgScore)}</span>, n1(c.evaluatorAvg), c.calibratedCount > 0 ? `${n1(c.calibratedAvg)} (${c.calibratedCount})` : "—", c.eventsCount])} />
        </Section>

        <Section title="Matriz de conformidade" lead={'Eventos confirmados: quanto das respostas foi "Não" em cada item.'}>
          <Table head={["Item", "Respostas", "Não", "% Não"]} rows={data.conformity.map(c => [c.label, c.answered, c.nao, c.naoPct == null ? "—" : `${n1(c.naoPct)}%`])} />
        </Section>

        <Section title="Faixas e bônus" lead="Onde cada colaborador do ranking está hoje e o bônus projetado dos elegíveis." breakBefore>
          <Table head={["Faixa", "Nota", "Pessoas", "Bônus projetado"]} align={["l", "r", "r", "r"]}
            rows={data.faixas.map(f => [f.name, f.minScore != null ? `${lim(f.minScore)}–${lim(f.maxScore)}` : "—", <span key="v"><Bar value={f.count} max={maxFaixa} />{f.count}</span>, f.bonusTotal > 0 ? brl(f.bonusTotal) : "—"])} />
          <Table head={["Funil do bônus", "Pessoas", "% do total"]} rows={data.funnel.map(f => [f.label, f.count, `${pct(f.count, data.funnel[0]?.count ?? 0)}%`])} />
        </Section>

        <Section title="Perto da próxima faixa" lead="Elegíveis a até 3 pontos da próxima faixa que paga bônus.">
          <Table head={["Colaborador", "Nota", "Faixa atual", "Próxima", "Faltam", "Bônus hoje", "Na próxima"]} align={["l", "r", "l", "l", "r", "r", "r"]}
            rows={data.nearNextFaixa.map(r => [r.name, n1(r.finalResult), r.currentFaixa ?? "—", r.nextFaixa, `${n1(r.gap)} pt`, brl(r.currentBonus), brl(r.potentialBonus)])} />
        </Section>

        <Section title="Avaliadores" lead={'"Ajuste" compara a nota do avaliador com a calibrada pelo RH (positivo = RH subiu). "Dias até enviar" conta a partir do fim do evento.'}>
          <Table head={["Avaliador", "Enviadas", "Rascunhos", "Nota média", "Ajuste", "Dias até enviar"]}
            rows={data.evaluators.map(e => [e.name, e.submitted, e.drafts, n1(e.avgGiven), e.biasSamples >= 3 ? `${(e.calibrationBias ?? 0) > 0 ? "+" : ""}${n1(e.calibrationBias)}` : "—", n1(e.avgDaysToSubmit)])} />
        </Section>

        <Section title="Penalidades, méritos e clientes">
          <Table head={["Lançamento", "Tipo", "Ocorrências", "Pontos", "Pessoas"]} align={["l", "l", "r", "r", "r"]}
            rows={data.adjustments.map(a => [a.label, a.kind === "merit" ? "Mérito" : "Penalidade", a.occurrences, `${a.kind === "merit" ? "+" : "−"}${a.points}`, a.employees])} />
          <Table head={["Cliente", "Nota média", "Eventos"]} rows={data.clients.map(c => [c.client, n1(c.avgScore), c.events])} />
        </Section>

        {/* ── Regras de negócio (valores em vigor, vindos da API) ── */}
        <Section title="Regras de negócio" lead="Como a nota e o bônus são calculados hoje no sistema." breakBefore>
          <ol className="space-y-2.5 text-[13px] leading-relaxed list-decimal pl-5">
            <li><strong>O que conta.</strong> Só eventos com resultados confirmados pelo RH entram na nota, na elegibilidade e no bônus. Concorrem os colaboradores da casa; freelas não entram no ranking e a participação como "Sup Ceno" é informativa.</li>
            <li><strong>Nota do evento (performance).</strong> Cada critério recebe nota de 0 a 10. Vale a nota calibrada pelo RH quando existe; senão, a média dos avaliadores do critério. A nota do evento é a média ponderada pelos pesos dos critérios, convertida para 0 a 100.</li>
            <li><strong>Matriz de conformidade.</strong> Quatro itens (EPI, estaiamento e aterramento, guarda de equipamentos, conduta). Cada "Sim" vale {fmtNum(rs.conformityItemPoints, 0)} pontos e item sem resposta conta como "Sim". O que falta para 100 vira desconto de {fmtNum(rs.conformityPenaltyFactor * 100, 0)}%: cada "Não" tira {fmtNum(rs.conformityPenaltyPerNo, 0)} pontos da nota do evento, que fica entre 0 e 100.</li>
            <li><strong>Nota final do ciclo.</strong> Média das notas dos eventos confirmados, menos (penalidades − méritos) dividido pelo número de eventos, entre 0 e 100. Nota 0 legítima conta na média; evento sem nota nenhuma fica de fora.</li>
            <li><strong>Elegibilidade.</strong> É preciso ter pelo menos {rs.minEvents} eventos confirmados no ciclo. O RH pode definir a elegibilidade de um colaborador manualmente, registrando o motivo.</li>
            <li><strong>Bônus.</strong> A nota final define a faixa. O bônus é o prêmio base da faixa mais, para cada evento além dos {rs.minEvents} primeiros (em ordem de data), o valor por evento extra da <em>mesma</em> faixa. Faixa que não paga bônus zera tudo, inclusive os extras.
              {firstPaying && <> Exemplo: nota na faixa {firstPaying.name} com 3 eventos extras = {brl(firstPaying.bonusValue)} + 3 × {brl(firstPaying.bonusPerExtraEvent)} = {brl((firstPaying.bonusValue ?? 0) + 3 * (firstPaying.bonusPerExtraEvent ?? 0))}.</>}
            </li>
          </ol>
          <Table head={["Faixa", "Nota mínima", "Nota máxima", "Prêmio base", "Por evento extra"]} align={["l", "r", "r", "r", "r"]}
            rows={data.faixas.filter(f => f.minScore != null).map(f => [f.name, lim(f.minScore), lim(f.maxScore), (f.bonusValue ?? 0) > 0 ? brl(f.bonusValue) : "sem bônus", (f.bonusPerExtraEvent ?? 0) > 0 ? brl(f.bonusPerExtraEvent) : "—"])} />
        </Section>

        <footer className="pt-4 text-[11.5px]" style={{ borderTop: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
          Relatório gerado pelo sistema Maratona de Resultados com os dados de {data.cycle.name}. Contém valores de bônus por colaborador: uso interno de RH e diretoria.
        </footer>
      </article>
    </div>
  );
}
