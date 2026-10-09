import type { ReactElement } from "react";
import { Link } from "wouter";
import { keepPreviousData } from "@tanstack/react-query";
import { useGetAnalyticsOverview, getGetAnalyticsOverviewQueryKey, useGetRankingTotal, getGetRankingTotalQueryKey, type AnalyticsOverview } from "@workspace/api-client-react";
import { ArrowRight, Hourglass, RefreshCw } from "lucide-react";
import { CycleScopeNotice, useCycleScope, type CycleScopeState } from "@/components/cycle-select";
import { useAuth, hasRole } from "@/lib/auth-context";
import { faixaBonusSplit } from "@/lib/faixa-bonus-split";
import { cn } from "@/lib/utils";
import { AnalyticsScopeFallback, AnalyticsTopBar, analyticsBody } from "./analytics-team/analytics-tabs";
import { btnGhost, btnSecondary, surfaceCls } from "./dashboard/dashboard-ui";
import { GestaoIndicators } from "./analytics-gestao/indicators";
import { ReadingPanel } from "./analytics-gestao/reading";
import { CriteriaPanel, ConformityPanel, TrendPanel } from "./analytics-gestao/panels-quality";
import { FaixasPanel, FunnelPanel, NearPanel } from "./analytics-gestao/panels-bonus";
import { AdjustmentsPanel, ClientsPanel, EvaluatorsPanel, PeoplePanel } from "./analytics-gestao/panels-people";
import { ExportMenu } from "./analytics-gestao/export-menu";

// Análises → Painel de gestão. Diagnóstico do ciclo para diretoria e RH:
// "onde estamos bem, onde estamos mal e onde agir?". Topo fixo com ciclo e
// exportação, faixa de indicadores (atalhos), a leitura do ciclo e os blocos
// de diagnóstico — cada gráfico com a mesma informação em tabela. As partes
// ficam em ./analytics-gestao/.

export default function AnalyticsPage() {
  // Seletor de ciclo: atual (padrão), anterior (só consulta) ou Total geral.
  const scope = useCycleScope();
  // Trocar de ciclo mantém a tela anterior até chegar a nova (sem sumir o seletor).
  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useGetAnalyticsOverview(scope.params, {
    query: { queryKey: getGetAnalyticsOverviewQueryKey(scope.params), staleTime: 60_000, placeholderData: keepPreviousData },
  });

  if (isLoading) {
    return <AnalyticsScopeFallback scope={scope} current="gestao" state="loading" loadingLabel="Carregando as análises" errorTitle="" />;
  }
  if (isError || !data) {
    return <AnalyticsScopeFallback scope={scope} current="gestao" state="error" loadingLabel="" errorTitle="Não foi possível carregar as análises"
      onRetry={() => void refetch()}
      errorDetail={(error as { data?: { error?: string }; message?: string } | null)?.data?.error ?? (error as { message?: string } | null)?.message} />;
  }
  return <AnalyticsView data={data} scope={scope} updatedAt={dataUpdatedAt} refreshing={isFetching} onRefresh={() => void refetch()} />;
}

/** Linha de ajuda do Total geral nas Análises (o que é somado e o que some). */
const ANALYTICS_ALL_HELP = (
  <>Todos os eventos e resultados de <strong>todos os ciclos</strong>. Pessoas contam uma vez por ciclo (quem esteve em dois ciclos conta duas vezes); o funil usa o mínimo de eventos de cada ciclo. Projeções de um ciclo, como "perto da próxima faixa", não aparecem aqui.</>
);

type Item = { key: string; el: (cls?: string) => ReactElement; wide?: boolean };

/**
 * Grade de duas colunas sem buracos: blocos largos ocupam a linha; um bloco
 * normal que sobraria sozinho (antes de um largo ou no fim) ocupa a linha toda.
 */
function Grid({ items }: { items: Item[] }) {
  const out: ReactElement[] = [];
  let run: Item[] = [];
  const flush = () => {
    run.forEach((it, i) => out.push(<div key={it.key} className={cn("min-w-0 flex flex-col [&>*]:flex-1", run.length % 2 === 1 && i === run.length - 1 && "lg:col-span-2")}>{it.el()}</div>));
    run = [];
  };
  for (const it of items) {
    if (it.wide) { flush(); out.push(<div key={it.key} className="min-w-0 lg:col-span-2 flex flex-col [&>*]:flex-1">{it.el()}</div>); }
    else run.push(it);
  }
  flush();
  return <div className="grid gap-4 lg:grid-cols-2 items-stretch">{out}</div>;
}

