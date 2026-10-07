import { useEffect, useMemo } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  useGetQuarterlyResults, getGetQuarterlyResultsQueryKey,
  useGetPlatoonRules, getGetPlatoonRulesQueryKey,
  useGetAnalyticsOverview, getGetAnalyticsOverviewQueryKey,
  useGetAnalyticsEventsReport, getGetAnalyticsEventsReportQueryKey,
  useGetRankingDetail, getGetRankingDetailQueryKey,
  useGetRankingTotal, getGetRankingTotalQueryKey,
  ApiError,
} from "@workspace/api-client-react";
import { AlertTriangle, ChevronLeft, ChevronRight, History, UserMinus, UserX, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState, LoadingState } from "@/components/shared";
import { BODY, CONDENSED } from "@/lib/premium-theme";
import { fmtDate } from "@/lib/utils";
import { useAuth, hasRole } from "@/lib/auth-context";
import { AnalyticsTabs } from "../analytics-team/analytics-tabs";
import { activeFaixas, n1, rankOf } from "./derive";
import { SearchPicker } from "./ui";
import { TeamView } from "./team-view";
import { PersonView } from "./person-view";
import { TotalTeamView, TotalPersonView } from "./total-view";
import { CycleSelect, CycleScopeNotice, useCycleScope } from "@/components/cycle-select";

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
  // Seletor de ciclo: atual (padrão), anterior (só consulta) ou Total geral.
  const scope = useCycleScope();
  const isAll = scope.isAll;
  const p = isAll ? undefined : scope.params;
  const pastCycleId = scope.selection.kind === "cycle" ? scope.selection.id : undefined;

  const employeeId = useMemo(() => {
    const v = Number(new URLSearchParams(search).get("colaborador"));
    return Number.isInteger(v) && v > 0 ? v : null;
  }, [search]);

  const pick = (id: number | null) => {
    navigate(scope.withCycle(id ? `/analytics/colaborador?colaborador=${id}` : "/analytics/colaborador"));
  };
  // Total geral → análise de um ciclo da pessoa (o atual sem parâmetro).
  const openCycle = (cycleId: number, isCurrent: boolean) => {
    navigate(`/analytics/colaborador?colaborador=${employeeId}${isCurrent ? "" : `&ciclo=${cycleId}`}`);
  };
  useEffect(() => {
    window.scrollTo({ top: 0 });
    document.querySelector("main")?.scrollTo({ top: 0 });
  }, [employeeId]);

  const ranking = useGetQuarterlyResults(p, { query: { queryKey: getGetQuarterlyResultsQueryKey(p), staleTime: 60_000, enabled: !isAll } });
  const rules = useGetPlatoonRules({ query: { queryKey: getGetPlatoonRulesQueryKey(), staleTime: 5 * 60_000 } });
  const overview = useGetAnalyticsOverview(p, { query: { queryKey: getGetAnalyticsOverviewQueryKey(p), staleTime: 60_000, enabled: !isAll } });
  const total = useGetRankingTotal({ query: { queryKey: getGetRankingTotalQueryKey(), staleTime: 60_000, enabled: isAll } });

  // Só abre a análise de quem está no ranking do ciclo. Fora do ciclo, inativo
  // ou sem nota: nada de detalhe, relatório ou linha do tempo (o /ranking-detail
  // não filtra; a tela não depende do servidor recusar).
  const inRanking = employeeId != null && ranking.isSuccess && (ranking.data ?? []).some(r => r.employeeId === employeeId);
  const outOfRanking = employeeId != null && ranking.isSuccess && !inRanking;

  const report = useGetAnalyticsEventsReport(p, { query: { queryKey: getGetAnalyticsEventsReportQueryKey(p), staleTime: 60_000, enabled: inRanking && !isAll } });
  const detailParams = p ? { employeeId: employeeId ?? 0, ...p } : { employeeId: employeeId ?? 0 };
  const detail = useGetRankingDetail(detailParams, { query: { queryKey: getGetRankingDetailQueryKey(detailParams), enabled: inRanking && !isAll, retry: false } });
  const detailNotFound = detail.error instanceof ApiError && detail.error.status === 404;

  const faixas = useMemo(() => activeFaixas(rules.data), [rules.data]);
  const rows = useMemo(() => ranking.data ?? [], [ranking.data]);
  const ordered = useMemo(() => [...rows].sort((a, b) => b.finalResult - a.finalResult || a.employeeName.localeCompare(b.employeeName, "pt-BR")), [rows]);
  // Mínimo de eventos do bônus: o do CICLO EXIBIDO (o do seletor — num ciclo
  // anterior, nunca o do atual); sem ele, o da visão geral desse ciclo. Nunca 0
  // por falha — sem nenhum dos dois, fica desconhecido (null).
  const minEvents = isAll ? null
    : scope.cycle?.effectiveMinEvents ?? scope.cycle?.minEvents
      ?? (overview.data ? (overview.data.ruleSet?.minEvents ?? overview.data.kpis?.minEvents ?? null) : null);
  const cycle = overview.data?.cycle;
  const period = cycle?.startDate && cycle?.endDate ? `${fmtDay(cycle.startDate)} a ${fmtDay(cycle.endDate)}` : null;

  // Anterior/próximo seguem a ordem da lista; a POSIÇÃO exibida é a do ranking (empate divide).
  const idx = employeeId != null ? ordered.findIndex(r => r.employeeId === employeeId) : -1;
  const prev = idx > 0 ? ordered[idx - 1] : null;
  const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;
  const rank = employeeId != null ? rankOf(rows, employeeId) : null;

  const loadingBase = isAll ? total.isLoading : (ranking.isLoading || rules.isLoading || overview.isLoading);
  const baseError = isAll ? total.isError : (ranking.isError || rules.isError);
  const totalRows = total.data?.rows ?? [];
  const totalRow = employeeId != null ? (totalRows.find(r => r.employeeId === employeeId) ?? null) : null;
  const pickerOptions = isAll
    ? totalRows.map(r => ({ id: r.employeeId, label: r.employeeName, hint: n1(r.avgFinalResult), color: r.latest.platoonColor ?? null }))
    : ordered.map(r => ({ id: r.employeeId, label: r.employeeName, hint: n1(r.finalResult), color: r.platoonColor ?? null }));

  return (
    <div className="px-4 md:px-6 py-6 space-y-5 max-w-[1440px] mx-auto" style={{ fontFamily: BODY }}>
      <PageHeader
        eyebrow={isAll ? "Total geral · todos os ciclos" : cycle ? `${cycle.name}${period ? ` · ${period}` : ""}` : scope.label}
        title="Análises"
        description={isAll
          ? "Todos os ciclos somados, por pessoa: ciclos com nota, média final ponderada pelos eventos, eventos e bônus (oficial e projetado). A análise completa de cada ciclo abre a partir do histórico da pessoa."
          : employeeId
            ? "Análise do ciclo de um colaborador: a conta da nota, o que as penalidades custaram na nota, na faixa e no bônus, a nota de cada evento, os critérios e a comparação com a equipe."
            : "Uma análise por participante: escolha um colaborador ou clique numa linha para ver o ciclo dele em detalhe. Não mostra quem avaliou."}
        actions={<CycleSelect scope={scope} />}
      />
      <AnalyticsTabs current="colaborador" />
      <CycleScopeNotice scope={scope} allHelp={<>Uma linha por pessoa somando <strong>todos os ciclos</strong>: média final ponderada pelos eventos com nota, eventos com nota e bônus — o oficial (ciclos fechados) separado do projetado (ciclo aberto). Não existe faixa do total (aparece a do ciclo mais recente) nem conta de nota do total: ela é sempre de um ciclo.</>} />

      {/* ── Filtro ── */}
      <section aria-label="Escolher colaborador" className="rounded-xl p-3 sm:p-4 flex flex-wrap items-end gap-3" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="w-full sm:w-[380px] min-w-0">
          <label htmlFor="ap-colaborador" className="block mb-1 text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>Colaborador</label>
          <SearchPicker id="ap-colaborador" value={employeeId} onChange={pick}
            placeholder={loadingBase ? "Carregando…" : outOfRanking ? "Escolha um colaborador do ranking" : "Toda a equipe"} emptyText="Ninguém com esse nome." allLabel="Toda a equipe"
            options={pickerOptions} />
        </div>
        {employeeId != null && isAll && (
          <Button variant="outline" className="h-10" onClick={() => pick(null)} data-testid="button-person-team">
            <Users size={15} className="mr-1.5" aria-hidden /> Toda a equipe
          </Button>
        )}
        {employeeId != null && !isAll && !outOfRanking && (
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
            {canTimeline && !scope.readOnly && detail.data && (
              <Button asChild variant="outline" className="h-10">
                <Link href={`/linha-do-tempo?colaborador=${employeeId}`} data-testid="button-person-timeline">
                  <History size={15} className="mr-1.5" aria-hidden /> Ver linha do tempo
                </Link>
              </Button>
            )}
          </div>
        )}
        {rank && !isAll && (
          <p className="text-[12px] tabular-nums sm:ml-auto self-center" style={{ color: "var(--muted-foreground)" }} data-testid="text-person-rank">
            {rank.position}º de {rank.total} no ranking
          </p>
        )}
      </section>

      {!isAll && overview.isError && !loadingBase && !baseError && (
        <div role="alert" className="rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]" style={{ backgroundColor: "var(--status-warn-bg)", border: "1px solid var(--border)" }}>
          <AlertTriangle size={16} aria-hidden className="shrink-0" style={{ color: "var(--status-warn-text)" }} />
          <p className="flex-1 min-w-[220px]">Não foi possível carregar as regras do ciclo: o mínimo de eventos do bônus e as médias do ciclo ficam sem valor até carregar.</p>
          <Button variant="outline" size="sm" onClick={() => void overview.refetch()}>Tentar de novo</Button>
        </div>
      )}

      {loadingBase ? (
        <LoadingState lines={8} withHeader label="Carregando a análise" />
      ) : baseError ? (
        <EmptyState icon={AlertTriangle} title="Não foi possível carregar a análise" description="Tente novamente em instantes."
          action={<Button variant="outline" onClick={() => { if (isAll) void total.refetch(); else { void ranking.refetch(); void rules.refetch(); } }}>Tentar de novo</Button>} />
      ) : isAll ? (
        employeeId == null
          ? <TotalTeamView rows={totalRows} onPick={pick} />
          : <TotalPersonView row={totalRow} onOpenCycle={openCycle} onBack={() => pick(null)} />
      ) : employeeId == null ? (
        <TeamView rows={rows} faixas={faixas} minEvents={minEvents} onPick={pick} readOnly={scope.readOnly} />
      ) : outOfRanking ? (
        <EmptyState icon={UserMinus} title="Fora do ranking deste ciclo" data-testid="person-out-of-ranking"
          description={scope.readOnly
            ? "Este colaborador não tem análise neste ciclo: não teve nota nele ou foi retirado do ciclo pelo administrador. Escolha outra pessoa ou volte para a equipe."
            : "Este colaborador não tem análise no ciclo atual: ainda não tem nota no ciclo, foi retirado do ciclo pelo administrador ou está com o cadastro inativo. Escolha outra pessoa ou volte para a equipe."}
          action={<Button variant="outline" onClick={() => pick(null)}><Users size={15} className="mr-1.5" aria-hidden /> Ver toda a equipe</Button>} />
      ) : detail.isLoading ? (
        <LoadingState lines={10} withHeader label="Montando a análise do colaborador" />
      ) : detailNotFound ? (
        <EmptyState icon={UserX} title="Colaborador não encontrado" description="O cadastro dele não foi encontrado. Escolha outra pessoa ou volte para a equipe."
          action={<Button variant="outline" onClick={() => pick(null)}>Ver toda a equipe</Button>} />
      ) : detail.isError || !detail.data ? (
        <EmptyState icon={AlertTriangle} title="Não foi possível carregar a análise do colaborador" description="Houve uma falha ao buscar os dados dele. Tente de novo em instantes."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => void detail.refetch()}>Tentar de novo</Button>
              <Button variant="ghost" onClick={() => pick(null)}>Ver toda a equipe</Button>
            </div>
          } />
      ) : (
        <PersonView detail={detail.data} rows={rows} faixas={faixas} minEvents={minEvents}
          teamEventAvg={overview.data?.kpis.avgEventScore ?? null}
          report={report.data} reportLoading={report.isLoading} reportError={report.isError} onRetryReport={() => void report.refetch()}
          canTimeline={canTimeline} onPick={pick} cycleId={pastCycleId} />
      )}
    </div>
  );
}
