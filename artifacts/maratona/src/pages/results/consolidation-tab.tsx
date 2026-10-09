import { useState } from "react";
import { useGetQuarterlyResults, getGetQuarterlyResultsQueryKey, exportQuarterlyResults } from "@workspace/api-client-react";
import type { QuarterlyResult } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { ChevronRight, Download, SearchX, Table2, X } from "lucide-react";
import { cn, fmtNum, plural } from "@/lib/utils";
import { useSort, fmtScore, type SortDir } from "./helpers";
import { SortIcon, FaixaBadge } from "./badges";
import { PlatoonDistributionPanel } from "./platoon-distribution-panel";
import { EmployeeDetailSheet } from "./employee-detail-sheet";
import { EligibilityFilter, EmptyBlock, ErrorBlock, FOCUS_RING, ListSkeleton, SearchField, btnSmall, surfaceCls, type EligFilter } from "./results-ui";

/** Saldo de penalidades e méritos em pontos, com sinal e vírgula ("−50", "+2,5"). */
function NetPoints({ r }: { r: QuarterlyResult }) {
  const net = Math.round(((r.meritPoints ?? 0) - (r.absencePenalty ?? 0)) * 10) / 10;
  if (!net) return <span className="text-muted-foreground">—</span>;
  const abs = fmtNum(Math.abs(net), Number.isInteger(net) ? 0 : 1);
  return net < 0
    ? <span className="font-condensed text-[17px] font-bold tabular-nums text-[var(--status-danger-text)]">−{abs}</span>
    : <span className="font-condensed text-[17px] font-bold tabular-nums text-[var(--status-ok-text)]">+{abs}</span>;
}

