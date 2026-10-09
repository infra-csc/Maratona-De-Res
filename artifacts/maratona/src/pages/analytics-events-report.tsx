import { useEffect, useMemo, useRef } from "react";
import { Link } from "wouter";
import { useCycleScope } from "@/components/cycle-select";
import { useGetAnalyticsEventsReport, getGetAnalyticsEventsReportQueryKey, type EventsReport, type EventReportRow } from "@workspace/api-client-react";
import { CalendarCheck2, Printer } from "lucide-react";
import { CycleScopeNotice, type CycleScopeState } from "@/components/cycle-select";
import { AnalyticsScopeFallback, AnalyticsTopBar, analyticsBody } from "./analytics-team/analytics-tabs";
import { Chip, btnSmall, surfaceCls } from "./dashboard/dashboard-ui";
import { useAuth } from "@/lib/auth-context";
import { CONDENSED, BODY } from "@/lib/premium-theme";
import { cn, fmtNum, plural } from "@/lib/utils";
import { displayCriterionName } from "@/lib/criterion-name";

/*
 * Relatório por evento (Análises → Exportar → Relatório por evento em PDF):
 * nota final oficial de cada evento confirmado, já calibrada, com os
 * critérios (avaliadores, calibração e justificativa) e a equipe. Mesmo
 * conteúdo do PDF revisado com o RH; imprime em A4 pelo CSS de impressão.
 */

const br = (d: string | null | undefined) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "—");
const f1 = (v: number | null | undefined) => (v == null ? "—" : fmtNum(v, 1));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
/** "Qualidade da Entrega (2)" e "(cópia)" voltam ao nome de origem. */
const baseName = (n: string) => n.replace(/\s*\((?:\d+|c[óo]pia)\)\s*$/i, "").trim();
/** Cópia por área de um critério multiárea ("Prazo (2)", peso 0): entra na nota pela média das áreas com o de origem. */
const isAreaCopy = (c: { name: string; weight: number }, all: { name: string; weight: number }[]) =>
  !(c.weight > 0) && baseName(c.name) !== c.name && all.some(o => o.weight > 0 && o.name === baseName(c.name));
/** Nota de critério (0 a 10) mostrada de 0 a 100, a escala da nota final e de Análises. */
const f100 = (v: number | null | undefined) => (v == null ? "—" : fmtNum(v * 10, 1));
/** Nota ≥ 80 em verde, < 70 em vermelho (legenda no índice). */
const scoreColor = (v: number | null | undefined) => (v == null ? undefined : v >= 80 ? "var(--status-ok-text)" : v < 70 ? "var(--status-danger-text)" : undefined);

function H2({ children, breakBefore }: { children: React.ReactNode; breakBefore?: boolean }) {
  return (
    <h2 className={`text-[19px] font-black uppercase leading-tight pt-2 mt-2 ${breakBefore ? "print-page-break" : ""}`}
      style={{ fontFamily: CONDENSED, borderTop: "1.5px solid var(--foreground)" }}>{children}</h2>
  );
}

const TH = "py-1.5 px-2 font-bold uppercase text-[11px]";
const thStyle = { fontFamily: CONDENSED, color: "var(--muted-foreground)", borderBottom: "1.5px solid var(--foreground)" } as const;
const tdStyle = { borderBottom: "1px solid var(--border)" } as const;