function AnalyticsView({ data, scope, updatedAt, refreshing, onRefresh }: {
  data: AnalyticsOverview; scope: CycleScopeState; updatedAt: number; refreshing: boolean; onRefresh: () => void;
}) {
  const { user } = useAuth();
  const isAll = scope.isAll;
  const readOnly = scope.readOnly;
  const w = scope.withCycle;
  // Linha do tempo é só de admin e RH (diretoria vê Análises, mas não o histórico).
  // Ela mostra o ciclo atual: fora dele (consulta) os nomes não viram link.
  const canTimeline = (hasRole(user, "admin") || hasRole(user, "rh")) && !readOnly;
  const k = data.kpis;
  // Total geral: oficial × projetado por faixa (soma pessoa × ciclo do Total geral).
  const rankingTotal = useGetRankingTotal({ query: { queryKey: getGetRankingTotalQueryKey(), staleTime: 60_000, enabled: isAll } });
  const split = isAll ? faixaBonusSplit(rankingTotal.data, data.faixas) : null;
  // "Sem cliente" não é cliente: sem nenhum evento com cliente informado, o bloco some.
  const realClients = data.clients.filter(c => c.client !== "Sem cliente");
  const pertoCard = !isAll && data.nearNextFaixa.length > 0;
  const quemCard = data.topPenalized.length + data.topMerited.length > 0;
  // Ciclo sem nenhum evento confirmado (o caso de um ciclo novo): nada de dez blocos vazios.
  const noResults = k.eventsConfirmed === 0;
  const time = new Date(updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const items: Item[] = noResults ? [
    ...(data.evaluators.length > 0 ? [{ key: "aval", wide: true, el: () => <EvaluatorsPanel data={data} isAll={isAll} readOnly={readOnly} /> }] : []),
    ...(data.adjustments.length > 0 ? [{ key: "adj", el: () => <AdjustmentsPanel data={data} isAll={isAll} readOnly={readOnly} /> }] : []),
  ] : [
    { key: "crit", el: () => <CriteriaPanel data={data} readOnly={readOnly} /> },
    { key: "conf", el: () => <ConformityPanel data={data} withCycle={w} /> },
    { key: "faixas", el: () => <FaixasPanel data={data} isAll={isAll} readOnly={readOnly} split={split} nearCount={isAll ? null : data.nearNextFaixa.length} withCycle={w} /> },
    { key: "funnel", el: () => <FunnelPanel data={data} isAll={isAll} withCycle={w} /> },
    { key: "trend", el: () => <TrendPanel data={data} readOnly={readOnly} isAll={isAll} withCycle={w} /> },
    ...(pertoCard ? [{ key: "perto", el: () => <NearPanel data={data} readOnly={readOnly} withCycle={w} /> }] : []),
    { key: "aval", wide: true, el: () => <EvaluatorsPanel data={data} isAll={isAll} readOnly={readOnly} /> },
    { key: "adj", el: () => <AdjustmentsPanel data={data} isAll={isAll} readOnly={readOnly} /> },
    ...(realClients.length > 0 ? [{ key: "cli", el: () => <ClientsPanel clients={realClients} isAll={isAll} withCycle={w} /> }] : []),
    ...(quemCard ? [{ key: "quem", wide: true, el: () => <PeoplePanel data={data} isAll={isAll} canTimeline={canTimeline} /> }] : []),
  ];

  return (
    <div className="min-h-full flex flex-col min-w-0">
      <AnalyticsTopBar
        scope={scope}
        current="gestao"
        actions={<>
          <span className="hidden xl:inline text-[12.5px] text-muted-foreground tabular-nums" aria-live="polite">
            {refreshing ? "Atualizando…" : `Atualizado às ${time}`}
          </span>
          <button type="button" onClick={onRefresh} disabled={refreshing} aria-busy={refreshing || undefined}
            aria-label="Atualizar as análises" title="Busca os números de novo" data-testid="button-refresh-analytics"
            className={cn(btnGhost, "px-2.5 lg:px-3")}>
            <RefreshCw size={15} aria-hidden className={refreshing ? "motion-safe:animate-spin" : undefined} />
            <span className="hidden lg:inline">Atualizar</span>
          </button>
          <ExportMenu data={data} scope={scope} />
        </>}
      />

      <div className={cn(analyticsBody, "transition-opacity duration-200 motion-reduce:transition-none", refreshing && "opacity-70")} aria-busy={refreshing || undefined}>
        <CycleScopeNotice scope={scope} allHelp={ANALYTICS_ALL_HELP} />
        <GestaoIndicators data={data} isAll={isAll} readOnly={readOnly} withCycle={w} />
        {noResults ? <NoResults scope={scope} /> : <ReadingPanel data={data} isAll={isAll} readOnly={readOnly} withCycle={w} />}
        {items.length > 0 && <Grid items={items} />}
      </div>
    </div>
  );
}

/** Ciclo sem evento confirmado: um aviso só, com o que vai aparecer e onde acompanhar. */
function NoResults({ scope }: { scope: CycleScopeState }) {
  const past = scope.readOnly;
  return (
    <section data-testid="analytics-no-results" aria-labelledby="analytics-noresults-title" className={cn(surfaceCls, "px-6 py-10 lg:py-12 flex flex-col items-center justify-center text-center")}>
      <span className="w-11 h-11 rounded-full bg-secondary text-muted-foreground flex items-center justify-center"><Hourglass size={20} aria-hidden /></span>
      <h2 id="analytics-noresults-title" className="font-condensed mt-3 text-[20px] font-black uppercase leading-tight text-foreground">
        {past ? (scope.isAll ? "Nenhum evento confirmado em nenhum ciclo" : "Este ciclo não teve evento confirmado") : "O ciclo ainda não tem resultado"}
      </h2>
      <p className="text-[14px] leading-relaxed text-muted-foreground mt-1 max-w-lg">
        {past
          ? "Sem evento com resultado confirmado, não há notas, critérios, matriz nem bônus para analisar."
          : "Critérios, matriz de conformidade, faixas, funil do bônus e a leitura do ciclo aparecem quando o primeiro evento tiver o resultado confirmado. Até lá, acompanhe as avaliações."}
      </p>
      {!past && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link href="/evaluations" className={cn(btnSecondary, "group")}>
            Acompanhar as avaliações
            <ArrowRight size={15} aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </Link>
          <Link href="/events" className={cn(btnGhost, "min-h-11")}>Ver eventos</Link>
        </div>
      )}
    </section>
  );
}
