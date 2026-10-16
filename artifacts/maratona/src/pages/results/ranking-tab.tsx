import { Fragment, useMemo, useState } from "react";
import { useGetRanking, getGetRankingQueryKey, exportRanking, type RankingEntry } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { ChevronRight, Download, SearchX, Trophy, UserX, X } from "lucide-react";
import { cn, faixaEdge, plural } from "@/lib/utils";
import { fmtScore, fmtBRLShort } from "./helpers";
import { FaixaBadge, fmtBound } from "./badges";
import { MEDAL, PodiumStage } from "./podium-stage";
import { EmployeeDetailSheet } from "./employee-detail-sheet";
import { Bone, Chip, EligibilityFilter, EmptyBlock, ErrorBlock, FOCUS_RING, ListSkeleton, SearchField, btnSmall, surfaceCls, type EligFilter } from "./results-ui";

export function RankingTab({ canViewDetail, cycleId, readOnly = false, minEvents, cycleClosed = false }: {
  canViewDetail: boolean;
  /** Ciclo escolhido no seletor (undefined = atual, mesma chave de cache de sempre). */
  cycleId?: string;
  readOnly?: boolean;
  /** Mínimo de eventos do ciclo para o bônus (texto do filtro "Elegíveis"). */
  minEvents?: number | null;
  /** Ciclo fechado: o bônus é OFICIAL; aberto, é PROJETADO (muda até o fechamento). */
  cycleClosed?: boolean;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterEligible, setFilterEligible] = useState<EligFilter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Busca filtra no cliente: a lista tem dezenas de linhas e ir ao servidor a
  // cada tecla gerava uma requisição (e uma entrada de cache) por caractere.
  const params = cycleId ? { cycleId } : undefined;
  const qKey = getGetRankingQueryKey(params);
  const { data: rankingAll, isLoading, isError, refetch } = useGetRanking(params, { query: { queryKey: qKey } });
  const ranking = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!rankingAll) return rankingAll;
    if (!term) return rankingAll;
    return rankingAll.filter(r => (r.employeeName ?? "").toLowerCase().includes(term));
  }, [rankingAll, search]);

  async function handleExport() {
    try {
      const data = await exportRanking(params);
      const blob = new Blob([data.data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = data.filename;
      a.click(); URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    }
  }

  const allResults = ranking ?? [];
  const filteredRanking = allResults.filter(r => {
    if (filterEligible === "eligible" && r.eligible === false) return false;
    if (filterEligible === "ineligible" && r.eligible !== false) return false;
    return true;
  });
  const counts = { all: allResults.length, eligible: allResults.filter(r => r.eligible !== false).length, ineligible: allResults.filter(r => r.eligible === false).length };
  // Pódio: os 3 primeiros do ciclo (sem busca), no filtro de elegibilidade escolhido.
  const top3 = (rankingAll ?? []).filter(r => filterEligible === "eligible" ? r.eligible !== false : filterEligible === "ineligible" ? r.eligible === false : true).slice(0, 3);
  const bonusLabel = cycleClosed ? "Bônus oficial" : "Bônus projetado";

  function openDetail(id: number) {
    if (!canViewDetail) return;
    setSelectedId(id);
  }

  if (isLoading) return <ListSkeleton label="Carregando ranking" rows={6} />;
  if (isError) return <ErrorBlock title="Não foi possível carregar o ranking" onRetry={() => { void refetch(); }} />;
  if (!rankingAll || rankingAll.length === 0) {
    return (
      <div className={cn(surfaceCls, "border-dashed")}>
        <EmptyBlock icon={Trophy} title="Ranking ainda vazio" testId="ranking-empty">
          {readOnly ? "Nenhum resultado consolidado neste ciclo." : "Nenhum resultado consolidado para o ciclo atual. Feche o ciclo, no topo, para gerar o ranking oficial."}
        </EmptyBlock>
      </div>
    );
  }

  const clear = () => { setSearch(""); setFilterEligible("all"); };

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
        <SearchField value={search} onChange={setSearch} label="Buscar colaborador no ranking" testId="input-search-ranking" className="lg:w-72" />
        <EligibilityFilter value={filterEligible} onChange={setFilterEligible} counts={counts} className="w-full lg:w-auto" />
        <button type="button" data-testid="button-export-ranking" onClick={handleExport} className={cn(btnSmall, "lg:ml-auto self-start lg:self-auto")}>
          <Download size={15} aria-hidden /> Exportar CSV
        </button>
      </div>

      <div className={cn("grid grid-cols-1 gap-4 items-start", top3.length > 0 && !search.trim() && "xl:grid-cols-[minmax(0,1fr)_300px]")}>
        <div className="min-w-0 space-y-3">
          {top3.length > 0 && !search.trim() && <PodiumStage className="hidden md:block xl:hidden" top3={top3} canViewDetail={canViewDetail} onSelect={openDetail} />}

          {filteredRanking.length === 0 ? (
            <div className={surfaceCls}>
              {filterEligible === "eligible" && !search.trim() ? (
                <EmptyBlock icon={UserX} title="Ninguém elegível ainda" testId="ranking-no-eligible"
                  action={<button type="button" className={btnSmall} onClick={() => setFilterEligible("all")}>Ver todos</button>}>
                  {/* Mínimo do ciclo EXIBIDO (effectiveMinEvents) — sem número fixo; espera o ciclo carregar. */}
                  {minEvents != null
                    ? <>São necessários pelo menos {plural(minEvents, "evento")} no ciclo. </>
                    : <Bone className="inline-block h-3 w-48 align-middle mr-1" />}
                  Use <strong>Todos</strong> para ver o ranking parcial.
                </EmptyBlock>
              ) : (
                <EmptyBlock icon={SearchX} title="Ninguém encontrado" testId="ranking-no-results"
                  action={<button type="button" className={btnSmall} onClick={clear}><X size={14} aria-hidden /> Limpar filtros</button>}>
                  Nenhum colaborador bate com a busca e o filtro escolhidos.
                </EmptyBlock>
              )}
            </div>
          ) : (
            <section aria-label="Classificação geral" className={cn(surfaceCls, "overflow-hidden")}>
              <div aria-hidden className="hidden md:grid grid-cols-[48px_minmax(0,1fr)_200px_150px_20px] items-center gap-4 px-4 lg:px-5 py-2.5 border-b border-border bg-secondary/60 font-condensed text-[12px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                <span className="text-center">Pos.</span><span>Colaborador</span><span>Nota final</span><span className="text-right">Bônus</span><span />
              </div>
              <ol>
                {filteredRanking.map((entry, i) => {
                  const prev = filteredRanking[i - 1];
                  const newFaixa = !prev || (prev.platoon ?? "") !== (entry.platoon ?? "");
                  return (
                    <Fragment key={entry.employeeId}>
                      {newFaixa && <FaixaDivider entry={entry} count={filteredRanking.filter(r => (r.platoon ?? "") === (entry.platoon ?? "")).length} first={i === 0} />}
                      <RankingRow entry={entry} canViewDetail={canViewDetail} onOpen={openDetail} bonusLabel={bonusLabel} cycleClosed={cycleClosed} />
                    </Fragment>
                  );
                })}
              </ol>
            </section>
          )}
          {canViewDetail && filteredRanking.length > 0 && (
            <p className="px-1 text-[12.5px] text-muted-foreground">Clique em um colaborador para ver a ficha: provas, penalidades, méritos e a conta do bônus.</p>
          )}
        </div>

        {top3.length > 0 && !search.trim() && (
          <aside className="hidden xl:block xl:sticky xl:top-[84px]">
            <PodiumStage top3={top3} canViewDetail={canViewDetail} onSelect={openDetail} />
          </aside>
        )}
      </div>

      <EmployeeDetailSheet employeeId={selectedId} onClose={() => setSelectedId(null)} cycleId={cycleId} readOnly={readOnly} />
    </div>
  );
}

