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
import { AlertTriangle, ChevronLeft, ChevronRight, History, RotateCw, Trophy, UserMinus, UserX, Users } from "lucide-react";
import { EmptyBlock, iconBtn } from "../results/results-ui";
import { Chip, btnSecondary, btnSmall, surfaceCls } from "../dashboard/dashboard-ui";
import { BODY } from "@/lib/premium-theme";
import { cn } from "@/lib/utils";
import { useAuth, hasRole } from "@/lib/auth-context";
import { AnalyticsError, AnalyticsSkeleton, AnalyticsTopBar, analyticsBody } from "../analytics-team/analytics-tabs";
import { activeFaixas, n1, rankOf } from "./derive";
import { SearchPicker } from "./ui";
import { TeamView } from "./team-view";
import { PersonView } from "./person-view";
import { TotalTeamView, TotalPersonView } from "./total-view";
import { CycleScopeNotice, useCycleScope } from "@/components/cycle-select";


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

  const teamBtn = (
    <button type="button" onClick={() => pick(null)} data-testid="button-person-team" className={btnSmall}>
      <Users size={15} aria-hidden /> Toda a equipe
    </button>
  );

  return (
    <div className="min-h-full flex flex-col min-w-0" style={{ fontFamily: BODY }}>
      <AnalyticsTopBar scope={scope} current="colaborador" />
      <div className={analyticsBody}>
        <CycleScopeNotice scope={scope} allHelp={<>Uma linha por pessoa somando <strong>todos os ciclos</strong>: média final ponderada pelos eventos com nota, eventos com nota e bônus — o oficial (ciclos fechados) separado do projetado (ciclo aberto). Não existe faixa do total (aparece a do ciclo mais recente) nem conta de nota do total: ela é sempre de um ciclo.</>} />

        {/* ── Escolher colaborador (barra de ferramentas da aba) ── */}
        <section aria-label="Escolher colaborador" className={cn(surfaceCls, "px-4 py-3 lg:px-5 flex flex-wrap items-end gap-x-3 gap-y-3")}>
          <div className="w-full sm:w-[360px] min-w-0">
            <label htmlFor="ap-colaborador" className="block mb-1.5 font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Colaborador</label>
            <SearchPicker id="ap-colaborador" value={employeeId} onChange={pick}
              placeholder={loadingBase ? "Carregando…" : outOfRanking ? "Escolha um colaborador do ranking" : "Toda a equipe"} emptyText="Ninguém com esse nome." allLabel="Toda a equipe"
              options={pickerOptions} />
          </div>
          {employeeId != null && isAll && teamBtn}
          {employeeId != null && !isAll && !outOfRanking && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1" role="group" aria-label="Navegar pelo ranking">
                <button type="button" className={cn(iconBtn, "disabled:opacity-40 disabled:cursor-not-allowed")} disabled={!prev} onClick={() => prev && pick(prev.employeeId)}
                  aria-label={prev ? `Anterior no ranking: ${prev.employeeName}` : "Sem anterior no ranking"} title={prev ? `Anterior: ${prev.employeeName}` : undefined} data-testid="button-person-prev">
                  <ChevronLeft size={18} aria-hidden />
                </button>
                <button type="button" className={cn(iconBtn, "disabled:opacity-40 disabled:cursor-not-allowed")} disabled={!next} onClick={() => next && pick(next.employeeId)}
                  aria-label={next ? `Próximo no ranking: ${next.employeeName}` : "Sem próximo no ranking"} title={next ? `Próximo: ${next.employeeName}` : undefined} data-testid="button-person-next">
                  <ChevronRight size={18} aria-hidden />
                </button>
              </div>
              {teamBtn}
              {canTimeline && !scope.readOnly && detail.data && (
                <Link href={`/linha-do-tempo?colaborador=${employeeId}`} data-testid="button-person-timeline" className={btnSmall}>
                  <History size={15} aria-hidden /> Linha do tempo
                </Link>
              )}
            </div>
          )}
          {rank && !isAll && (
            <span className="sm:ml-auto self-center" data-testid="text-person-rank">
              <Chip icon={Trophy}>{rank.position}º de {rank.total} no ranking</Chip>
            </span>
          )}
        </section>

        {!isAll && overview.isError && !loadingBase && !baseError && (
          <div role="alert" className="rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13.5px] bg-[var(--status-warn-bg)]">
            <AlertTriangle size={16} aria-hidden className="shrink-0 text-[var(--status-warn-text)]" />
            <p className="flex-1 min-w-[220px]">Não foi possível carregar as regras do ciclo: o mínimo de eventos do bônus e as médias do ciclo ficam sem valor até carregar.</p>
            <button type="button" className={btnSmall} onClick={() => void overview.refetch()}><RotateCw size={14} aria-hidden /> Tentar de novo</button>
          </div>
        )}

        {loadingBase ? (
          <AnalyticsSkeleton label="Carregando a análise" cells={6} />
        ) : baseError ? (
          <AnalyticsError title="Não foi possível carregar a análise" scope={scope}
            onRetry={() => { if (isAll) void total.refetch(); else { void ranking.refetch(); void rules.refetch(); } }} />
        ) : isAll ? (
          employeeId == null
            ? <TotalTeamView rows={totalRows} onPick={pick} />
            : <TotalPersonView row={totalRow} onOpenCycle={openCycle} onBack={() => pick(null)} />
        ) : employeeId == null ? (
          <TeamView rows={rows} faixas={faixas} minEvents={minEvents} onPick={pick} readOnly={scope.readOnly} />
        ) : outOfRanking ? (
          <EmptyBlock icon={UserMinus} title="Fora do ranking deste ciclo" testId="person-out-of-ranking" className={surfaceCls}
            action={<button type="button" onClick={() => pick(null)} className={btnSecondary}><Users size={15} aria-hidden /> Ver toda a equipe</button>}>
            {scope.readOnly
              ? "Este colaborador não tem análise neste ciclo: não teve nota nele ou foi retirado do ciclo pelo administrador. Escolha outra pessoa ou volte para a equipe."
              : "Este colaborador não tem análise no ciclo atual: ainda não tem nota no ciclo, foi retirado do ciclo pelo administrador ou está com o cadastro inativo. Escolha outra pessoa ou volte para a equipe."}
          </EmptyBlock>
        ) : detail.isLoading ? (
          <AnalyticsSkeleton label="Montando a análise do colaborador" cells={6} />
        ) : detailNotFound ? (
          <EmptyBlock icon={UserX} title="Colaborador não encontrado" className={surfaceCls}
            action={<button type="button" onClick={() => pick(null)} className={btnSecondary}>Ver toda a equipe</button>}>
            O cadastro dele não foi encontrado. Escolha outra pessoa ou volte para a equipe.
          </EmptyBlock>
        ) : detail.isError || !detail.data ? (
          <AnalyticsError title="Não foi possível carregar a análise do colaborador" detail="Houve uma falha ao buscar os dados dele. Tente de novo em instantes."
            onRetry={() => void detail.refetch()} />
        ) : (
          <PersonView detail={detail.data} rows={rows} faixas={faixas} minEvents={minEvents}
            teamEventAvg={overview.data?.kpis.avgEventScore ?? null}
            report={report.data} reportLoading={report.isLoading} reportError={report.isError} onRetryReport={() => void report.refetch()}
            canTimeline={canTimeline} onPick={pick} cycleId={pastCycleId} />
        )}
      </div>
    </div>
  );
}
