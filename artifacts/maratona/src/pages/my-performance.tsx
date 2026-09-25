// Tela "Meu Desempenho": dados e orquestração. As peças visuais vivem em
// ./my-performance/: faixa de status do ciclo, cartões de resumo (média,
// elegibilidade, faixa), "Como sua nota é calculada", penalidades e méritos,
// destaques do ciclo, histórico de eventos (cartão do evento + quesitos) e o
// hook dos filtros do histórico.
import { useAuth } from "@/lib/auth-context";
import { useGetCurrentCycle, useGetMyPerformance, getGetMyPerformanceQueryKey } from "@workspace/api-client-react";
import { CycleBadge } from "@/components/cycle-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingUp, AlertTriangle } from "lucide-react";
import { performanceErrorMessage } from "./my-performance/helpers";
import { useEventFilters } from "./my-performance/use-event-filters";
import { RestrictedAccessNotice, CycleStatusBanner, PrivacyNote } from "./my-performance/page-bits";
import { SummaryCards } from "./my-performance/summary-cards";
import { ScoreBreakdown } from "./my-performance/score-breakdown";
import { AdjustmentsSection } from "./my-performance/adjustments-section";
import { CycleHighlights } from "./my-performance/cycle-highlights";
import { EventHistory } from "./my-performance/event-history";

export default function MyPerformancePage() {
  const { user } = useAuth();
  // Mantém o cache do ciclo aquecido para o CycleBadge; o resultado não é lido aqui.
  useGetCurrentCycle();

  const { data, isLoading, error } = useGetMyPerformance({
    query: { queryKey: getGetMyPerformanceQueryKey(), enabled: !!user?.employeeId },
  });
  const filters = useEventFilters(data?.events);

  if (!user?.employeeId) {
    return <RestrictedAccessNotice />;
  }

  const summary = data?.summary;
  const result = summary?.finalResult ?? summary?.grossAverage ?? null;

  return (
    <div className="min-h-full text-foreground" style={{ backgroundColor: "var(--background)" }}>
      {/* Header */}
      <header className="sticky top-14 md:top-0 z-30 flex flex-wrap gap-4 justify-between items-center px-6 md:px-10 py-[18px]" style={{ backgroundColor: "var(--background)", borderBottom: "1px solid var(--border)" }}>
        <h1 className="font-black text-[24px] uppercase tracking-tight flex items-center gap-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--accent-text)" }}>
          <TrendingUp size={24} />
          Meu Desempenho
        </h1>
        <CycleBadge />
      </header>

      <div className="p-4 sm:p-6 md:p-10 space-y-8">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-black text-[14px] uppercase px-3 py-1.5 rounded-lg" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)", fontFamily: "'Barlow Condensed', sans-serif" }}>{data?.employee.name ?? user?.name}</span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{data?.employee.functionName}</span>
        </div>

        {data && summary && <CycleStatusBanner summary={summary} />}

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="rounded-xl bg-[var(--status-danger-bg)] border-[#862200]/30 text-[var(--status-danger-text)]">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="font-bold ml-2">{performanceErrorMessage(error)}</AlertDescription>
          </Alert>
        )}

        {data && summary && (
          <>
            {/* Summary Cards */}
            <SummaryCards summary={summary} result={result} />

            {/* Detalhamento dos eventos que compõem a média */}
            <ScoreBreakdown events={data.events} summary={summary} result={result} />

            {/* Penalidades e Méritos */}
            <AdjustmentsSection adjustments={data.adjustments} />

            {/* Item 6 — Destaques do Ciclo (critério mais forte / mais fraco) */}
            <CycleHighlights events={data.events} />

            {/* Histórico de Eventos */}
            <EventHistory filters={filters} events={data.events} cycleName={data.cycle.name} />

            {/* Privacy note */}
            <PrivacyNote />
          </>
        )}
      </div>
    </div>
  );
}
