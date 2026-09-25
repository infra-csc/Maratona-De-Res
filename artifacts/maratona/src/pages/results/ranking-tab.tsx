import { useState, useMemo } from "react";
import { useGetRanking, getGetRankingQueryKey, exportRanking } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Download, Users, Search, Trophy, ChevronRight } from "lucide-react";
import { cn, fmtNum } from "@/lib/utils";
import { CONDENSED, DANGER_TEXT } from "@/lib/premium-theme";
import { fieldStyle, fmtScore, fmtBRLShort } from "./helpers";
import { FaixaBadge } from "./badges";
import { PodiumStage } from "./podium-stage";
import { EmployeeDetailSheet } from "./employee-detail-sheet";

export function RankingTab({ canViewDetail }: { canViewDetail: boolean }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterEligible, setFilterEligible] = useState<"all" | "eligible" | "ineligible">("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Busca filtra no cliente: a lista tem dezenas de linhas e ir ao servidor a
  // cada tecla gerava uma requisição (e uma entrada de cache) por caractere.
  const qKey = getGetRankingQueryKey();
  const { data: rankingAll, isLoading } = useGetRanking(undefined, { query: { queryKey: qKey } });
  const ranking = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!rankingAll) return rankingAll;
    if (!s) return rankingAll;
    return rankingAll.filter(r => (r.employeeName ?? "").toLowerCase().includes(s));
  }, [rankingAll, search]);

  async function handleExport() {
    try {
      const data = await exportRanking();
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

  const top3 = filteredRanking.slice(0, 3);
  const activeRunners = filteredRanking.length;
  const scoredRanking = filteredRanking.filter(r => r.eventsCount > 0);
  const avgResult = scoredRanking.length > 0 ? scoredRanking.reduce((acc, r) => acc + r.finalResult, 0) / scoredRanking.length : 0;

  const eligFilters = [
    { key: "all" as const, label: "Todos" },
    { key: "eligible" as const, label: "Elegíveis" },
    { key: "ineligible" as const, label: "Não Elegíveis" },
  ];

  function openDetail(id: number) {
    if (!canViewDetail) return;
    setSelectedId(id);
  }

  return (
    <div className="space-y-6">
      <section className="flex items-center gap-3 flex-wrap">
        {ranking && ranking.length > 0 && (
          <>
            <div className="rounded-xl px-5 py-3.5" style={{ backgroundColor: "var(--primary)" }}>
              <span className="text-[11px] font-bold uppercase tracking-wide block flex items-center gap-1.5" style={{ color: "var(--primary-foreground)", opacity: 0.75 }}><Trophy size={12} /> Nota Média</span>
              <span className="font-black text-2xl block" style={{ fontFamily: CONDENSED, color: "var(--primary-foreground)" }} data-testid="stat-avg-result">{fmtNum(avgResult, 1)}</span>
            </div>
            <div className="rounded-xl px-5 py-3.5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
              <span className="text-[11px] font-bold uppercase tracking-wide block flex items-center gap-1.5" style={{ color: "var(--muted-foreground)" }}><Users size={12} /> Competidores</span>
              <span className="font-black text-2xl block" style={{ fontFamily: CONDENSED }} data-testid="stat-active-runners">{activeRunners}</span>
            </div>
          </>
        )}
        <button
          data-testid="button-export-ranking"
          className="rounded-lg px-5 py-3 font-bold text-xs uppercase tracking-wide flex items-center gap-2 ml-auto transition-opacity hover:opacity-90"
          style={{ fontFamily: CONDENSED, backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          onClick={handleExport}
        >
          <Download size={15} /> Exportar
        </button>
      </section>

      {isLoading ? (
        <div className="text-center py-24 font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Carregando ranking...</div>
      ) : !ranking || ranking.length === 0 ? (
        <div className="text-center py-20 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <Trophy size={56} className="mx-auto mb-6 opacity-20" strokeWidth={1.5} />
          <h3 className="text-2xl font-black uppercase tracking-tight mb-2" style={{ fontFamily: CONDENSED }}>Ranking Indisponível</h3>
          <p style={{ color: "var(--muted-foreground)" }}>Nenhum resultado consolidado para o ciclo atual.</p>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>Feche o ciclo na aba "Bônus & Pagamentos" para gerar o ranking oficial.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
          <div className="space-y-3.5">
            <div className="flex gap-2 flex-wrap">
              <div className="flex-1 min-w-[220px] flex items-center gap-2 rounded-lg px-3.5 py-2.5" style={fieldStyle}>
                <Search size={15} style={{ color: "var(--muted-foreground)" }} />
                <input
                  data-testid="input-search-ranking"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="bg-transparent outline-none text-sm w-full"
                  style={{ color: "var(--foreground)" }}
                  placeholder="Buscar colaborador no ranking..."
                />
              </div>
              {eligFilters.map(f => {
                const active = filterEligible === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFilterEligible(f.key)}
                    className="h-[42px] px-3.5 rounded-lg text-[11px] font-bold uppercase transition-colors"
                    style={{
                      fontFamily: CONDENSED,
                      backgroundColor: active ? "var(--primary)" : "transparent",
                      color: active ? "var(--primary-foreground)" : "var(--muted-foreground)",
                      border: active ? "1px solid var(--primary)" : "1px solid var(--border)",
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            <section className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <h3 className="text-[11px] font-bold uppercase tracking-widest" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>Classificação Geral</h3>
              </div>
              <div>
                {filteredRanking.length === 0 && allResults.length > 0 && filterEligible === "eligible" && (
                  <div className="px-5 py-8 text-center">
                    <p className="text-sm font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Nenhum colaborador elegível ainda</p>
                    <p className="text-xs mt-1.5" style={{ color: "var(--muted-foreground)" }}>
                      São necessários pelo menos 8 eventos no ciclo. Use <strong>Todos</strong> para ver o ranking parcial.
                    </p>
                  </div>
                )}
                {filteredRanking.map((entry) => {
                  const actualRank = entry.position;
                  const scorePct = Math.max(0, Math.min(100, entry.finalResult));
                  return (
                    <button
                      type="button"
                      key={entry.employeeId}
                      data-testid={`card-ranking-${entry.employeeId}`}
                      onClick={() => openDetail(entry.employeeId)}
                      className={cn(
                        "w-full text-left flex flex-col sm:flex-row sm:items-center gap-3.5 px-5 py-3.5 transition-colors group",
                        canViewDetail ? "cursor-pointer hover:opacity-90" : "cursor-default",
                      )}
                      style={{ borderTop: "1px solid var(--border)" }}
                    >
                      <div className="w-11 h-11 rounded-lg flex flex-col items-center justify-center shrink-0" style={{ backgroundColor: "var(--secondary)" }}>
                        <span className="text-[11px] font-bold uppercase leading-none" style={{ color: "var(--muted-foreground)" }}>Pos</span>
                        <span className="text-base font-black leading-none mt-0.5" style={{ fontFamily: CONDENSED }}>{String(actualRank).padStart(2, "0")}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold uppercase text-sm truncate" data-testid={`text-employee-name-${entry.employeeId}`}>{entry.employeeName}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded" style={{ color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                            {entry.eventsCount} eventos
                          </span>
                          {entry.eligible === false && (
                            <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(229,72,77,0.12)", color: DANGER_TEXT }}>
                              Inelegível
                            </span>
                          )}
                          {entry.absences > 0 && (
                            <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(229,72,77,0.12)", color: DANGER_TEXT }}>
                              {entry.absences} penalidades
                            </span>
                          )}
                          <FaixaBadge name={entry.platoon} minScore={entry.platoonMinScore} maxScore={entry.platoonMaxScore} color={entry.platoonColor} />
                        </div>
                      </div>
                      <div className="hidden md:flex items-center gap-2 w-36 shrink-0">
                        <div className="flex-1 h-[6px] rounded-full overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}>
                          <div className="h-full rounded-full" style={{ width: `${scorePct}%`, backgroundColor: "var(--accent)" }} />
                        </div>
                        <span className="text-[11px] font-bold w-14 text-right whitespace-nowrap">{fmtScore(entry.finalResult)}/100</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 sm:pl-3 sm:w-[15rem] sm:justify-end">
                        <div className="text-right">
                          <span className="block text-[11px] uppercase font-bold leading-none mb-1" style={{ color: "var(--muted-foreground)" }}>Nota Final</span>
                          <p className="font-black text-xl leading-none" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }} data-testid={`text-final-result-${entry.employeeId}`}>{fmtScore(entry.finalResult)}</p>
                        </div>
                        <div className="text-right hidden sm:block w-24 shrink-0">
                          {entry.bonusValue > 0 && (
                            <div className="rounded-lg px-2.5 py-1.5" style={{ backgroundColor: "var(--primary)" }}>
                              <span className="block text-[11px] uppercase font-bold leading-none mb-1" style={{ color: "var(--primary-foreground)", opacity: 0.75 }}>Bônus</span>
                              <p className="font-black text-sm leading-none" style={{ color: "var(--primary-foreground)" }}>{fmtBRLShort(entry.bonusValue)}</p>
                            </div>
                          )}
                        </div>
                        {canViewDetail && <ChevronRight size={16} style={{ color: "var(--muted-foreground)" }} className="shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="space-y-2.5">
            <div className="rounded-xl px-4 py-3 flex items-center gap-2" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
              <Trophy size={15} style={{ color: "var(--accent-text)" }} />
              <h3 className="text-[11px] font-bold uppercase tracking-widest" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>Pódio da Maratona</h3>
            </div>
            {top3.length > 0 && (
              <PodiumStage top3={top3} canViewDetail={canViewDetail} onSelect={openDetail} />
            )}
            {canViewDetail && (
              <p className="text-[11px] px-1" style={{ color: "var(--muted-foreground)" }}>Clique em um colaborador para ver o detalhamento de provas, penalidades e méritos.</p>
            )}
          </aside>
        </div>
      )}

      <EmployeeDetailSheet employeeId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
