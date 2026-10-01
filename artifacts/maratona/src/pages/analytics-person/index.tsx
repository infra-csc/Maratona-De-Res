import { useEffect, useMemo } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  useGetQuarterlyResults, getGetQuarterlyResultsQueryKey,
  useGetPlatoonRules, getGetPlatoonRulesQueryKey,
  useGetAnalyticsOverview, getGetAnalyticsOverviewQueryKey,
  useGetAnalyticsEventsReport, getGetAnalyticsEventsReportQueryKey,
  useGetRankingDetail, getGetRankingDetailQueryKey,
} from "@workspace/api-client-react";
import { AlertTriangle, ChevronLeft, ChevronRight, History, UserX, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState, LoadingState } from "@/components/shared";
import { BODY, CONDENSED } from "@/lib/premium-theme";
import { fmtDate } from "@/lib/utils";
import { useAuth, hasRole } from "@/lib/auth-context";
import { AnalyticsTabs } from "../analytics-team/analytics-tabs";
import { activeFaixas, n1 } from "./derive";
import { SearchPicker } from "./ui";
import { TeamView } from "./team-view";
import { PersonView } from "./person-view";

const fmtDay = (iso: string) => fmtDate(iso, { day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * Análises → Por colaborador. Sem colaborador: a equipe inteira, uma linha por
 * pessoa (nota, eventos, penalidades, méritos, bônus). Com `?colaborador=ID`:
 * a análise detalhada do ciclo dele — a conta da nota, o que as penalidades
 * custaram (na nota, na faixa e no bônus), evento a evento, critérios,
 * comparação com a equipe e, para admin e RH, a evolução da nota.
 * Não mostra quem avaliou.
 */
export default function AnalyticsPersonPage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const canTimeline = hasRole(user, "admin") || hasRole(user, "rh");

  const employeeId = useMemo(() => {
    const v = Number(new URLSearchParams(search).get("colaborador"));
    return Number.isInteger(v) && v > 0 ? v : null;
  }, [search]);

  const pick = (id: number | null) => {
    navigate(id ? `/analytics/colaborador?colaborador=${id}` : "/analytics/colaborador");
  };
  useEffect(() => {
    window.scrollTo({ top: 0 });
    document.querySelector("main")?.scrollTo({ top: 0 });
  }, [employeeId]);

  const ranking = useGetQuarterlyResults(undefined, { query: { queryKey: getGetQuarterlyResultsQueryKey(), staleTime: 60_000 } });
  const rules = useGetPlatoonRules({ query: { queryKey: getGetPlatoonRulesQueryKey(), staleTime: 5 * 60_000 } });
  const overview = useGetAnalyticsOverview({ query: { queryKey: getGetAnalyticsOverviewQueryKey(), staleTime: 60_000 } });
  const report = useGetAnalyticsEventsReport(undefined, { query: { queryKey: getGetAnalyticsEventsReportQueryKey(), staleTime: 60_000, enabled: employeeId != null } });
  const detailParams = { employeeId: employeeId ?? 0 };
  const detail = useGetRankingDetail(detailParams, { query: { queryKey: getGetRankingDetailQueryKey(detailParams), enabled: employeeId != null, retry: false } });

  const faixas = useMemo(() => activeFaixas(rules.data), [rules.data]);
  const rows = ranking.data ?? [];
  const ordered = useMemo(() => [...rows].sort((a, b) => b.finalResult - a.finalResult || a.employeeName.localeCompare(b.employeeName, "pt-BR")), [rows]);
  const minEvents = overview.data?.ruleSet.minEvents ?? overview.data?.kpis.minEvents ?? 0;
  const cycle = overview.data?.cycle;
  const period = cycle?.startDate && cycle?.endDate ? `${fmtDay(cycle.startDate)} a ${fmtDay(cycle.endDate)}` : null;

  const idx = employeeId != null ? ordered.findIndex(r => r.employeeId === employeeId) : -1;
  const prev = idx > 0 ? ordered[idx - 1] : null;
  const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;

  const loadingBase = ranking.isLoading || rules.isLoading || overview.isLoading;
  const baseError = ranking.isError || rules.isError;

  return (
    <div className="px-4 md:px-6 py-6 space-y-5 max-w-[1440px] mx-auto" style={{ fontFamily: BODY }}>
      <PageHeader
        eyebrow={cycle ? `${cycle.name}${period ? ` · ${period}` : ""}` : "Ciclo atual"}
        title="Análises"
        description={employeeId
          ? "Análise do ciclo de um colaborador: a conta da nota, o que as penalidades custaram na nota, na faixa e no bônus, a nota de cada evento, os critérios e a comparação com a equipe."
          : "Uma análise por participante: escolha um colaborador ou clique numa linha para ver o ciclo dele em detalhe. Não mostra quem avaliou."}
      />
      <AnalyticsTabs current="colaborador" />

      {/* ── Filtro ── */}
      <section aria-label="Escolher colaborador" className="rounded-xl p-3 sm:p-4 flex flex-wrap items-end gap-3" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="w-full sm:w-[380px] min-w-0">
          <label htmlFor="ap-colaborador" className="block mb-1 text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>Colaborador</label>
          <SearchPicker id="ap-colaborador" value={employeeId} onChange={pick}
            placeholder={ranking.isLoading ? "Carregando…" : "Toda a equipe"} emptyText="Ninguém com esse nome." allLabel="Toda a equipe"
            options={ordered.map(r => ({ id: r.employeeId, label: r.employeeName, hint: n1(r.finalResult), color: r.platoonColor ?? null }))} />
        </div>
        {employeeId != null && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1" role="group" aria-label="Navegar pelo ranking">
              <Button variant="outline" size="icon" className="h-10 w-10" disabled={!prev} onClick={() => prev && pick(prev.employeeId)}
                aria-label={prev ? `Anterior no ranking: ${prev.employeeName}` : "Sem anterior no ranking"} title={prev ? `Anterior: ${prev.employeeName}` : undefined} data-testid="button-person-prev">
                <ChevronLeft size={18} aria-hidden />
              </Button>
              <Button variant="outline" size="icon" className="h-10 w-10" disabled={!next} onClick={() => next && pick(next.employeeId)}
                aria-label={next ? `Próximo no ranking: ${next.employeeName}` : "Sem próximo no ranking"} title={next ? `Próximo: ${next.employeeName}` : undefined} data-testid="button-person-next">
                <ChevronRight size={18} aria-hidden />
              </Button>
            </div>
            <Button variant="outline" className="h-10" onClick={() => pick(null)} data-testid="button-person-team">
              <Users size={15} className="mr-1.5" aria-hidden /> Toda a equipe
            </Button>
            {canTimeline && detail.data && (
              <Button asChild variant="outline" className="h-10">
                <Link href={`/linha-do-tempo?colaborador=${employeeId}`} data-testid="button-person-timeline">
                  <History size={15} className="mr-1.5" aria-hidden /> Ver linha do tempo
                </Link>
              </Button>
            )}
          </div>
        )}
        {idx >= 0 && (
          <p className="text-[12px] tabular-nums sm:ml-auto self-center" style={{ color: "var(--muted-foreground)" }}>
            {idx + 1}º de {ordered.length} no ranking
          </p>
        )}
      </section>

      {loadingBase ? (
        <LoadingState lines={8} withHeader label="Carregando a análise" />
      ) : baseError ? (
        <EmptyState icon={AlertTriangle} title="Não foi possível carregar a análise" description="Tente novamente em instantes."
          action={<Button variant="outline" onClick={() => { void ranking.refetch(); void rules.refetch(); }}>Tentar de novo</Button>} />
      ) : employeeId == null ? (
        <TeamView rows={rows} faixas={faixas} minEvents={minEvents} onPick={pick} />
      ) : detail.isLoading ? (
        <LoadingState lines={10} withHeader label="Montando a análise do colaborador" />
      ) : detail.isError || !detail.data ? (
        <EmptyState icon={UserX} title="Colaborador não encontrado" description="Ele pode ter sido removido ou não fazer parte do ciclo atual. Escolha outra pessoa ou volte para a equipe."
          action={<Button variant="outline" onClick={() => pick(null)}>Ver toda a equipe</Button>} />
      ) : (
        <PersonView detail={detail.data} rows={rows} faixas={faixas} minEvents={minEvents}
          teamEventAvg={overview.data?.kpis.avgEventScore ?? null} report={report.data} canTimeline={canTimeline} onPick={pick} />
      )}
    </div>
  );
}