function EventCard({ e }: { e: EventReportRow }) {
  const counts = e.team.filter(t => t.countsForScore);
  const info = e.team.filter(t => !t.countsForScore);
  const place = [e.clientName, [e.city, e.state].filter(Boolean).join("/")].filter(Boolean).join(" · ");
  return (
    <section id={`ev-${e.id}`} className="print-avoid-break scroll-mt-32 rounded-xl p-4 space-y-3 border border-border">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[12.5px] text-muted-foreground tabular-nums">
            {br(e.startDate)}{e.endDate && e.endDate !== e.startDate ? ` a ${br(e.endDate)}` : ""}{place ? ` · ${place}` : ""}
          </p>
          <h3 className="mt-0.5 font-condensed text-[19px] font-black uppercase leading-tight text-foreground">{e.name}</h3>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Chip tone="ok">Confirmado</Chip>
            {e.isHistorical ? <Chip>Importado com nota pronta</Chip> : (
              <>
                <Chip>Performance {f1(e.performanceScore)}</Chip>
                <Chip tone={e.conformityPenalty ? "warn" : "neutral"}>Matriz {e.conformityPenalty ? `−${f1(e.conformityPenalty)} pts` : "sem desconto"}</Chip>
                <Chip>{e.calibratedCriteria}/{e.totalCriteria} calibrados</Chip>
              </>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="block font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Nota final</span>
          <span className="block mt-1 font-condensed text-[36px] font-black leading-none tabular-nums" style={{ color: scoreColor(e.finalScore) }}>{f1(e.finalScore)}</span>
        </div>
      </header>

      {e.criteria.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[12px] border-collapse">
            <thead>
              <tr>
                <th className={`${TH} text-left`} style={thStyle}>Critério</th>
                <th className={`${TH} text-left`} style={thStyle}>Área</th>
                <th className={`${TH} text-right`} style={thStyle}>Peso</th>
                <th className={`${TH} text-right`} style={thStyle}>Avaliadores</th>
                <th className={`${TH} text-right`} style={thStyle}>Calibrada</th>
                <th className={`${TH} text-right`} style={thStyle}>Usada</th>
                <th className={`${TH} text-left`} style={thStyle}>Justificativa da calibração</th>
              </tr>
            </thead>
            <tbody>
              {e.criteria.map((c, i) => {
                const areaCopy = isAreaCopy(c, e.criteria);
                const counted = c.weight > 0 || areaCopy;
                return (
                  <tr key={i} style={{ color: counted && c.active ? undefined : "var(--muted-foreground)" }}>
                    <td className="py-1 px-2" style={tdStyle}>
                      {displayCriterionName(c.name)}
                      {areaCopy && <span className="ml-1.5 text-[10.5px] uppercase rounded px-1" style={{ border: "1px solid var(--border)" }}>média das áreas</span>}
                      {!counted && <span className="ml-1.5 text-[10.5px] uppercase rounded px-1" style={{ border: "1px solid var(--border)" }}>peso 0 · não conta</span>}
                      {counted && !c.active && <span className="ml-1.5 text-[10.5px] uppercase rounded px-1" style={{ border: "1px solid var(--border)" }}>inativo, calibrado</span>}
                    </td>
                    <td className="py-1 px-2" style={tdStyle}>{c.area ?? "—"}</td>
                    <td className="py-1 px-2 text-right tabular-nums" style={tdStyle}>{areaCopy ? "—" : c.weight}</td>
                    <td className="py-1 px-2 text-right tabular-nums" style={tdStyle}>{f100(c.evaluatorAvg)}</td>
                    <td className="py-1 px-2 text-right tabular-nums font-bold" style={tdStyle}>{f100(c.calibrated)}</td>
                    <td className="py-1 px-2 text-right tabular-nums" style={tdStyle}>{f100(c.used)}</td>
                    <td className="py-1 px-2 text-[11.5px]" style={{ ...tdStyle, color: "var(--muted-foreground)" }}>{c.calibrationReason ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-[12px] space-y-1">
        <p>
          <strong>Equipe que conta para a nota ({counts.length}):</strong>{" "}
          {counts.length ? counts.map((t, i) => (
            <span key={i}>{i > 0 && ", "}{t.name}{t.functionName && <span style={{ color: "var(--muted-foreground)" }}> ({t.functionName})</span>}</span>
          )) : "—"}
        </p>
        {info.length > 0 && (
          <p style={{ color: "var(--muted-foreground)" }}><strong>Participação informativa ({info.length}):</strong> {info.map(t => t.name).join(", ")}</p>
        )}
      </div>
    </section>
  );
}

export default function AnalyticsEventsReportPage() {
  // Mesmo ciclo escolhido nas Análises (?ciclo=): atual, anterior ou Total geral.
  const scope = useCycleScope();
  const { data, isLoading, isError, error, refetch } = useGetAnalyticsEventsReport(scope.params, {
    query: { queryKey: getGetAnalyticsEventsReportQueryKey(scope.params), staleTime: 60_000 },
  });
  const printed = useRef(false);
  useEffect(() => {
    if (!data || printed.current) return;
    if (!new URLSearchParams(window.location.search).has("imprimir")) return;
    const t = window.setTimeout(() => {
      printed.current = true;
      // Tira só o ?imprimir da URL (o ?ciclo= fica): recarregar não abre a impressão de novo.
      const qs = new URLSearchParams(window.location.search); qs.delete("imprimir");
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs.toString() ? `?${qs}` : ""}`);
      window.print();
    }, 500);
    return () => window.clearTimeout(t);
  }, [data]);

  if (isLoading) return <AnalyticsScopeFallback scope={scope} current="eventos" state="loading" loadingLabel="Montando o relatório por evento" errorTitle="" />;
  if (isError || !data) {
    return <AnalyticsScopeFallback scope={scope} current="eventos" state="error" loadingLabel="" errorTitle="Não foi possível montar o relatório"
      onRetry={() => void refetch()} errorDetail={(error as { message?: string } | null)?.message} />;
  }
  return <Report report={data} scope={scope} />;
}

function Report({ report, scope }: { report: EventsReport; scope: CycleScopeState }) {
  const { user } = useAuth();
  const events = useMemo(() => report.events
    .filter(e => e.resultsConfirmed && e.finalScore != null)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name, "pt-BR")), [report]);
  const pendingCount = report.events.filter(e => !e.resultsConfirmed).length;
  // Confirmado, mas sem nota de critério no sistema (resultado gravado direto no ciclo).
  const noScoreCount = report.events.filter(e => e.resultsConfirmed && e.finalScore == null).length;
  const scores = events.map(e => e.finalScore as number);
  const avgFinal = avg(scores);
  const byScore = [...events].sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0));
  const withPenalty = events.filter(e => e.conformityPenalty > 0);
  const calibrated = events.reduce((s, e) => s + e.calibratedCriteria, 0);
  const totalCrit = events.reduce((s, e) => s + e.totalCriteria, 0);

  // Critérios no ciclo: nome de origem + área, um ponto por evento, sem peso 0.
  // Escala 0 a 100 (nota do critério × 10), a mesma da nota final e de Análises.
  const criteriaSummary = useMemo(() => {
    const perEvent = new Map<string, { key: string; name: string; area: string | null; used: number[] }>();
    for (const e of events) for (const c of e.criteria) {
      if (c.used == null || !(c.weight > 0 || isAreaCopy(c, e.criteria))) continue;
      const key = `${baseName(c.name).toLowerCase()}|${(c.area ?? "").toLowerCase()}`;
      const k = `${e.id}|${key}`;
      if (!perEvent.has(k)) perEvent.set(k, { key, name: baseName(c.name), area: c.area ?? null, used: [] });
      perEvent.get(k)!.used.push(c.used * 10);
    }
    const agg = new Map<string, { name: string; area: string | null; pts: number[] }>();
    for (const p of perEvent.values()) {
      if (!agg.has(p.key)) agg.set(p.key, { name: p.name, area: p.area, pts: [] });
      agg.get(p.key)!.pts.push(avg(p.used)!);
    }
    return [...agg.values()].map(c => ({ ...c, avg: avg(c.pts)!, n: c.pts.length })).sort((a, b) => a.avg - b.avg);
  }, [events]);

  const generatedAt = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-full flex flex-col min-w-0" style={{ fontFamily: BODY }}>
      <AnalyticsTopBar
        scope={scope}
        current="eventos"
        actions={
          <button type="button" onClick={() => window.print()} data-testid="button-print-events-report"
            title='Abre a impressão; para PDF, escolha "Salvar como PDF"' className={cn(btnSmall, "px-2.5 lg:px-3")}>
            <Printer size={15} aria-hidden /><span className="hidden sm:inline">Imprimir / PDF</span><span className="sr-only sm:hidden">Imprimir ou salvar em PDF</span>
          </button>
        }
      />

      <div className={cn(analyticsBody, "print:p-0 print:max-w-none")}>
      <CycleScopeNotice scope={scope} className="no-print max-w-[960px] mx-auto" />
      <article className={cn(surfaceCls, "max-w-[960px] mx-auto px-5 md:px-9 py-7 md:py-9 space-y-6 print:border-0 print:p-0")} data-testid="events-report">
        <header className="space-y-2 pb-5 border-b-2 border-foreground">
          <p className="font-condensed text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--accent-text)]">Maratona de Resultados · Relatório por evento</p>
          <h2 className="font-condensed text-[30px] md:text-[38px] font-black uppercase leading-none tracking-[-0.01em] text-foreground">{report.cycle.name}</h2>
          <p className="text-[13.5px] leading-relaxed text-muted-foreground max-w-[75ch]">
            Nota final de cada evento já calibrada, com os critérios, a calibração e a equipe que trabalhou. {events.length === 1 ? "1 evento com resultado confirmado" : `${events.length} eventos com resultado confirmado`}
            {events.length ? `, de ${br(events[0].startDate)} a ${br(events[events.length - 1].startDate)}` : ""}
            {pendingCount ? `; ${pendingCount === 1 ? "1 evento ainda sem confirmação ficou" : `${pendingCount} eventos ainda sem confirmação ficaram`} de fora` : ""}
            {noScoreCount ? `; ${noScoreCount === 1 ? "1 evento confirmado não tem" : `${noScoreCount} eventos confirmados não têm`} nota por critério no sistema (resultado gravado direto no ciclo) e ${noScoreCount === 1 ? "não aparece" : "não aparecem"} aqui` : ""}. Gerado em {generatedAt}{user?.name ? ` por ${user.name}` : ""}.
          </p>
        </header>

        {events.length === 0 ? (
          <div data-testid="events-report-empty" className="px-6 py-10 text-center">
            <span className="mx-auto w-11 h-11 rounded-full bg-secondary text-muted-foreground flex items-center justify-center"><CalendarCheck2 size={20} aria-hidden /></span>
            <p className="font-condensed mt-3 text-[20px] font-black uppercase leading-tight text-foreground">
              {scope.isCurrent ? "Nenhum evento confirmado ainda" : "Nenhum evento confirmado neste ciclo"}
            </p>
            <p className="text-[14px] leading-relaxed text-muted-foreground mt-1 max-w-md mx-auto">
              O relatório mostra cada evento depois que o RH confirma os resultados — com a nota final, os critérios, a calibração e a equipe.
            </p>
            {scope.isCurrent && (
              <Link href="/events?status=unconfirmed" className={cn(btnSmall, "no-print mt-4")}>Ver eventos sem confirmação</Link>
            )}
          </div>
        ) : (
          <>
            <div className="print-avoid-break rounded-xl border border-border overflow-hidden grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
              {[
                { k: "Nota média dos eventos", v: f1(avgFinal), d: "Média das notas finais oficiais" },
                { k: "Eventos confirmados", v: String(events.length), d: `de ${report.events.length} no ciclo` },
                { k: "Critérios calibrados", v: `${calibrated}/${totalCrit}`, d: "Em eventos avaliados no app" },
                { k: "Com desconto da matriz", v: String(withPenalty.length), d: 'Eventos com algum "Não"' },
              ].map(t => (
                <div key={t.k} className="bg-card px-4 py-3.5">
                  <div className="font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{t.k}</div>
                  <div className="mt-2 font-condensed text-[30px] font-black leading-none tabular-nums text-foreground">{t.v}</div>
                  <div className="mt-1.5 text-[12.5px] leading-snug text-muted-foreground">{t.d}</div>
                </div>
              ))}
            </div>

            <H2>Destaques</H2>
            <ul className="list-disc pl-5 space-y-1 text-[13px]">
              {byScore.length > 1 && Math.abs((byScore[0].finalScore ?? 0) - (byScore[byScore.length - 1].finalScore ?? 0)) < 0.05 ? (
                <li>Todos os {byScore.length} eventos com a mesma nota final: <strong>{f1(byScore[0].finalScore)}</strong>.</li>
              ) : (
                <>
                  <li>Maior nota: <strong>{byScore[0].name}</strong> ({br(byScore[0].startDate)}), <strong>{f1(byScore[0].finalScore)}</strong>.</li>
                  {byScore.length > 1 && <li>Menor nota: <strong>{byScore[byScore.length - 1].name}</strong> ({br(byScore[byScore.length - 1].startDate)}), <strong>{f1(byScore[byScore.length - 1].finalScore)}</strong>.</li>}
                </>
              )}
              {criteriaSummary.length > 1 && criteriaSummary[criteriaSummary.length - 1].avg - criteriaSummary[0].avg >= 0.05 && <li>Critério mais fraco no ciclo: <strong>{displayCriterionName(criteriaSummary[0].name)}</strong>{criteriaSummary[0].area ? ` (${criteriaSummary[0].area})` : ""}, média <strong>{f1(criteriaSummary[0].avg)}</strong> em {plural(criteriaSummary[0].n, "evento")}.</li>}
              {withPenalty.length > 0 && <li>{withPenalty.length === 1 ? "1 evento perdeu" : `${withPenalty.length} eventos perderam`} pontos na matriz de conformidade; o maior desconto foi de {f1(Math.max(...withPenalty.map(e => e.conformityPenalty)))} pontos.</li>}
            </ul>

            <H2>Critérios no ciclo</H2>
            <p className="text-[12.5px]" style={{ color: "var(--muted-foreground)" }}>Média da nota usada (calibrada quando existe) nos eventos confirmados, escala 0 a 100 (como a nota final). Critério avaliado por várias áreas aparece aqui uma vez por área (no Painel de gestão, numa linha só, com a média das áreas); na nota do evento as áreas entram pela média. Critério com peso 0 não entra — exceto a cópia por área de um critério multiárea, que entra pela média das áreas.</p>
            <table className="w-full text-[12.5px] border-collapse">
              <thead><tr>
                <th className={`${TH} text-left`} style={thStyle}>Critério</th>
                <th className={`${TH} text-left`} style={thStyle}>Área</th>
                <th className={`${TH} text-right`} style={thStyle}>Eventos</th>
                <th className={`${TH} text-right`} style={thStyle}>Média</th>
              </tr></thead>
              <tbody>
                {criteriaSummary.map(c => (
                  <tr key={`${c.name}|${c.area}`}>
                    <td className="py-1.5 px-2" style={tdStyle}>{displayCriterionName(c.name)}</td>
                    <td className="py-1.5 px-2" style={tdStyle}>{c.area ?? "—"}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums" style={tdStyle}>{c.n}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums" style={tdStyle}>
                      <span className="inline-block align-middle h-2 w-20 rounded-sm overflow-hidden mr-2" style={{ backgroundColor: "var(--secondary)" }} aria-hidden>
                        <span className="block h-full" style={{ width: `${Math.max(0, Math.min(100, c.avg))}%`, backgroundColor: "var(--viz-series-1)" }} />
                      </span>
                      <strong>{f1(c.avg)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <H2 breakBefore>Índice dos eventos</H2>
            <p className="text-[12.5px]" style={{ color: "var(--muted-foreground)" }}>Nota final em <strong style={{ color: "var(--status-ok-text)" }}>verde</strong> a partir de 80 e em <strong style={{ color: "var(--status-danger-text)" }}>vermelho</strong> abaixo de 70. Performance é a nota antes do desconto da matriz. "Equipe" conta só quem entra na nota.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-[12px] border-collapse">
                <thead><tr>
                  <th className={`${TH} text-right`} style={thStyle}>Data</th>
                  <th className={`${TH} text-left`} style={thStyle}>Evento</th>
                  <th className={`${TH} text-right`} style={thStyle}>Nota final</th>
                  <th className={`${TH} text-right`} style={thStyle}>Performance</th>
                  <th className={`${TH} text-right`} style={thStyle}>Matriz</th>
                  <th className={`${TH} text-right`} style={thStyle}>Calibrados</th>
                  <th className={`${TH} text-right`} style={thStyle}>Equipe</th>
                </tr></thead>
                <tbody>
                  {events.map(e => (
                    <tr key={e.id} className="print-avoid-break">
                      <td className="py-1 px-2 text-right tabular-nums whitespace-nowrap" style={tdStyle}>{br(e.startDate)}</td>
                      <td className="py-1 px-2" style={tdStyle}><a href={`#ev-${e.id}`} className="hover:underline underline-offset-2">{e.name}</a>{e.isHistorical && <span className="ml-1.5 text-[10.5px] uppercase rounded px-1" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>importado</span>}</td>
                      <td className="py-1 px-2 text-right tabular-nums font-bold" style={{ ...tdStyle, color: scoreColor(e.finalScore) }}>{f1(e.finalScore)}</td>
                      <td className="py-1 px-2 text-right tabular-nums" style={tdStyle}>{e.isHistorical ? "—" : f1(e.performanceScore)}</td>
                      <td className="py-1 px-2 text-right tabular-nums" style={tdStyle}>{e.isHistorical || !e.conformityPenalty ? "—" : `−${f1(e.conformityPenalty)}`}</td>
                      <td className="py-1 px-2 text-right tabular-nums" style={tdStyle}>{e.isHistorical ? "—" : `${e.calibratedCriteria}/${e.totalCriteria}`}</td>
                      <td className="py-1 px-2 text-right tabular-nums" style={tdStyle}>{e.team.filter(t => t.countsForScore).length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <H2 breakBefore>Fichas dos eventos</H2>
            <div className="space-y-3">{events.map(e => <EventCard key={e.id} e={e} />)}</div>

            <H2 breakBefore>Como a nota do evento é calculada</H2>
            <ol className="list-decimal pl-5 space-y-1.5 text-[13px]">
              <li>Cada critério recebe nota de 0 a 10 (neste relatório, mostrada de 0 a 100). Vale a nota calibrada quando existe; senão, a média dos avaliadores do critério.</li>
              <li>A performance é a média ponderada pelos pesos dos critérios, convertida para 0 a 100. Critério avaliado por duas áreas (ex.: Qualidade da Entrega, Atendimento e Ativação) entra pela média das áreas. Peso 0 não conta (a cópia por área de um critério multiárea entra pela média).</li>
              <li>A matriz de conformidade tem quatro itens (três nos ciclos que tiraram a Conduta, que então conta como "Sim"); cada "Não" tira 10 pontos da nota do evento, que fica entre 0 e 100.</li>
              <li>Só eventos com resultados confirmados entram na nota do ciclo e no bônus. A equipe que conta é a da casa; freela e função "Sup Ceno" são informativos.</li>
              <li>Eventos "importados" vieram com a nota pronta, sem avaliação por critério no app.</li>
            </ol>
          </>
        )}
        <footer className="pt-3 text-[11.5px]" style={{ borderTop: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
          Maratona de Resultados · {report.cycle.name} · uso interno de RH e diretoria.
        </footer>
      </article>
      </div>
    </div>
  );
}
