import { useState } from "react";
import { useGetQuarterlyResults, getGetQuarterlyResultsQueryKey, exportQuarterlyResults } from "@workspace/api-client-react";
import type { QuarterlyResult } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Download, Search, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONDENSED, WARNING, AMBER_TEXT } from "@/lib/premium-theme";
import { useSort, onKeyActivate, fmtScore, fieldStyle, type SortDir } from "./helpers";
import { SortIcon, FaixaBadge } from "./badges";
import { PlatoonDistributionPanel } from "./platoon-distribution-panel";
import { EmployeeDetailSheet } from "./employee-detail-sheet";

export function ConsolidationTab({ isManager }: { isManager: boolean }) {
  const { toast } = useToast();
  const { data: results, isLoading } = useGetQuarterlyResults(undefined, {
    query: { queryKey: getGetQuarterlyResultsQueryKey() },
  });
  const rows = results ?? [];
  const [search, setSearch] = useState("");
  const [filterEligible, setFilterEligible] = useState<"all" | "eligible" | "ineligible">("all");
  const [sortKey, setSortKey] = useState<keyof QuarterlyResult | null>("finalResult");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const eligibleFilteredRows = rows.filter(r => {
    if (filterEligible === "eligible") return r.eligible !== false;
    if (filterEligible === "ineligible") return r.eligible === false;
    return true;
  });

  const filteredRows = eligibleFilteredRows.filter(r => {
    const matchSearch = !search || (r.employeeName ?? "").toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

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
      const data = await exportQuarterlyResults();
      const blob = new Blob([data.data], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = data.filename;
      a.click();
    } catch {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    }
  }

  const headerCell = (label: string, key: keyof QuarterlyResult, align: "left" | "center" = "center") => (
    <div
      role="columnheader"
      aria-sort={sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("px-4 py-3 text-[11px] font-bold uppercase select-none", align === "center" && "text-center")}
      style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}
    >
      <button
        type="button"
        onClick={() => handleSort(key)}
        className="inline-flex items-center gap-1 uppercase transition-colors hover:opacity-70 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        style={{ fontFamily: CONDENSED, color: "inherit" }}
      >
        {label}
        <SortIcon active={sortKey === key} dir={sortDir} />
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      {isManager && (
        <div className="flex justify-end">
          <button
            data-testid="button-export-consolidation"
            onClick={handleExport}
            className="rounded-lg px-4 py-2.5 font-bold text-xs uppercase tracking-wide flex items-center gap-2 transition-colors hover:opacity-80"
            style={{ fontFamily: CONDENSED, border: "1px solid var(--border)" }}
          >
            <Download size={15} /> Exportar
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-20 font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Carregando consolidação...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-24 rounded-xl" style={{ border: "1px dashed var(--border)" }}>
          <Table2 size={44} className="mx-auto mb-4 opacity-20" />
          <h3 className="text-xl font-black uppercase tracking-tight mb-1" style={{ fontFamily: CONDENSED }}>Nenhum dado consolidado</h3>
          <p className="max-w-md mx-auto" style={{ color: "var(--muted-foreground)" }}>Não há resultados gerados para o ciclo atual.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          <PlatoonDistributionPanel rows={eligibleFilteredRows} />

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 h-11 rounded-lg text-sm outline-none"
                style={fieldStyle}
                placeholder="Buscar colaborador..."
                aria-label="Buscar colaborador na consolidação"
              />
            </div>
            <select
              aria-label="Filtrar por elegibilidade"
              value={filterEligible}
              onChange={e => setFilterEligible(e.target.value as "all" | "eligible" | "ineligible")}
              className="h-11 rounded-lg px-3 text-sm font-bold"
              style={fieldStyle}
            >
              <option value="all">Todos</option>
              <option value="eligible">Elegíveis</option>
              <option value="ineligible">Não elegíveis</option>
            </select>
          </div>

          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <Table2 size={16} style={{ color: "var(--accent-text)" }} />
              <span className="font-black uppercase tracking-tight text-xs" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>Planilha de Consolidação</span>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[820px]">
                <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr_1fr_1fr_1fr]" style={{ backgroundColor: "var(--secondary)" }}>
                  {headerCell("Colaborador", "employeeName", "left")}
                  {headerCell("Soma das Notas", "scoreSum")}
                  {headerCell("Eventos c/ Nota", "eventsCount")}
                  {headerCell("Eventos Participados", "participatedEventsCount")}
                  {headerCell("Penalidades / Méritos", "absencePenalty")}
                  {headerCell("Média (Nota Final)", "finalResult")}
                  {headerCell("Faixa", "platoon")}
                </div>
                {sortedRows.map((r) => {
                  const penalty = r.absencePenalty ?? 0;
                  const merit = r.meritPoints ?? 0;
                  const net = Math.round((merit - penalty) * 10) / 10;
                  return (
                    <div
                      key={r.employeeId}
                      data-testid={`row-consolidation-${r.employeeId}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`Ver detalhamento de ${r.employeeName}`}
                      className="grid grid-cols-[1.6fr_1fr_1fr_1fr_1fr_1fr_1fr] items-center transition-colors cursor-pointer hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
                      style={{ borderTop: "1px solid var(--border)" }}
                      onClick={() => setSelectedId(r.employeeId)}
                      onKeyDown={onKeyActivate(() => setSelectedId(r.employeeId))}
                    >
                      <div className="px-4 py-3.5">
                        <div className="font-bold uppercase text-sm">{r.employeeName}</div>
                      </div>
                      <div className="px-4 py-3.5 text-center font-black" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>{fmtScore(r.scoreSum ?? 0)}</div>
                      <div className="px-4 py-3.5 text-center">
                        <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}>{r.eventsCount ?? 0}</span>
                      </div>
                      <div className="px-4 py-3.5 text-center">
                        <span
                          className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: (r.participatedEventsCount ?? 0) > (r.eventsCount ?? 0) ? "rgba(232,162,61,0.14)" : "var(--primary)",
                            color: (r.participatedEventsCount ?? 0) > (r.eventsCount ?? 0) ? AMBER_TEXT : "var(--primary-foreground)",
                          }}
                          title={(r.participatedEventsCount ?? 0) > (r.eventsCount ?? 0) ? "Participou em mais eventos do que os que entraram na nota" : undefined}
                        >
                          {r.participatedEventsCount ?? 0}
                        </span>
                      </div>
                      <div className="px-4 py-3.5 text-center">
                        {net < 0 ? (
                          <span className="text-xs font-black px-2 py-0.5 rounded" style={{ backgroundColor: WARNING, color: "#fff" }}>-{Math.abs(net)}</span>
                        ) : net > 0 ? (
                          <span className="text-xs font-black px-2 py-0.5 rounded" style={{ backgroundColor: "rgba(22,163,74,0.15)", color: "#16a34a" }}>+{net}</span>
                        ) : (
                          <span className="font-bold" style={{ color: "var(--muted-foreground)" }}>—</span>
                        )}
                      </div>
                      <div className="px-4 py-3.5 text-center">
                        <div className="inline-flex items-baseline gap-1">
                          <span className="font-black text-2xl leading-none" style={{ fontFamily: CONDENSED }}>{fmtScore(r.finalResult)}</span>
                          <span className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>/100</span>
                        </div>
                      </div>
                      <div className="px-4 py-3.5 text-center">
                        <FaixaBadge name={r.platoon} minScore={r.platoonMinScore} maxScore={r.platoonMaxScore} color={r.platoonColor} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <EmployeeDetailSheet employeeId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
