import { useState } from "react";
import { useGetQuarterlyResults, getGetQuarterlyResultsQueryKey, useListCycles, getListCyclesQueryKey } from "@workspace/api-client-react";
import { CycleSelect, CycleScopeNotice, useCycleScope } from "@/components/cycle-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Table2, ListOrdered } from "lucide-react";
import { useAuth, hasRole } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { RankingTab } from "./results/ranking-tab";
import { ConsolidationTab } from "./results/consolidation-tab";
import { PaymentsTab } from "./results/payments-tab";
import { TotalTab } from "./results/total-tab";
import { ResultsHeader } from "./results/results-header";
import { CyclePanorama } from "./results/cycle-panorama";
import { CloseCycleDialog } from "./results/close-cycle-dialog";
import { useCycleActions } from "./results/use-cycle-actions";

// Partes da página ficam em ./results/: topo (results-header), panorama do
// ciclo, abas (ranking-tab, consolidation-tab, payments-tab, total-tab), pódio,
// ficha do colaborador (com a composição do bônus), diálogos de fechar ciclo e
// de pagamento, peças visuais (results-ui) e helpers puros (helpers.ts).

const TAB_CLS = cn(
  "font-condensed flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 min-h-11 lg:min-h-9 px-3 sm:px-4 rounded-md",
  "text-[13px] font-bold uppercase tracking-[0.05em] leading-none whitespace-nowrap shadow-none",
  "text-muted-foreground transition-[background-color,color,box-shadow] duration-150 hover:text-foreground",
  "data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
);

export default function ResultsPage() {
  const { user } = useAuth();
  // Um só flag: quem gerencia resultados (exporta consolidação, fecha/recalcula ciclo, edita pagamentos).
  const isManager = ["admin", "rh", "diretoria"].some(r => hasRole(user, r));
  const [tab, setTab] = useState("ranking");
  // Seletor de ciclo: atual (padrão), anterior (só consulta) ou Total geral.
  const scope = useCycleScope();
  const { cycleId, readOnly } = scope;
  const cycleClosed = scope.cycle?.status === "closed";

  // Mesma consulta (e mesmo cache) das abas Consolidação e Bônus: o panorama não pede nada a mais.
  const params = cycleId ? { cycleId } : undefined;
  const { data: results, isLoading: resultsLoading, isError: resultsError, refetch: refetchResults } = useGetQuarterlyResults(params, {
    query: { queryKey: getGetQuarterlyResultsQueryKey(params), enabled: !scope.isAll },
  });
  // Eventos do ciclo (confirmados × abertos) — os mesmos números da tela Ciclos.
  const { data: cycles } = useListCycles({ query: { queryKey: getListCyclesQueryKey(), enabled: isManager && !scope.isAll, staleTime: 60_000 } });
  const stats = cycles?.find(c => c.id === scope.cycle?.id)?.stats ?? null;
  const events = stats ? { total: stats.eventsTotal, confirmed: stats.eventsConfirmed, open: stats.eventsOpen } : null;

  const actions = useCycleActions(cycleId);
  // Fechar e recalcular: só no ciclo atual ainda aberto (fechado, a API recusa os dois).
  const canAct = isManager && !readOnly && !cycleClosed;
  const rows = results ?? [];
  const minEvents = scope.cycle?.effectiveMinEvents ?? null;

  return (
    <div className="min-h-full flex flex-col min-w-0">
      <ResultsHeader
        cycleSlot={<CycleSelect scope={scope} />}
        closedLabel={scope.isCurrent && cycleClosed ? "Ciclo fechado" : null}
        // Recalcular: a API só aceita admin e RH (diretoria fecha o ciclo, mas não recalcula).
        recompute={canAct && ["admin", "rh"].some(r => hasRole(user, r)) ? { run: actions.recompute, pending: actions.recomputing } : null}
        actions={canAct ? (
          <CloseCycleDialog
            onClose={actions.close}
            closing={actions.closing}
            summary={{
              cycleName: scope.cycle?.name ?? "ciclo",
              minEvents,
              events,
              bonusTotal: rows.reduce((s, r) => s + (r.bonusValue ?? 0), 0),
              withBonus: rows.filter(r => (r.bonusValue ?? 0) > 0).length,
            }}
          />
        ) : null}
      />

      <div className="flex-1 px-4 md:px-6 py-5 space-y-4 max-w-[1680px] w-full mx-auto">
        <CycleScopeNotice
          scope={scope}
          paymentNote
          allHelp={<>Uma linha por pessoa somando todos os ciclos: <strong>média final ponderada pelos eventos com nota</strong> (um ciclo com mais eventos pesa mais), eventos com nota, <strong>bônus oficial</strong> (ciclos fechados) separado do <strong>bônus projetado</strong> (ciclo ainda aberto) e bônus pago. Não existe faixa do total: a coluna mostra a faixa do ciclo mais recente de cada pessoa.</>}
        />

        {scope.isAll ? (
          <TotalTab onOpenCycle={(id, isCurrent) => scope.select(isCurrent ? "atual" : id)} />
        ) : (
          <>
            <CyclePanorama
              rows={rows}
              loading={resultsLoading}
              error={resultsError}
              onRetry={() => { void refetchResults(); }}
              cycleClosed={cycleClosed}
              closedAt={scope.cycle?.closedAt ?? null}
              minEvents={minEvents}
              events={isManager ? events : null}
              activeTab={tab}
              onFaixas={() => setTab(t => (t === "consolidacao" ? "ranking" : "consolidacao"))}
              onBonus={isManager ? () => setTab(t => (t === "bonus" ? "ranking" : "bonus")) : undefined}
            />

            <Tabs value={tab} onValueChange={setTab} className="space-y-4">
              <TabsList aria-label="Visão dos resultados" className="h-auto w-full sm:w-fit flex gap-0.5 p-0.5 rounded-lg bg-secondary text-muted-foreground">
                <TabsTrigger value="ranking" data-testid="tab-ranking" className={TAB_CLS}>
                  <ListOrdered size={14} aria-hidden className="hidden sm:inline" /> Ranking
                </TabsTrigger>
                <TabsTrigger value="consolidacao" data-testid="tab-consolidacao" className={TAB_CLS}>
                  <Table2 size={14} aria-hidden className="hidden sm:inline" /> Consolidação
                </TabsTrigger>
                {isManager && (
                  <TabsTrigger value="bonus" data-testid="tab-bonus" className={TAB_CLS}>
                    <Wallet size={14} aria-hidden className="hidden sm:inline" /> <span>Bônus<span className="hidden sm:inline"> &amp; Pagamentos</span></span>
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="ranking" className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                <RankingTab canViewDetail={true} cycleId={cycleId} readOnly={readOnly} minEvents={minEvents} cycleClosed={cycleClosed} />
              </TabsContent>
              <TabsContent value="consolidacao" className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                <ConsolidationTab isManager={isManager} cycleId={cycleId} readOnly={readOnly} cycleClosed={cycleClosed} />
              </TabsContent>
              {isManager && (
                <TabsContent value="bonus" className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                  <PaymentsTab canManage={isManager} cycleId={cycleId} readOnly={readOnly} cycleClosed={cycleClosed} />
                </TabsContent>
              )}
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
