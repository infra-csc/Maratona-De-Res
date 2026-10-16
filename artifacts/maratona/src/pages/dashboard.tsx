import {
  useGetDashboardSummary, useGetDashboardTopEmployees, useGetDashboardQuarterlyEvolution, useGetDashboardPlatoonDistribution,
  useGetCurrentCycle, useGetEvents, useGetPlatoonRules, getGetDashboardSummaryQueryKey, getGetPlatoonRulesQueryKey,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { ArrowRight, Hourglass } from "lucide-react";
import { CycleSelect, CycleScopeNotice, useCycleScope } from "@/components/cycle-select";
import { cn } from "@/lib/utils";
import { countCycleEvents } from "./events/rules";
import { DashboardHeader } from "./dashboard/dashboard-header";
import { Indicators, IndicatorsSkeleton } from "./dashboard/indicators";
import { AttentionPanel } from "./dashboard/attention";
import { AgendaPanel } from "./dashboard/agenda";
import { FaixasPanel, TopPanel } from "./dashboard/performance";
import { EvolutionPanel } from "./dashboard/evolution";
import { PanelError, btnSecondary, surfaceCls } from "./dashboard/dashboard-ui";

// Partes da página ficam em ./dashboard/: topo, faixa de indicadores
// (atalhos), "Precisa da sua atenção", agenda dos próximos fins de semana,
// Top colaboradores, distribuição por faixa e evolução por ciclo.
// Pergunta que a tela responde: "como está o ciclo agora e o que precisa da
// minha atenção?".

export default function DashboardPage() {
  // Seletor de ciclo: atual (padrão), anterior ou Total geral. Os números
  // seguem a escolha; as pendências operacionais são sempre de um ciclo (o
  // escolhido ou, no Total geral, o atual).
  const scope = useCycleScope();
  const p = scope.params;
  const summaryQ = useGetDashboardSummary(p, { query: { queryKey: getGetDashboardSummaryQueryKey(p) } });
  const summary = summaryQ.data;
  const topQ = useGetDashboardTopEmployees(p);
  const evolutionQ = useGetDashboardQuarterlyEvolution();
  const platoonsQ = useGetDashboardPlatoonDistribution(p);
  const rulesQ = useGetPlatoonRules({ query: { queryKey: getGetPlatoonRulesQueryKey(), staleTime: 5 * 60_000 } });
  // Ciclo atual e seus eventos: só para os próximos fins de semana e o "fora do período" (operacional).
  const { data: cycle } = useGetCurrentCycle();
  const eventsQ = useGetEvents();
  const events = eventsQ.data;

  const pastCycle = scope.selection.kind === "cycle";
  const isAll = scope.isAll;
  // Carregando / erro: o painel não afirma "nada" antes de os dados chegarem.
  const summaryLoading = summaryQ.isLoading;
  const summaryError = summaryQ.isError && !summary;

  // "X de Y no ciclo": Y = eventos do período (= Ciclos e lista de Eventos);
  // os fora do período (do próximo ciclo) aparecem à parte, como lá.
  const afterEnd = !pastCycle && !isAll && events ? countCycleEvents(events, () => cycle).afterEnd : 0;

  // Ciclo sem resultado apurado (o caso de um ciclo novo): Top e faixas vazios.
  const noResults = topQ.isSuccess && (topQ.data?.length ?? 0) === 0 && platoonsQ.isSuccess && (platoonsQ.data?.length ?? 0) === 0;
  const hasResults = !noResults;
  const showAgenda = !pastCycle;

  const refetchAll = () => {
    void summaryQ.refetch(); void topQ.refetch(); void platoonsQ.refetch(); void evolutionQ.refetch(); void eventsQ.refetch();
  };
  const refreshing = summaryQ.isFetching || topQ.isFetching || platoonsQ.isFetching || evolutionQ.isFetching;

  const evolution = (
    <EvolutionPanel
      data={evolutionQ.data}
      loading={evolutionQ.isLoading}
      error={evolutionQ.isError}
      onRetry={() => { void evolutionQ.refetch(); }}
      focusCycleId={isAll ? null : (scope.cycle?.id ?? null)}
      withCycle={scope.withCycle}
      className={noResults ? undefined : "lg:col-span-2 2xl:col-span-1"}
    />
  );

  return (
    <div className="min-h-full flex flex-col min-w-0">
      <DashboardHeader
        cycleSlot={<CycleSelect scope={scope} />}
        refreshing={refreshing && !summaryLoading}
        onRefresh={refetchAll}
        updatedAt={summaryQ.dataUpdatedAt || null}
      />

      <div className="flex-1 px-4 md:px-6 py-5 space-y-4 max-w-[1680px] w-full mx-auto">
        <CycleScopeNotice
          scope={scope}
          allHelp={<>Eventos, média, bônus e distribuição somam <strong>todos os ciclos</strong> (cada pessoa conta uma vez por ciclo; o Top mostra a média final de cada um, ponderada pelos eventos com nota). Avaliações em aberto e zona de risco continuam sendo do <strong>ciclo atual</strong>.</>}
        />

        {summaryError ? (
          <PanelError onRetry={refetchAll} />
        ) : summaryLoading || !summary ? (
          <IndicatorsSkeleton />
        ) : (
          <Indicators summary={summary} isAll={isAll} pastCycle={pastCycle} afterEnd={afterEnd} withCycle={scope.withCycle} />
        )}

        {!summaryError && (
          <div className={cn("grid gap-4 items-stretch", showAgenda && "lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]")}>
            <AttentionPanel summary={summary} loading={summaryLoading} isAll={isAll} pastCycle={pastCycle} hasResults={hasResults} withCycle={scope.withCycle} />
            {showAgenda && <AgendaPanel cycle={cycle} events={events} loading={eventsQ.isLoading} />}
          </div>
        )}

        {/* Tudo fora do ar: um aviso só (o "Tentar de novo" dele busca tudo), sem um erro por bloco. */}
        {summaryError && topQ.isError && platoonsQ.isError ? null : noResults ? (
          <div className="grid gap-4 items-stretch lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section data-testid="dashboard-no-results" aria-labelledby="dash-noresults-title" className={cn(surfaceCls, "px-6 py-10 lg:py-12 flex flex-col items-center justify-center text-center")}>
              <span className="w-11 h-11 rounded-full bg-secondary text-muted-foreground flex items-center justify-center"><Hourglass size={20} aria-hidden /></span>
              <h2 id="dash-noresults-title" className="font-condensed mt-3 text-[20px] font-black uppercase leading-tight text-foreground">
                {pastCycle ? "Este ciclo não tem resultado apurado" : "O ciclo ainda não tem resultado"}
              </h2>
              <p className="text-[14px] leading-relaxed text-muted-foreground mt-1 max-w-md">
                {pastCycle
                  ? "Nenhum evento deste ciclo teve o resultado confirmado."
                  : "O Top colaboradores e a distribuição por faixa aparecem quando o primeiro evento do ciclo tiver o resultado confirmado."}
              </p>
              {!pastCycle && !isAll && (
                <Link href="/evaluations" className={cn(btnSecondary, "mt-4 group")}>
                  Acompanhar as avaliações
                  <ArrowRight size={15} aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </Link>
              )}
            </section>
            {evolution}
          </div>
        ) : (
          <div className="grid gap-4 items-stretch lg:grid-cols-2 2xl:grid-cols-3">
            <TopPanel rows={topQ.data} loading={topQ.isLoading} error={topQ.isError} onRetry={() => { void topQ.refetch(); }} isAll={isAll} withCycle={scope.withCycle} />
            <FaixasPanel data={platoonsQ.data} rules={rulesQ.data} loading={platoonsQ.isLoading} error={platoonsQ.isError} onRetry={() => { void platoonsQ.refetch(); }} isAll={isAll} withCycle={scope.withCycle} />
            {evolution}
          </div>
        )}
      </div>
    </div>
  );
}