/** Divisória de faixa dentro do ranking: a média define a faixa, então a ordem já agrupa. */
function FaixaDivider({ entry, count, first }: { entry: RankingEntry; count: number; first: boolean }) {
  const range = entry.platoonMinScore != null && entry.platoonMaxScore != null ? `${fmtBound(entry.platoonMinScore)}–${fmtBound(entry.platoonMaxScore)}` : null;
  return (
    <li aria-hidden className={cn("flex items-center gap-2.5 px-4 lg:px-5 py-1.5 bg-secondary/40", !first && "border-t border-border")}>
      <span className="w-1 h-4 rounded-full" style={{ backgroundColor: entry.platoonColor ?? "var(--border)", ...faixaEdge(entry.platoonColor) }} />
      <span className="font-condensed text-[12.5px] font-bold uppercase tracking-[0.06em] text-foreground">{entry.platoon ?? "Sem faixa"}</span>
      {range && <span className="text-[12px] text-muted-foreground tabular-nums">{range}</span>}
      <span className="ml-auto text-[12px] text-muted-foreground">{plural(count, "pessoa", "pessoas")}</span>
    </li>
  );
}

function RankingRow({ entry, canViewDetail, onOpen, bonusLabel, cycleClosed }: {
  entry: RankingEntry; canViewDetail: boolean; onOpen: (id: number) => void; bonusLabel: string; cycleClosed: boolean;
}) {
  const pos = entry.position;
  const medal = pos >= 1 && pos <= 3 ? MEDAL[pos as 1 | 2 | 3] : null;
  const scorePct = Math.max(0, Math.min(100, entry.finalResult));
  return (
    <li className="border-t border-border first:border-t-0">
      <button
        type="button"
        data-testid={`card-ranking-${entry.employeeId}`}
        onClick={() => onOpen(entry.employeeId)}
        className={cn(
          "group w-full text-left grid grid-cols-[40px_minmax(0,1fr)_auto] md:grid-cols-[48px_minmax(0,1fr)_200px_150px_20px] items-center gap-x-3 md:gap-x-4 gap-y-2 px-4 lg:px-5 py-3",
          "transition-colors duration-150", canViewDetail ? "hover:bg-secondary/40 cursor-pointer" : "cursor-default", FOCUS_RING, "focus-visible:ring-inset focus-visible:ring-offset-0",
        )}
      >
        <span className="row-span-2 md:row-span-1 flex justify-center">
          <span className={cn("w-10 h-10 rounded-lg flex items-center justify-center font-condensed text-[19px] font-black tabular-nums", medal ? "text-foreground" : "bg-secondary text-muted-foreground")}
            style={medal ? { backgroundColor: medal.tint, boxShadow: `inset 0 0 0 2px ${medal.ring}` } : undefined}
            title={medal ? `${pos}º lugar · ${medal.label}` : `${pos}º lugar`}>
            {pos}
          </span>
        </span>

        <span className="min-w-0">
          <span className="block font-condensed text-[17px] font-bold uppercase tracking-[0.02em] leading-tight truncate group-hover:underline underline-offset-2" data-testid={`text-employee-name-${entry.employeeId}`}>{entry.employeeName}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-[12.5px] text-muted-foreground mr-0.5">{plural(entry.eventsCount, "evento", "eventos")}</span>
            {entry.eligible === false && <Chip tone="danger">Inelegível</Chip>}
            {entry.absences > 0 && <Chip tone="danger">{plural(entry.absences, "penalidade", "penalidades")}</Chip>}
            <FaixaBadge name={entry.platoon} minScore={entry.platoonMinScore} maxScore={entry.platoonMaxScore} color={entry.platoonColor} compact />
          </span>
        </span>

        <span className="col-start-3 row-start-1 md:col-start-auto md:row-start-auto flex items-center gap-3 justify-end md:justify-start">
          <span className="hidden md:block flex-1 h-1.5 rounded-full bg-secondary overflow-hidden" aria-hidden>
            <span className="block h-full rounded-full bg-[var(--status-ok)] transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${scorePct}%` }} />
          </span>
          <span className="text-right">
            <span className="block font-condensed text-[26px] font-black leading-none tabular-nums" data-testid={`text-final-result-${entry.employeeId}`}>{fmtScore(entry.finalResult)}</span>
            <span className="md:hidden font-condensed text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Nota final</span>
          </span>
        </span>

        <span className="col-start-2 col-span-2 md:col-span-1 md:col-start-auto text-left md:text-right min-w-0">
          {entry.bonusValue > 0 ? (
            <span className="inline-flex md:flex md:flex-col items-baseline md:items-end gap-1.5 md:gap-0.5" title={cycleClosed ? "Bônus oficial, apurado no fechamento do ciclo" : "Bônus projetado: o ciclo está aberto e o valor muda até o fechamento"}>
              <span className="font-condensed text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground whitespace-nowrap" data-testid={`ranking-bonus-label-${entry.employeeId}`}>{bonusLabel}</span>
              <span className="font-condensed text-[18px] font-black leading-none tabular-nums whitespace-nowrap">{fmtBRLShort(entry.bonusValue)}</span>
            </span>
          ) : (
            <span className="hidden md:inline text-[13px] text-muted-foreground">—</span>
          )}
        </span>

        {canViewDetail && <ChevronRight size={16} aria-hidden className="hidden md:block text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />}
      </button>
    </li>
  );
}