export function ConsolidationTab({ isManager, cycleId, readOnly = false, cycleClosed = false }: { isManager: boolean; cycleId?: string; readOnly?: boolean; /** Ciclo fechado: bônus OFICIAL; aberto, PROJETADO. */ cycleClosed?: boolean }) {
  const { toast } = useToast();
  const params = cycleId ? { cycleId } : undefined;
  const { data: results, isLoading, isError, refetch } = useGetQuarterlyResults(params, {
    query: { queryKey: getGetQuarterlyResultsQueryKey(params) },
  });
  const rows = results ?? [];
  const [search, setSearch] = useState("");
  const [filterEligible, setFilterEligible] = useState<EligFilter>("all");
  const [sortKey, setSortKey] = useState<keyof QuarterlyResult | null>("finalResult");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const eligibleFilteredRows = rows.filter(r => {
    if (filterEligible === "eligible") return r.eligible !== false;
    if (filterEligible === "ineligible") return r.eligible === false;
    return true;
  });
  const term = search.toLowerCase();
  const filteredRows = eligibleFilteredRows.filter(r => !search || (r.employeeName ?? "").toLowerCase().includes(term));
  const searched = rows.filter(r => !search || (r.employeeName ?? "").toLowerCase().includes(term));
  const counts = { all: searched.length, eligible: searched.filter(r => r.eligible !== false).length, ineligible: searched.filter(r => r.eligible === false).length };

  function handleSort(key: keyof QuarterlyResult) {
    if (sortKey === key) {
      setSortDir(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sortedRows = useSort(filteredRows, sortKey, sortDir);

  async function handleExport() {
    try {
      const data = await exportQuarterlyResults(params);
      const blob = new Blob([data.data], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = data.filename;
      a.click();
    } catch {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    }
  }

  const cols = "grid-cols-[minmax(200px,1.8fr)_repeat(4,minmax(0,1fr))_minmax(0,1.1fr)_minmax(0,1.3fr)]";
  const head = (label: string, key: keyof QuarterlyResult, align: "left" | "right" = "right", title?: string) => (
    <div role="columnheader" aria-sort={sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none"} title={title}
      className={cn("px-3 py-2.5", align === "right" && "text-right")}>
      <button type="button" onClick={() => handleSort(key)}
        className={cn("font-condensed inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-bold uppercase tracking-[0.06em] rounded-sm transition-colors duration-150", sortKey === key ? "text-foreground" : "text-muted-foreground hover:text-foreground", FOCUS_RING)}>
        {label}<SortIcon active={sortKey === key} dir={sortDir} />
      </button>
    </div>
  );

  if (isLoading) return <ListSkeleton label="Carregando consolidação" />;
  if (isError) return <ErrorBlock title="Não foi possível carregar a consolidação" onRetry={() => { void refetch(); }} />;
  if (rows.length === 0) {
    return (
      <div className={cn(surfaceCls, "border-dashed")}>
        <EmptyBlock icon={Table2} title="Nenhum dado consolidado" testId="consolidation-empty">
          {readOnly ? "Não há resultado gerado neste ciclo." : "Não há resultado gerado para o ciclo atual."}
        </EmptyBlock>
      </div>
    );
  }

  const clear = () => { setSearch(""); setFilterEligible("all"); };

  return (
    <div className="space-y-4">
      <PlatoonDistributionPanel rows={eligibleFilteredRows} cycleClosed={cycleClosed} />

      <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
        <SearchField value={search} onChange={setSearch} label="Buscar colaborador na consolidação" testId="input-search-consolidation" className="lg:w-72" />
        <EligibilityFilter value={filterEligible} onChange={setFilterEligible} counts={counts} className="w-full lg:w-auto" />
        {isManager && (
          <button type="button" data-testid="button-export-consolidation" onClick={handleExport} className={cn(btnSmall, "lg:ml-auto self-start lg:self-auto")}>
            <Download size={15} aria-hidden /> Exportar CSV
          </button>
        )}
      </div>

      {sortedRows.length === 0 ? (
        <div className={surfaceCls}>
          <EmptyBlock icon={SearchX} title="Ninguém encontrado" testId="consolidation-no-results"
            action={<button type="button" className={btnSmall} onClick={clear}><X size={14} aria-hidden /> Limpar filtros</button>}>
            Nenhum colaborador bate com a busca e o filtro escolhidos.
          </EmptyBlock>
        </div>
      ) : (
        <>
          {/* Celular/tablet: um cartão por pessoa. */}
          <ul className="grid gap-2.5 md:grid-cols-2 lg:hidden" aria-label="Consolidação por colaborador">
            {sortedRows.map(r => (
              <li key={r.employeeId}>
                <button type="button" onClick={() => setSelectedId(r.employeeId)} data-testid={`card-consolidation-${r.employeeId}`}
                  className={cn(surfaceCls, "w-full p-4 text-left transition-colors duration-150 hover:bg-secondary/40", FOCUS_RING)}>
                  <span className="flex items-start gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block font-condensed text-[17px] font-bold uppercase leading-tight break-words">{r.employeeName}</span>
                      <span className="mt-1.5 block"><FaixaBadge name={r.platoon} minScore={r.platoonMinScore} maxScore={r.platoonMaxScore} color={r.platoonColor} compact /></span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block font-condensed text-[26px] font-black leading-none tabular-nums">{fmtScore(r.finalResult)}</span>
                      <span className="font-condensed text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Média final</span>
                    </span>
                    <ChevronRight size={16} aria-hidden className="mt-1 shrink-0 text-muted-foreground" />
                  </span>
                  <dl className="mt-3 pt-3 border-t border-border/70 grid grid-cols-4 gap-2 text-center">
                    {([["Soma", fmtScore(r.scoreSum ?? 0)], ["C/ nota", r.eventsCount ?? 0], ["Particip.", r.participatedEventsCount ?? 0]] as const).map(([k, v]) => (
                      <div key={k}><dt className="font-condensed text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">{k}</dt><dd className="font-condensed text-[17px] font-bold tabular-nums">{v}</dd></div>
                    ))}
                    <div><dt className="font-condensed text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">Pen./Mér.</dt><dd><NetPoints r={r} /></dd></div>
                  </dl>
                </button>
              </li>
            ))}
          </ul>

          <div className={cn(surfaceCls, "hidden lg:block overflow-hidden")}>
            <div role="table" aria-label="Planilha de consolidação">
              <div role="row" className={cn("grid items-center bg-secondary/60 border-b border-border", cols)}>
                {head("Colaborador", "employeeName", "left")}
                {head("Soma das notas", "scoreSum")}
                {head("Eventos c/ nota", "eventsCount")}
                {head("Participados", "participatedEventsCount", "right", "Eventos de que participou (inclui os que não entram na nota)")}
                {head("Pen. / Mér.", "absencePenalty", "right", "Saldo em pontos: méritos menos penalidades")}
                {head("Média final", "finalResult")}
                {head("Faixa", "platoon", "left")}
              </div>
              {sortedRows.map(r => {
                const moreParticipated = (r.participatedEventsCount ?? 0) > (r.eventsCount ?? 0);
                return (
                  <div
                    key={r.employeeId}
                    role="row"
                    data-testid={`row-consolidation-${r.employeeId}`}
                    className={cn("group grid items-center border-b border-border last:border-b-0 cursor-pointer transition-colors duration-150 hover:bg-secondary/40", cols)}
                    onClick={() => setSelectedId(r.employeeId)}
                  >
                    <div role="cell" className="px-3 py-3 min-w-0">
                      <button type="button" onClick={e => { e.stopPropagation(); setSelectedId(r.employeeId); }} aria-label={`Ver ficha de ${r.employeeName}`}
                        className={cn("block max-w-full text-left font-condensed text-[16px] font-bold uppercase tracking-[0.02em] leading-tight truncate rounded-sm group-hover:underline underline-offset-2", FOCUS_RING)}>
                        {r.employeeName}
                      </button>
                    </div>
                    <div role="cell" className="px-3 py-3 text-right font-condensed text-[17px] font-bold tabular-nums">{fmtScore(r.scoreSum ?? 0)}</div>
                    <div role="cell" className="px-3 py-3 text-right font-condensed text-[17px] font-bold tabular-nums">{r.eventsCount ?? 0}</div>
                    <div role="cell" className={cn("px-3 py-3 text-right font-condensed text-[17px] font-bold tabular-nums", moreParticipated && "text-[var(--status-warn-text)]")}
                      title={moreParticipated ? "Participou em mais eventos do que os que entraram na nota" : undefined}>
                      {r.participatedEventsCount ?? 0}
                    </div>
                    <div role="cell" className="px-3 py-3 text-right"><NetPoints r={r} /></div>
                    <div role="cell" className="px-3 py-3 text-right font-condensed text-[24px] font-black leading-none tabular-nums">{fmtScore(r.finalResult)}</div>
                    <div role="cell" className="px-3 py-3 min-w-0"><FaixaBadge name={r.platoon} minScore={r.platoonMinScore} maxScore={r.platoonMaxScore} color={r.platoonColor} /></div>
                  </div>
                );
              })}
            </div>
          </div>
          {(search || filterEligible !== "all") && (
            <p className="text-[13px] text-muted-foreground" aria-live="polite"><b className="font-semibold text-foreground tabular-nums">{sortedRows.length}</b> de {plural(rows.length, "colaborador", "colaboradores")} com os filtros</p>
          )}
        </>
      )}

      <EmployeeDetailSheet employeeId={selectedId} onClose={() => setSelectedId(null)} cycleId={cycleId} readOnly={readOnly} />
    </div>
  );
}
