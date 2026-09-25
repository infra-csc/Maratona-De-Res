import { useEffect, useMemo, useRef } from "react";
import { Link } from "wouter";
import { useGetAnalyticsEventsReport, getGetAnalyticsEventsReportQueryKey, type EventsReport, type EventReportRow } from "@workspace/api-client-react";
import { AlertTriangle, ArrowLeft, Printer } from "lucide-react";
import { EmptyState, LoadingState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { CONDENSED, BODY } from "@/lib/premium-theme";
import { fmtNum } from "@/lib/utils";

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

function Chip({ children, tone }: { children: React.ReactNode; tone?: "ok" | "warn" }) {
  const style = tone === "ok"
    ? { backgroundColor: "var(--status-ok-bg)", color: "var(--status-ok-text)", fontWeight: 600 }
    : tone === "warn"
      ? { backgroundColor: "var(--status-warn-bg)", color: "var(--status-warn-text)", fontWeight: 600 }
      : { backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" };
  return <span className="text-[11.5px] rounded-full px-2 py-0.5" style={style}>{children}</span>;
}

function EventCard({ e }: { e: EventReportRow }) {
  const counts = e.team.filter(t => t.countsForScore);
  const info = e.team.filter(t => !t.countsForScore);
  const place = [e.clientName, [e.city, e.state].filter(Boolean).join("/")].filter(Boolean).join(" · ");
  return (
    <section id={`ev-${e.id}`} className="print-avoid-break rounded-lg p-3.5 space-y-2" style={{ border: "1px solid var(--border)" }}>
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>
            {br(e.startDate)}{e.endDate && e.endDate !== e.startDate ? ` a ${br(e.endDate)}` : ""}{place ? ` · ${place}` : ""}
          </p>
          <h3 className="text-[16px] font-black leading-tight" style={{ fontFamily: CONDENSED }}>{e.name}</h3>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <Chip tone="ok">Resultados confirmados</Chip>
            {e.isHistorical ? <Chip>Importado com nota pronta</Chip> : (
              <>
                <Chip>Performance {f1(e.performanceScore)}</Chip>
                <Chip>Matriz {e.conformityPenalty ? `−${f1(e.conformityPenalty)} pts` : "sem desconto"}</Chip>
                <Chip>{e.calibratedCriteria}/{e.totalCriteria} critérios calibrados</Chip>
              </>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="block text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Nota final</span>
          <span className="block text-[32px] font-black leading-none tabular-nums" style={{ fontFamily: CONDENSED, color: scoreColor(e.finalScore) }}>{f1(e.finalScore)}</span>
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
                const counted = c.weight > 0;
                return (
                  <tr key={i} style={{ color: counted && c.active ? undefined : "var(--muted-foreground)" }}>
                    <td className="py-1 px-2" style={tdStyle}>
                      {c.name}
                      {!counted && <span className="ml-1.5 text-[10.5px] uppercase rounded px-1" style={{ border: "1px solid var(--border)" }}>peso 0 · não conta</span>}
                      {counted && !c.active && <span className="ml-1.5 text-[10.5px] uppercase rounded px-1" style={{ border: "1px solid var(--border)" }}>inativo, calibrado</span>}
                    </td>
                    <td className="py-1 px-2" style={tdStyle}>{c.area ?? "—"}</td>
                    <td className="py-1 px-2 text-right tabular-nums" style={tdStyle}>{c.weight}</td>
                    <td className="py-1 px-2 text-right tabular-nums" style={tdStyle}>{f1(c.evaluatorAvg)}</td>
                    <td className="py-1 px-2 text-right tabular-nums font-bold" style={tdStyle}>{f1(c.calibrated)}</td>
                    <td className="py-1 px-2 text-right tabular-nums" style={tdStyle}>{f1(c.used)}</td>
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
  const { data, isLoading, isError, error } = useGetAnalyticsEventsReport(undefined, {
    query: { queryKey: getGetAnalyticsEventsReportQueryKey(), staleTime: 60_000 },
  });
  const printed = useRef(false);
  useEffect(() => {
    if (!data || printed.current) return;
    if (!new URLSearchParams(window.location.search).has("imprimir")) return;
    const t = window.setTimeout(() => {
      printed.current = true;
      window.history.replaceState(window.history.state, "", window.location.pathname);
      window.print();
    }, 500);
    return () => window.clearTimeout(t);
  }, [data]);

  if (isLoading) return <div className="px-6 py-6"><LoadingState lines={10} withHeader label="Montando o relatório por evento" /></div>;
  if (isError || !data) {
    return (
      <div className="px-6 py-10">
        <EmptyState icon={AlertTriangle} title="Não foi possível montar o relatório" description={(error as { message?: string } | null)?.message ?? "Tente novamente em instantes."}
          action={<Button variant="outline" asChild><Link href="/analytics">Voltar para Análises</Link></Button>} />
      </div>
    );
  }
  return <Report report={data} />;
}

function Report({ report }: { report: EventsReport }) {
  const { user } = useAuth();
  const events = useMemo(() => report.events
    .filter(e => e.resultsConfirmed && e.finalScore != null)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name, "pt-BR")), [report]);
  const pendingCount = report.events.length - events.length;
  const scores = events.map(e => e.finalScore as number);
  const avgFinal = avg(scores);
  const byScore = [...events].sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0));
  const withPenalty = events.filter(e => e.conformityPenalty > 0);
  const calibrated = events.reduce((s, e) => s + e.calibratedCriteria, 0);
  const totalCrit = events.reduce((s, e) => s + e.totalCriteria, 0);

  // Critérios no ciclo: nome de origem + área, um ponto por evento, sem peso 0.
  const criteriaSummary = useMemo(() => {
    const perEvent = new Map<string, { key: string; name: string; area: string | null; used: number[] }>();
    for (const e of events) for (const c of e.criteria) {
      if (c.used == null || !(c.weight > 0)) continue;
      const key = `${baseName(c.name).toLowerCase()}|${(c.area ?? "").toLowerCase()}`;
      const k = `${e.id}|${key}`;
      if (!perEvent.has(k)) perEvent.set(k, { key, name: baseName(c.name), area: c.area ?? null, used: [] });
      perEvent.get(k)!.used.push(c.used);
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
    <div className="px-4 md:px-6 py-6" style={{ fontFamily: BODY }}>
      <div className="no-print max-w-[900px] mx-auto mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/analytics" className="inline-flex items-center gap-1.5 text-[13px] font-semibold hover:underline underline-offset-2" style={{ color: "var(--muted-foreground)" }}>
          <ArrowLeft size={14} aria-hidden /> Voltar para Análises
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>Na janela de impressão, escolha "Salvar como PDF".</span>
          <Button onClick={() => window.print()} data-testid="button-print-events-report"><Printer size={15} aria-hidden /> Imprimir / salvar PDF</Button>
        </div>
      </div>

      <article className="max-w-[900px] mx-auto rounded-xl px-5 md:px-8 py-7 space-y-5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }} data-testid="events-report">
        <header className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.12em", color: "var(--accent-text)" }}>Maratona de Resultados · Relatório por evento</p>
          <h1 className="text-[34px] font-black uppercase leading-none" style={{ fontFamily: CONDENSED }}>{report.cycle.name}</h1>
          <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            Nota final de cada evento já calibrada pelo RH, com os critérios, a calibração e a equipe que trabalhou. {events.length} eventos com resultado confirmado
            {events.length ? `, de ${br(events[0].startDate)} a ${br(events[events.length - 1].startDate)}` : ""}
            {pendingCount ? `; ${pendingCount} evento(s) ainda sem confirmação ficaram de fora` : ""}. Gerado em {generatedAt}{user?.name ? ` por ${user.name}` : ""}.
          </p>
        </header>

        {events.length === 0 ? (
          <EmptyState compact title="Nenhum evento confirmado neste ciclo" description="O relatório mostra os eventos depois que o RH confirma os resultados." />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {[
                { k: "Nota média dos eventos", v: f1(avgFinal), d: "média das notas finais oficiais", hero: true },
                { k: "Eventos confirmados", v: String(events.length), d: `de ${report.events.length} no ciclo` },
                { k: "Critérios calibrados", v: `${calibrated}/${totalCrit}`, d: "em eventos avaliados no app" },
                { k: "Com desconto da matriz", v: String(withPenalty.length), d: 'eventos com algum "Não"' },
              ].map(t => (
                <div key={t.k} className="print-avoid-break rounded-lg px-3 py-2.5"
                  style={{ border: `1px solid ${t.hero ? "var(--primary)" : "var(--border)"}`, backgroundColor: t.hero ? "var(--primary)" : undefined, color: t.hero ? "var(--primary-foreground)" : undefined }}>
                  <div className="text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.06em", opacity: t.hero ? 0.85 : 1, color: t.hero ? undefined : "var(--muted-foreground)" }}>{t.k}</div>
                  <div className="text-[26px] font-black leading-none mt-1 tabular-nums" style={{ fontFamily: CONDENSED }}>{t.v}</div>
                  <div className="text-[11.5px] mt-1" style={{ opacity: t.hero ? 0.85 : 1, color: t.hero ? undefined : "var(--muted-foreground)" }}>{t.d}</div>
                </div>
              ))}
            </div>

            <H2>Destaques</H2>
            <ul className="list-disc pl-5 space-y-1 text-[13px]">
              <li>Maior nota: <strong>{byScore[0].name}</strong> ({br(byScore[0].startDate)}), <strong>{f1(byScore[0].finalScore)}</strong>.</li>
              {byScore.length > 1 && <li>Menor nota: <strong>{byScore[byScore.length - 1].name}</strong> ({br(byScore[byScore.length - 1].startDate)}), <strong>{f1(byScore[byScore.length - 1].finalScore)}</strong>.</li>}
              {criteriaSummary[0] && <li>Critério mais fraco no ciclo: <strong>{criteriaSummary[0].name}</strong>{criteriaSummary[0].area ? ` (${criteriaSummary[0].area})` : ""}, média <strong>{f1(criteriaSummary[0].avg)}</strong> em {criteriaSummary[0].n} eventos.</li>}
              {withPenalty.length > 0 && <li>{withPenalty.length} evento(s) perderam pontos na matriz de conformidade; o maior desconto foi de {f1(Math.max(...withPenalty.map(e => e.conformityPenalty)))} pontos.</li>}
            </ul>

            <H2>Critérios no ciclo</H2>
            <p className="text-[12.5px]" style={{ color: "var(--muted-foreground)" }}>Média da nota usada (calibrada quando existe) nos eventos confirmados, escala 0 a 10. Critério avaliado por duas áreas aparece uma vez por área; na nota do evento as duas entram pela média. Critério com peso 0 não entra.</p>
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
                    <td className="py-1.5 px-2" style={tdStyle}>{c.name}</td>
                    <td className="py-1.5 px-2" style={tdStyle}>{c.area ?? "—"}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums" style={tdStyle}>{c.n}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums" style={tdStyle}>
                      <span className="inline-block align-middle h-2 w-20 rounded-sm overflow-hidden mr-2" style={{ backgroundColor: "var(--secondary)" }} aria-hidden>
                        <span className="block h-full" style={{ width: `${(c.avg / 10) * 100}%`, backgroundColor: "var(--viz-series-1)" }} />
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
              <li>Cada critério recebe nota de 0 a 10. Vale a nota calibrada pelo RH quando existe; senão, a média dos avaliadores do critério.</li>
              <li>A performance é a média ponderada pelos pesos dos critérios, convertida para 0 a 100. Critério avaliado por duas áreas (ex.: Qualidade da Entrega, Atendimento e Ativação) entra pela média das duas. Peso 0 não conta.</li>
              <li>A matriz de conformidade tem quatro itens; cada "Não" tira 10 pontos da nota do evento, que fica entre 0 e 100.</li>
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
  );
}
