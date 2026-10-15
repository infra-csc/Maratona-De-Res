// Tela "Meu desempenho" (o colaborador vê a própria nota; o admin pode "ver
// como colaborador"): dados e orquestração. As peças visuais vivem em
// ./my-performance/: topo, nota do ciclo (faixa, bônus, eventos que contam),
// a conta da nota, penalidades e méritos, pontos fortes e os eventos.
// Público principal: montadores no celular — linguagem simples, sem jargão,
// e nunca o nome de quem avaliou.
import { useAuth } from "@/lib/auth-context";
import { useGetCurrentCycle, useGetMyPerformance, getGetMyPerformanceQueryKey } from "@workspace/api-client-react";
import { performanceErrorMessage } from "./my-performance/helpers";
import { useEventFilters } from "./my-performance/use-event-filters";
import { PageHeader, PerformanceSkeleton, PrivacyNote, RestrictedAccessNotice } from "./my-performance/page-bits";
import { SummaryCards } from "./my-performance/summary-cards";
import { ScoreBreakdown } from "./my-performance/score-breakdown";
import { AdjustmentsSection } from "./my-performance/adjustments-section";
import { CycleHighlights } from "./my-performance/cycle-highlights";
import { EventHistory } from "./my-performance/event-history";
import { Avatar } from "./employees/ui";
import { Eyebrow, LoadError } from "./my-performance/mp-ui";
import { cn } from "@/lib/utils";

const JUMPS = [
  { href: "#mp-calc", label: "A conta" },
  { href: "#mp-adjustments", label: "Penalidades e méritos" },
  { href: "#mp-highlights", label: "Pontos fortes" },
  { href: "#mp-events", label: "Eventos" },
];

export default function MyPerformancePage() {
  const { user } = useAuth();
  // Mantém o cache do ciclo aquecido para o topo (nome e período).
  useGetCurrentCycle();

  const { data, isLoading, error, refetch, isFetching } = useGetMyPerformance({
    query: { queryKey: getGetMyPerformanceQueryKey(), enabled: !!user?.employeeId },
  });
  const filters = useEventFilters(data?.events);

  if (!user?.employeeId) {
    return <RestrictedAccessNotice />;
  }

  const summary = data?.summary;
  const result = summary?.finalResult ?? summary?.grossAverage ?? null;
  const name = data?.employee.name ?? user?.name ?? "";
  const hasScore = result != null;
  const jumps = JUMPS.filter(j => j.href !== "#mp-highlights" || hasScore).filter(j => j.href !== "#mp-calc" || hasScore);

  return (
    <div className="min-h-full flex flex-col min-w-0 font-body">
      <PageHeader />

      <div className="flex-1 px-4 md:px-6 py-5 md:py-7 w-full max-w-[1180px] mx-auto space-y-8">
        {/* Quem é */}
        <div className="flex items-center gap-3" data-testid="my-identity">
          <Avatar name={name || "?"} className="w-12 h-12 text-[17px]" />
          <div className="min-w-0">
            {(data?.employee.functionName || data?.cycle.name) && <Eyebrow as="p" className="mb-1.5">{[data?.employee.functionName, data?.cycle.name ? (/^ciclo/i.test(data.cycle.name) ? data.cycle.name : `Ciclo ${data.cycle.name}`) : null].filter(Boolean).join(" · ")}</Eyebrow>}
            <p className="font-condensed text-[24px] sm:text-[28px] font-black uppercase leading-[0.95] tracking-[-0.01em] text-foreground break-words">
              <span className="sr-only">Desempenho de </span>{name}
            </p>
          </div>
        </div>

        {isLoading ? <PerformanceSkeleton /> : error || !data || !summary ? (
          <LoadError detail={error && performanceErrorMessage(error) !== "Erro ao carregar desempenho" ? performanceErrorMessage(error) : null}
            retrying={isFetching} onRetry={() => { void refetch(); }} />
        ) : (
          <div className={cn("space-y-8 md:space-y-10 transition-opacity duration-150", isFetching && "opacity-80")}>
            <SummaryCards summary={summary} result={result} />

            {jumps.length > 1 && (
              <nav aria-label="Ir para" className="-mt-3 -mx-4 px-4 md:mx-0 md:px-0 flex gap-1.5 overflow-x-auto md:flex-wrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {jumps.map(j => (
                  <a key={j.href} href={j.href}
                    className="font-condensed shrink-0 whitespace-nowrap inline-flex items-center min-h-11 md:min-h-8 px-3 rounded-lg bg-secondary text-[13px] font-bold uppercase tracking-[0.04em] text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {j.label}
                  </a>
                ))}
              </nav>
            )}

            <ScoreBreakdown events={data.events} summary={summary} result={result} />
            <AdjustmentsSection adjustments={data.adjustments} />
            <CycleHighlights events={data.events} />
            <EventHistory filters={filters} events={data.events} cycleName={data.cycle.name} />
            <PrivacyNote />
          </div>
        )}
      </div>
    </div>
  );
}
