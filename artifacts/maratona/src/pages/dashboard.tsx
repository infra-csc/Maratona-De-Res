import { useGetDashboardSummary, useGetDashboardTopEmployees, useGetDashboardQuarterlyEvolution, useGetDashboardPlatoonDistribution, useGetCurrentCycle, useGetEvents, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { CheckCircle2, Trophy, DollarSign, History, AlertTriangle, ChevronRight, Shapes, Calendar, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { CycleSelect, CycleScopeNotice, useCycleScope } from "@/components/cycle-select";
import { PremiumCard, CONDENSED, WARNING, DANGER_TEXT } from "@/lib/premium-theme";
import { getCycleWeekends, weekendsEnd, fmtNum, faixaEdge } from "@/lib/utils";
import { countCycleEvents } from "./events/rules";
import { BonusPair } from "@/components/shared";

export default function DashboardPage() {
  // Seletor de ciclo: atual (padrão), anterior ou Total geral. Os números
  // seguem a escolha; as pendências operacionais são sempre de um ciclo (o
  // escolhido ou, no Total geral, o atual).
  const scope = useCycleScope();
  const p = scope.params;
  const summaryQ = useGetDashboardSummary(p, {
    query: { queryKey: getGetDashboardSummaryQueryKey(p) },
  });
  const summary = summaryQ.data;
  const topQ = useGetDashboardTopEmployees(p);
  const topEmployees = topQ.data;
  const { data: evolution } = useGetDashboardQuarterlyEvolution();
  const platoonsQ = useGetDashboardPlatoonDistribution(p);
  const platoons = platoonsQ.data;
  // Carregando / erro: o painel não afirma "nada" antes de os dados chegarem.
  const summaryLoading = summaryQ.isLoading;
  const summaryError = summaryQ.isError && !summary;
  // Ciclo atual e seus eventos: só para "Próximos fins de semana" (operacional).
  const { data: cycle } = useGetCurrentCycle();
  const { data: events } = useGetEvents();
  const pastCycle = scope.selection.kind === "cycle";
  const isAll = scope.isAll;

  const fmt = (v: number) => `${fmtNum(v, 1)}/100`;
  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  // Bônus: oficial (ciclos fechados) × projetado (ciclo aberto, muda até o
  // fechamento) — nunca somados num número só sem dizer o que é cada parte.
  const bonusOfficial = summary?.bonusOfficial ?? null;
  const bonusProjected = summary?.bonusProjected ?? null;
  const hasSplit = bonusOfficial != null && bonusProjected != null;
  const showBoth = hasSplit && bonusOfficial > 0 && bonusProjected > 0;
  // Com as duas partes, NENHUM número principal: oficial e projetado lado a
  // lado (a soma dos dois não é um valor que exista para ninguém).
  const bonusMain = !summary || showBoth ? null
    : !hasSplit ? summary.totalBonusPreview
    : bonusOfficial > 0 ? bonusOfficial : bonusProjected;
  const bonusTitle = showBoth ? "Bônus · Oficial e Projetado"
    : isAll ? "Bônus · Todos os Ciclos"
    : hasSplit && bonusOfficial > 0 && bonusProjected === 0 ? "Bônus do Ciclo (oficial)"
    : pastCycle ? "Bônus do Ciclo" : "Bônus Projetado";
  const bonusDetail = showBoth ? null
    : hasSplit && bonusOfficial > 0 ? "Oficial — ciclo fechado"
    : hasSplit ? (isAll ? "Projetado — só o ciclo aberto tem bônus" : "Projetado — muda até o fechamento do ciclo")
    : isAll ? "Soma dos ciclos (o atual é estimativa)" : pastCycle ? "Valor apurado no ciclo" : "Estimativa do ciclo";

  // "X de Y no ciclo": Y = eventos do período (= Ciclos e lista de Eventos);
  // os fora do período (do próximo ciclo) aparecem à parte, como lá.
  const afterEnd = !pastCycle && !isAll && events ? countCycleEvents(events, () => cycle).afterEnd : 0;

  const submitted = summary?.submittedEvaluations ?? 0;
  const pending = summary?.pendingEvaluations ?? 0;

  // Próximos fins de semana com eventos
  // Fuso local: toISOString() é UTC e escondia o fim de semana atual entre 21h e meia-noite.
  const today = new Date().toLocaleDateString("sv-SE");
  // Até o último evento do ciclo: evento "fora do período" (depois do fim)
  // também aparece nos próximos fins de semana (como na lista de Eventos).
  const cycleWeekends = getCycleWeekends(cycle?.startDate, weekendsEnd(cycle?.endDate, events));
  const upcomingWeekends = cycleWeekends
    .filter(w => w.sun >= today)
    .slice(0, 8)
    .map(w => ({
      ...w,
      events: (events ?? []).filter(
        ev => ev.status !== "closed" && ev.startDate <= w.sun && (ev.endDate ?? ev.startDate) >= w.sat
      ),
    }))
    .filter(w => w.events.length > 0)
    .slice(0, 5);
  // submitted + pending = total de eventos com alguma avaliação; o percentual
  // reflete eventos com todas as avaliações concluídas vs total com avaliações.
  const progress = submitted + pending > 0 ? Math.round((submitted / (submitted + pending)) * 100) : 0;
  const opCycleName = summary?.operationalCycleName ?? cycle?.name ?? "ciclo atual";

  return (
    <div className="p-6 md:p-10 space-y-8">
      {/* Header */}
      <header className="flex flex-wrap gap-4 justify-between items-center">
        <h1 data-testid="text-page-title" className="text-2xl md:text-3xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>
          Painel de Controle
        </h1>
        <CycleSelect scope={scope} />
      </header>

      <CycleScopeNotice
        scope={scope}
        allHelp={<>Eventos, média, bônus e distribuição somam <strong>todos os ciclos</strong> (cada pessoa conta uma vez por ciclo; o Top mostra a média final de cada um, ponderada pelos eventos com nota). Progresso de avaliações e zona de risco continuam sendo do <strong>ciclo atual</strong>.</>}
      />

      {summaryError && (
        <div role="alert" data-testid="dashboard-error" className="rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-3" style={{ backgroundColor: "var(--status-danger-bg)", color: "var(--status-danger-text)", border: "1px solid var(--border)" }}>
          <span className="text-sm font-semibold flex items-center gap-2"><AlertTriangle size={16} aria-hidden /> Não foi possível carregar os números do painel.</span>
          <button type="button" onClick={() => { void summaryQ.refetch(); void topQ.refetch(); void platoonsQ.refetch(); }}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12px] font-bold uppercase" style={{ fontFamily: CONDENSED, border: "1px solid currentColor" }} data-testid="button-dashboard-retry">
            <RefreshCw size={14} aria-hidden /> Tentar de novo
          </button>
        </div>
      )}

      {/* 1. KPIs */}
      {summaryError ? null : summaryLoading ? (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5" role="status" aria-live="polite" data-testid="dashboard-loading">
          <span className="sr-only">Carregando o painel…</span>
          {[0, 1, 2, 3].map(i => <div key={i} className="h-40 rounded-xl animate-pulse" style={{ backgroundColor: "var(--secondary)" }} />)}
        </section>
      ) : (
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Média Geral */}
        <PremiumCard className="p-6 h-40 flex flex-col justify-between relative overflow-hidden group">
          <div className="z-10">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>{isAll ? "Média Geral" : "Média do Ciclo"}</p>
            <h2 data-testid="text-quarter-avg" className="text-[40px] leading-none font-black mt-2" style={{ fontFamily: CONDENSED }}>
              {summary?.quarterAverage != null ? fmtNum(summary.quarterAverage, 1) : "—"}
            </h2>
            <p className="text-[11px] font-medium mt-1" style={{ color: "var(--muted-foreground)" }}>{isAll ? "Média de cada pessoa ponderada pelos eventos com nota" : "Pontos no ciclo"}</p>
          </div>
          <div className="absolute -right-3 -bottom-3 opacity-[0.06] group-hover:scale-110 transition-transform duration-500">
            <Trophy size={110} strokeWidth={1.5} />
          </div>
        </PremiumCard>

        {/* Eventos */}
        <PremiumCard className="p-6 h-40 flex flex-col justify-between relative overflow-hidden group">
          <div className="z-10">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Eventos Confirmados</p>
            <h2 data-testid="text-total-events" className="text-[40px] leading-none font-black mt-2" style={{ fontFamily: CONDENSED }}>{summary?.totalEvents ?? "—"}</h2>
            <p className="text-[11px] font-semibold mt-1 flex items-center gap-1" style={{ color: "var(--accent-text)" }}>
              <CheckCircle2 size={12} aria-hidden /> de {summary?.eventsInCycle ?? 0} {isAll ? "em todos os ciclos" : "no ciclo"}
              {afterEnd > 0 && <span className="font-medium" style={{ color: "var(--muted-foreground)" }} data-testid="text-events-after-end">· +{afterEnd} fora do período</span>}
            </p>
          </div>
          <div className="absolute -right-3 -bottom-3 opacity-[0.06] group-hover:scale-110 transition-transform duration-500">
            <CheckCircle2 size={110} strokeWidth={1.5} />
          </div>
        </PremiumCard>

        {/* Progresso de Avaliações (hero) */}
        <div
          className="rounded-xl p-6 h-40 flex flex-col justify-between relative overflow-hidden"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wider opacity-70" style={{ fontFamily: CONDENSED }}>Progresso de Avaliações{isAll ? " · ciclo atual" : ""}</p>
            <h2 data-testid="text-eval-progress" className="text-[40px] leading-none font-black mt-2" style={{ fontFamily: CONDENSED }}>{progress}%</h2>
            <p className="text-[11px] font-medium opacity-70 mt-1">{pending} {pending === 1 ? "evento pendente" : "eventos pendentes"}</p>
          </div>
          <div className="w-full mt-auto rounded-full h-2.5 overflow-hidden" style={{ backgroundColor: "rgba(0,0,0,0.15)" }}>
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${progress}%`, backgroundColor: "var(--primary-foreground)" }} />
          </div>
        </div>

        {/* Bônus: oficial × projetado */}
        <PremiumCard className="p-6 min-h-40 flex flex-col justify-between relative overflow-hidden group">
          <div className="z-10">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>{bonusTitle}</p>
            {showBoth ? (
              <div className="mt-2" data-testid="text-projected-bonus">
                <BonusPair official={bonusOfficial!} projected={bonusProjected!} format={fmtBRL} data-testid="dashboard-bonus" />
              </div>
            ) : (
            <h2 data-testid="text-projected-bonus" className="text-[30px] leading-none font-black mt-2" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>
              {bonusMain != null ? fmtBRL(bonusMain) : "—"}
            </h2>
            )}
            {showBoth ? null : (
              <p className="text-[11px] font-medium mt-1" style={{ color: "var(--muted-foreground)" }}>{bonusDetail}</p>
            )}
          </div>
          <div className="absolute -right-3 -bottom-3 opacity-[0.06] group-hover:scale-110 transition-transform duration-500">
            <DollarSign size={110} strokeWidth={1.5} />
          </div>
        </PremiumCard>
      </section>
      )}

      {/* 2. Evolução de Performance */}
      {evolution && evolution.length > 0 && (
        <PremiumCard className="p-6 md:p-8">
          <div className="flex flex-wrap justify-between items-end gap-3 mb-6">
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Evolução de Performance</h3>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Média de pontos por ciclo</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={evolution} margin={{ top: 20, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" axisLine={{ stroke: "var(--border)" }} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: "var(--muted-foreground)" }} dy={8} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={v => `${fmtNum((v as number), 0)}`} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} domain={[0, 100]} />
              <Tooltip
                cursor={{ fill: "rgba(154,176,0,0.1)" }}
                contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--foreground)", fontWeight: 600, fontSize: 12 }}
                formatter={v => [`${fmtNum((v as number), 1)} pts`, "Média"]}
              />
              {/* Uma série só: a cor segue o dado, não a posição (antes alternava). */}
              <Bar dataKey="average" fill="var(--viz-series-1)" radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false}>
                <LabelList dataKey="average" position="top" formatter={(v: unknown) => fmtNum(Number(v), 1)} style={{ fontSize: 12, fontWeight: 700, fill: "var(--foreground)" }} />
              </Bar>
              {evolution.length > 1 && (
                <Line type="monotone" dataKey="average" stroke="var(--foreground)" strokeWidth={2} strokeDasharray="6 6" dot={false} isAnimationActive={false} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </PremiumCard>
      )}

      {/* 3. Top Performance + Distribuição por Faixa */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5 items-start">
        <PremiumCard className="overflow-hidden flex flex-col">
          <div className="p-6 flex justify-between items-center" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Top Performance</h3>
              {isAll && <p className="text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>Média final de cada um nos ciclos, ponderada pelos eventos com nota</p>}
            </div>
            <History size={20} style={{ color: "var(--muted-foreground)" }} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="p-4 text-xs font-bold uppercase" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>Pos</th>
                  <th className="p-4 text-xs font-bold uppercase" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>Colaborador</th>
                  <th className="p-4 text-xs font-bold uppercase text-right" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>Nota</th>
                </tr>
              </thead>
              <tbody>
                {topQ.isLoading && [0, 1, 2].map(i => (
                  <tr key={`sk-${i}`} aria-hidden><td colSpan={3} className="p-4"><div className="h-6 rounded animate-pulse" style={{ backgroundColor: "var(--secondary)" }} /></td></tr>
                ))}
                {topQ.isError && !topEmployees && (
                  <tr><td colSpan={3} className="p-6 text-sm font-semibold text-center" style={{ color: "var(--status-danger-text)" }}>
                    Não foi possível carregar o Top.{" "}
                    <button type="button" onClick={() => { void topQ.refetch(); }} className="underline underline-offset-2 font-bold">Tentar de novo</button>
                  </td></tr>
                )}
                {topQ.isSuccess && (!topEmployees || topEmployees.length === 0) && (
                  <tr><td colSpan={3} className="p-6 text-sm font-semibold text-center" style={{ color: "var(--muted-foreground)" }}>Nenhum resultado consolidado.</td></tr>
                )}
                {topEmployees?.slice(0, 6).map((emp, i) => (
                  <tr key={emp.employeeId} className="transition-colors hover:opacity-80" style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="p-4 text-lg font-black w-12" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>{String(i + 1).padStart(2, "0")}</td>
                    <td className="p-4 text-base font-bold">{emp.employeeName}</td>
                    <td className="p-4 text-right text-lg font-black" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>{fmt(emp.finalResult)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PremiumCard>

        <PremiumCard className="p-6">
          <h3 className="text-sm font-black uppercase flex items-center gap-2 mb-1" style={{ fontFamily: CONDENSED }}>
            <Shapes size={16} style={{ color: "var(--accent-text)" }} /> Distribuição por Faixa
          </h3>
          <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>{isAll ? "Resultados de todos os ciclos por faixa de bônus (cada pessoa conta uma vez por ciclo)" : "Colaboradores com resultado apurado neste ciclo, por faixa de bônus"}</p>
          {platoonsQ.isLoading ? (
            <div className="space-y-2.5" aria-hidden>{[0, 1, 2].map(i => <div key={i} className="h-5 rounded animate-pulse" style={{ backgroundColor: "var(--secondary)" }} />)}</div>
          ) : platoonsQ.isError && !platoons ? (
            <p className="text-sm font-semibold text-center py-6" style={{ color: "var(--status-danger-text)" }}>
              Não foi possível carregar as faixas.{" "}
              <button type="button" onClick={() => { void platoonsQ.refetch(); }} className="underline underline-offset-2 font-bold">Tentar de novo</button>
            </p>
          ) : !platoons || platoons.length === 0 ? (
            <p className="text-sm font-semibold text-center py-6" style={{ color: "var(--muted-foreground)" }}>Nenhum resultado apurado ainda.</p>
          ) : (
            <>
              <div className="w-full h-3 rounded-full overflow-hidden flex mb-4" style={{ backgroundColor: "var(--secondary)" }}>
                {platoons.map(p => (
                  <div key={p.platoonName} style={{ width: `${p.percentage}%`, backgroundColor: p.color, ...faixaEdge(p.color) }} title={p.platoonName} />
                ))}
              </div>
              <div className="space-y-2.5">
                {platoons.map(p => {
                  const label = p.platoonName === "Sem Faixa" ? "Sem Faixa" : p.platoonName.replace(/^Pelot[aã]o\s*/i, "");
                  return (
                    <div key={p.platoonName} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color, ...faixaEdge(p.color) }} />
                        <span className="text-sm font-semibold truncate">{label}</span>
                      </div>
                      <span className="text-sm font-bold shrink-0" style={{ color: "var(--muted-foreground)" }}>
                        {p.count} <span className="opacity-60">({fmtNum(p.percentage, 0)}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </PremiumCard>
      </div>

      {/* 4. Zona de Risco + Próximos Fins de Semana */}
      {(() => {
        const hasRisk = !!summary?.atRiskEmployees && summary.atRiskEmployees.length > 0;
        // Ciclo anterior não tem "próximos" fins de semana; no Total geral ficam os do ciclo atual.
        const hasUpcoming = !pastCycle && upcomingWeekends.length > 0;
        if (!hasRisk && !hasUpcoming) return null;
        return (
          <div className={hasRisk && hasUpcoming ? "grid grid-cols-1 lg:grid-cols-2 gap-5" : "grid grid-cols-1 max-w-xl"}>
            {hasRisk && (
              <PremiumCard className="p-6" style={{ borderColor: WARNING }}>
                <h3 className="text-sm font-black uppercase flex items-center gap-2 mb-4" style={{ fontFamily: CONDENSED, color: DANGER_TEXT }}>
                  <AlertTriangle size={16} /> Zona de Risco{isAll ? ` · ${opCycleName}` : ""}
                </h3>
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {summary!.atRiskEmployees!.map(emp => (
                    <div key={emp.employeeId} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: "rgba(229,72,77,0.08)" }}>
                      <span className="text-sm font-semibold break-words flex-1 pr-2">{emp.employeeName}</span>
                      <span className="text-sm font-black text-white px-2 py-0.5 rounded" style={{ backgroundColor: WARNING }}>{fmt(emp.currentScore ?? 0)}</span>
                    </div>
                  ))}
                </div>
              </PremiumCard>
            )}

            {hasUpcoming && (
              <PremiumCard className="overflow-hidden">
                <div className="p-5 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
                  <Calendar size={15} style={{ color: "var(--accent-text)" }} />
                  <h3 className="text-sm font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Próximos Fins de Semana</h3>
                </div>
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {upcomingWeekends.map(w => (
                    <div key={w.sat} className="px-5 py-3">
                      <p className="text-[11px] font-black uppercase tracking-wider mb-2" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>
                        {w.label}
                      </p>
                      <div className="space-y-1">
                        {w.events.map(ev => (
                          <Link key={ev.id} href={`/events/${ev.id}`} className="flex items-center justify-between gap-2 py-1 hover:opacity-70 transition-opacity">
                            <span className="text-sm font-semibold truncate flex-1">{ev.name}</span>
                            {ev.city && (
                              <span className="text-[11px] font-medium shrink-0" style={{ color: "var(--muted-foreground)" }}>{ev.city}</span>
                            )}
                            <ChevronRight size={13} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </PremiumCard>
            )}
          </div>
        );
      })()}
    </div>
  );
}
