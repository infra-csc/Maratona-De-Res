import { useState } from "react";
import {
  useGetRanking, getGetRankingQueryKey, exportRanking,
  useGetRankingDetail, getGetRankingDetailQueryKey,
  useGetQuarterlyResults, getGetQuarterlyResultsQueryKey, exportQuarterlyResults,
  useCloseQuarter, useUpdateBonusPayment, useRecomputeQuarter,
} from "@workspace/api-client-react";
import type { QuarterlyResult } from "@workspace/api-client-react";
import { CycleBadge } from "@/components/cycle-badge";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Download, LockKeyhole, Wallet, CheckCircle2, Wallet2, Users,
  Search, Trophy, Crown, Award, AlertTriangle, MapPin, ChevronRight, Table2, ListOrdered,
  ArrowUpDown, ArrowUp, ArrowDown, RefreshCw,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { CONDENSED, BODY, WARNING } from "@/lib/premium-theme";

const AMBER = "#e8a23d";
const GOOD = "#9ab000";

const BONUS_STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  projected: { label: "Projetado", bg: "var(--secondary)", color: "var(--muted-foreground)" },
  approved: { label: "Aprovado", bg: "rgba(154,176,0,0.14)", color: GOOD },
  scheduled: { label: "Agendado", bg: "rgba(232,162,61,0.14)", color: AMBER },
  paid: { label: "Pago", bg: "var(--primary)", color: "var(--primary-foreground)" },
  blocked: { label: "Bloqueado", bg: "rgba(229,72,77,0.12)", color: WARNING },
  not_eligible: { label: "Não elegível", bg: "var(--secondary)", color: "var(--muted-foreground)" },
};
const BONUS_STATUS_OPTIONS = ["projected", "approved", "scheduled", "paid", "blocked", "not_eligible"];

type SortDir = "asc" | "desc";

function useSort<T extends Record<string, any>>(items: T[], key: keyof T | null, dir: SortDir) {
  if (!key) return items;
  const sorted = [...items].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (typeof av === "string" && typeof bv === "string") return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
    return 0;
  });
  return sorted;
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown size={12} style={{ color: "var(--muted-foreground)", opacity: 0.5 }} />;
  return dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

const fmtScore = (v: number) => v.toFixed(1);
const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtBRLShort = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fieldStyle: React.CSSProperties = { backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" };

function FaixaBadge({ minScore, maxScore, color }: { minScore?: number | null; maxScore?: number | null; color?: string | null }) {
  if (minScore == null && maxScore == null) return <span style={{ color: "var(--muted-foreground)" }} className="font-bold">—</span>;
  const bg = color ?? "var(--secondary)";
  const label = minScore != null && maxScore != null
    ? `${minScore}–${maxScore}`
    : minScore != null ? `≥ ${minScore}` : `≤ ${maxScore}`;
  return (
    <span
      className="inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
      style={{ backgroundColor: bg, color: "#fff", mixBlendMode: "normal" }}
    >
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* RANKING TAB                                                         */
/* ------------------------------------------------------------------ */

function PodiumRow({ entry, rank, onClick, clickable }: { entry: any; rank: number; onClick: () => void; clickable: boolean }) {
  const isLeader = rank === 1;
  const medalLabel = rank === 1 ? "Ouro" : rank === 2 ? "Prata" : "Bronze";
  const rankColor = isLeader ? "var(--accent)" : "var(--muted-foreground)";
  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      data-testid={`podium-card-${entry.employeeId}`}
      className={cn("w-full text-left rounded-xl flex items-center gap-3 p-3.5", clickable && "cursor-pointer transition-opacity hover:opacity-90")}
      style={{
        backgroundColor: isLeader ? "var(--primary)" : "var(--card)",
        border: isLeader ? "1px solid var(--primary)" : "1px solid var(--border)",
      }}
    >
      <span className="font-black shrink-0 leading-none" style={{ fontFamily: CONDENSED, fontSize: isLeader ? 26 : 22, color: isLeader ? "var(--primary-foreground)" : rankColor }}>
        #{rank}
      </span>
      <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: isLeader ? "var(--primary-foreground)" : "var(--secondary)" }}>
        <span className="font-black text-[13px]" style={{ fontFamily: CONDENSED, color: isLeader ? "var(--primary)" : "var(--foreground)" }}>{initials(entry.employeeName)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold uppercase truncate" data-testid={`text-podium-name-${entry.employeeId}`} style={{ color: isLeader ? "var(--primary-foreground)" : "var(--foreground)" }}>{entry.employeeName}</p>
        <span className="text-[9px] font-bold uppercase" style={{ color: isLeader ? "var(--primary-foreground)" : "var(--muted-foreground)", opacity: isLeader ? 0.75 : 1 }}>{medalLabel}</span>
      </div>
      <span className="font-black text-xl shrink-0" style={{ fontFamily: CONDENSED, color: isLeader ? "var(--primary-foreground)" : rankColor }} data-testid={`text-podium-result-${entry.employeeId}`}>
        {entry.finalResult.toFixed(1)}
      </span>
    </button>
  );
}

function RankingTab({ canViewDetail }: { canViewDetail: boolean }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterEligible, setFilterEligible] = useState<"all" | "eligible" | "ineligible">("eligible");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const qKey = getGetRankingQueryKey({ search: search || undefined });
  const { data: ranking, isLoading } = useGetRanking({ search: search || undefined }, { query: { queryKey: qKey } });

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
              <span className="text-[10px] font-bold uppercase tracking-wide block flex items-center gap-1.5" style={{ color: "var(--primary-foreground)", opacity: 0.75 }}><Trophy size={12} /> Nota Média</span>
              <span className="font-black text-2xl block" style={{ fontFamily: CONDENSED, color: "var(--primary-foreground)" }} data-testid="stat-avg-result">{avgResult.toFixed(1)}</span>
            </div>
            <div className="rounded-xl px-5 py-3.5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
              <span className="text-[10px] font-bold uppercase tracking-wide block flex items-center gap-1.5" style={{ color: "var(--muted-foreground)" }}><Users size={12} /> Competidores</span>
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
                <h3 className="text-[11px] font-bold uppercase tracking-widest" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>Classificação Geral</h3>
              </div>
              <div>
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
                        <span className="text-[8px] font-bold uppercase leading-none" style={{ color: "var(--muted-foreground)" }}>Pos</span>
                        <span className="text-base font-black leading-none mt-0.5" style={{ fontFamily: CONDENSED }}>{String(actualRank).padStart(2, "0")}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold uppercase text-sm truncate" data-testid={`text-employee-name-${entry.employeeId}`}>{entry.employeeName}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded" style={{ color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                            {entry.eventsCount} eventos
                          </span>
                          {entry.eligible === false && (
                            <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(229,72,77,0.12)", color: WARNING }}>
                              Inelegível
                            </span>
                          )}
                          {entry.absences > 0 && (
                            <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(229,72,77,0.12)", color: WARNING }}>
                              {entry.absences} penalidades
                            </span>
                          )}
                          <FaixaBadge minScore={entry.platoonMinScore} maxScore={entry.platoonMaxScore} color={entry.platoonColor} />
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
                          <span className="block text-[9px] uppercase font-bold leading-none mb-1" style={{ color: "var(--muted-foreground)" }}>Nota Final</span>
                          <p className="font-black text-xl leading-none" style={{ fontFamily: CONDENSED, color: "var(--accent)" }} data-testid={`text-final-result-${entry.employeeId}`}>{fmtScore(entry.finalResult)}</p>
                        </div>
                        <div className="text-right hidden sm:block w-24 shrink-0">
                          {entry.bonusValue > 0 && (
                            <div className="rounded-lg px-2.5 py-1.5" style={{ backgroundColor: "var(--primary)" }}>
                              <span className="block text-[8px] uppercase font-bold leading-none mb-1" style={{ color: "var(--primary-foreground)", opacity: 0.75 }}>Bônus</span>
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
              <Trophy size={15} style={{ color: "var(--accent)" }} />
              <h3 className="text-[11px] font-bold uppercase tracking-widest" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>Pódio da Maratona</h3>
            </div>
            {top3[0] && <PodiumRow entry={top3[0]} rank={1} clickable={canViewDetail} onClick={() => openDetail(top3[0].employeeId)} />}
            {top3[1] && <PodiumRow entry={top3[1]} rank={2} clickable={canViewDetail} onClick={() => openDetail(top3[1].employeeId)} />}
            {top3[2] && <PodiumRow entry={top3[2]} rank={3} clickable={canViewDetail} onClick={() => openDetail(top3[2].employeeId)} />}
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

/* ------------------------------------------------------------------ */
/* SHARED DETAIL SHEET COMPONENT                                       */
/* ------------------------------------------------------------------ */

function EmployeeDetailSheet({
  employeeId,
  onClose,
}: {
  employeeId: number | null;
  onClose: () => void;
}) {
  const detailParams = { employeeId: employeeId ?? 0 };
  const { data: detail, isLoading: detailLoading } = useGetRankingDetail(detailParams, {
    query: { queryKey: getGetRankingDetailQueryKey(detailParams), enabled: !!employeeId },
  });

  return (
    <Sheet open={!!employeeId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0" style={{ backgroundColor: "var(--background)", borderLeft: "1px solid var(--border)" }}>
        {detailLoading || !detail ? (
          <div className="p-10 text-center font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Carregando detalhamento...</div>
        ) : (
          <div>
            <SheetHeader className="p-6 space-y-3 text-left" style={{ backgroundColor: "var(--secondary)" }}>
              <SheetTitle className="text-2xl font-black uppercase tracking-tight leading-none" style={{ fontFamily: CONDENSED }}>
                {detail.employee.name}
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase">
                {detail.employee.functionName && (
                  <span className="rounded px-2 py-0.5" style={{ border: "1px solid var(--accent)", color: "var(--accent)" }}>{detail.employee.functionName}</span>
                )}
                <span style={{ color: "var(--muted-foreground)" }}>{detail.cycle.name}</span>
              </div>
            </SheetHeader>

            <div className="p-6 space-y-7">
              <section className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-4" style={{ backgroundColor: "var(--primary)" }}>
                  <span className="text-[10px] font-bold uppercase block" style={{ color: "var(--primary-foreground)", opacity: 0.75 }}>Nota Final</span>
                  <p className="text-3xl font-black leading-none mt-1" style={{ fontFamily: CONDENSED, color: "var(--primary-foreground)" }} data-testid="detail-final-result">
                    {detail.summary.finalResult != null ? detail.summary.finalResult.toFixed(1) : "—"}
                  </p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  <span className="text-[10px] font-bold uppercase block" style={{ color: "var(--muted-foreground)" }}>Média Bruta</span>
                  <p className="text-3xl font-black leading-none mt-1" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>
                    {detail.summary.grossAverage != null ? detail.summary.grossAverage.toFixed(1) : "—"}
                  </p>
                  {detail.summary.scoreSum != null && detail.summary.confirmedEventCount != null && (
                    <p className="text-[10px] font-bold mt-1" style={{ color: "var(--muted-foreground)" }}>
                      Soma: {detail.summary.scoreSum.toFixed(1)} ÷ {detail.summary.confirmedEventCount} provas
                    </p>
                  )}
                </div>
                <div className="rounded-xl p-3 flex items-center gap-2" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  <AlertTriangle size={18} className="shrink-0" style={{ color: WARNING }} />
                  <div>
                    <span className="text-[10px] font-bold uppercase block leading-none" style={{ color: "var(--muted-foreground)" }}>Penalidades</span>
                    <p className="text-lg font-black leading-none" style={{ fontFamily: CONDENSED, color: WARNING }}>-{detail.summary.penaltyPoints}</p>
                  </div>
                </div>
                <div className="rounded-xl p-3 flex items-center gap-2" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  <Award size={18} className="shrink-0" style={{ color: GOOD }} />
                  <div>
                    <span className="text-[10px] font-bold uppercase block leading-none" style={{ color: "var(--muted-foreground)" }}>Méritos</span>
                    <p className="text-lg font-black leading-none" style={{ fontFamily: CONDENSED, color: GOOD }}>+{detail.summary.meritPoints}</p>
                  </div>
                </div>
              </section>

              {!detail.summary.isQuarterClosed && (
                <div className="rounded-lg px-4 py-3 text-xs font-bold uppercase" style={{ backgroundColor: "rgba(232,162,61,0.14)", color: AMBER }}>
                  Ciclo ainda não fechado — valores parciais.
                </div>
              )}

              <section className="space-y-3">
                <h4 className="text-sm font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}>
                  <Trophy size={16} /> Desempenho nas Provas
                </h4>
                {detail.events.filter(ev => ev.resultsConfirmed).length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Nenhum evento confirmado no ciclo.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.events.filter(ev => ev.resultsConfirmed).map(ev => (
                      <div key={ev.eventId} data-testid={`detail-event-${ev.eventId}`} className={cn("rounded-lg p-3 flex items-center gap-3", !ev.countsForScore && "opacity-70")} style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold uppercase text-sm">{ev.eventName}</p>
                            {!ev.countsForScore && (
                              <span
                                data-testid={`detail-event-no-score-${ev.eventId}`}
                                className="px-1.5 py-0.5 rounded font-bold text-[9px] uppercase inline-block shrink-0"
                                style={{ border: "1px solid " + AMBER, backgroundColor: "rgba(232,162,61,0.12)", color: AMBER }}
                                title={(ev as { noScoreReason?: string }).noScoreReason === "sup_ceno" ? `Função: ${(ev as { participationFunction?: string }).participationFunction ?? "Sup Ceno"} — participação informativa, não entra na nota.` : (ev as { noScoreReason?: string }).noScoreReason === "freela" ? "Freela — não entra na nota." : "Participação informativa — não entra na nota."}
                              >
                                {(ev as { noScoreReason?: string }).noScoreReason === "sup_ceno"
                                  ? `Sup Ceno — não conta p/ nota`
                                  : (ev as { noScoreReason?: string }).noScoreReason === "freela"
                                  ? "Freela — não conta p/ nota"
                                  : "Não conta p/ nota"}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] font-bold" style={{ color: "var(--muted-foreground)" }}>
                            {(ev.city || ev.state) && (
                              <span className="inline-flex items-center gap-1"><MapPin size={11} />{[ev.city, ev.state].filter(Boolean).join(" / ")}</span>
                            )}
                            {ev.isHistorical ? (
                              <span className="uppercase">Evento histórico</span>
                            ) : (
                              <span className="uppercase">{ev.evaluatedCriteria}/{ev.totalCriteria} quesitos</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="block text-[9px] uppercase font-bold leading-none mb-1" style={{ color: "var(--muted-foreground)" }}>Nota Time</span>
                          <p className="text-xl font-black leading-none" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>{ev.eventScore.toFixed(1)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED, color: WARNING }}>
                  <AlertTriangle size={16} /> Penalidades
                </h4>
                {detail.penalties.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Sem penalidades no ciclo.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.penalties.map(p => (
                      <div key={p.id} data-testid={`detail-penalty-${p.id}`} className="rounded-lg p-3 flex items-center gap-3" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold uppercase text-sm">{p.label}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] font-bold" style={{ color: "var(--muted-foreground)" }}>
                            <span>{new Date(p.date).toLocaleDateString("pt-BR")}</span>
                            {p.eventName && <span>· {p.eventName}</span>}
                            {p.quantity > 1 && <span>· {p.quantity}x</span>}
                          </div>
                        </div>
                        <span className="font-black px-3 py-1 rounded-lg text-xs shrink-0" style={{ backgroundColor: WARNING, color: "#fff" }}>-{p.total}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED, color: GOOD }}>
                  <Award size={16} /> Méritos
                </h4>
                {detail.merits.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Sem méritos no ciclo.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.merits.map(m => (
                      <div key={m.id} data-testid={`detail-merit-${m.id}`} className="rounded-lg p-3 flex items-center gap-3" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold uppercase text-sm">{m.label}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] font-bold" style={{ color: "var(--muted-foreground)" }}>
                            <span>{new Date(m.date).toLocaleDateString("pt-BR")}</span>
                            {m.eventName && <span>· {m.eventName}</span>}
                            {m.quantity > 1 && <span>· {m.quantity}x</span>}
                          </div>
                        </div>
                        <span className="font-black px-3 py-1 rounded-lg text-xs shrink-0" style={{ backgroundColor: "rgba(154,176,0,0.14)", color: GOOD }}>+{m.total}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {detail.summary.bonusValue != null && detail.summary.bonusValue > 0 && (
                <section className="rounded-xl p-4 flex items-center justify-between" style={{ backgroundColor: "var(--primary)" }}>
                  <span className="text-xs font-black uppercase tracking-wide" style={{ color: "var(--primary-foreground)" }}>Bônus do Ciclo</span>
                  <span className="text-2xl font-black" style={{ fontFamily: CONDENSED, color: "var(--primary-foreground)" }}>{fmtBRL(detail.summary.bonusValue)}</span>
                </section>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* CONSOLIDAÇÃO TAB                                                    */
/* ------------------------------------------------------------------ */

function ConsolidationTab({ isManager }: { isManager: boolean }) {
  const { toast } = useToast();
  const { data: results, isLoading } = useGetQuarterlyResults(undefined, {
    query: { queryKey: getGetQuarterlyResultsQueryKey() },
  });
  const rows = results ?? [];
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof QuarterlyResult | null>("finalResult");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filteredRows = rows.filter(r => {
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
      className={cn("px-4 py-3 text-[10px] font-bold uppercase cursor-pointer select-none transition-colors hover:opacity-70", align === "center" && "text-center")}
      style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}
      onClick={() => handleSort(key)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <SortIcon active={sortKey === key} dir={sortDir} />
      </span>
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
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 h-11 rounded-lg text-sm outline-none"
              style={fieldStyle}
              placeholder="Buscar colaborador..."
            />
          </div>

          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <Table2 size={16} style={{ color: "var(--accent)" }} />
              <span className="font-black uppercase tracking-tight text-xs" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>Planilha de Consolidação</span>
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
                      className="grid grid-cols-[1.6fr_1fr_1fr_1fr_1fr_1fr_1fr] items-center transition-colors cursor-pointer hover:opacity-90"
                      style={{ borderTop: "1px solid var(--border)" }}
                      onClick={() => setSelectedId(r.employeeId)}
                    >
                      <div className="px-4 py-3.5">
                        <div className="font-bold uppercase text-sm">{r.employeeName}</div>
                      </div>
                      <div className="px-4 py-3.5 text-center font-black" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>{fmtScore(r.scoreSum ?? 0)}</div>
                      <div className="px-4 py-3.5 text-center">
                        <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}>{r.eventsCount ?? 0}</span>
                      </div>
                      <div className="px-4 py-3.5 text-center">
                        <span
                          className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: (r.participatedEventsCount ?? 0) > (r.eventsCount ?? 0) ? "rgba(232,162,61,0.14)" : "var(--primary)",
                            color: (r.participatedEventsCount ?? 0) > (r.eventsCount ?? 0) ? AMBER : "var(--primary-foreground)",
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
                          <span className="text-xs font-black px-2 py-0.5 rounded" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>+{net}</span>
                        ) : (
                          <span className="font-bold" style={{ color: "var(--muted-foreground)" }}>—</span>
                        )}
                      </div>
                      <div className="px-4 py-3.5 text-center">
                        <div className="inline-flex items-baseline gap-1">
                          <span className="font-black text-2xl leading-none" style={{ fontFamily: CONDENSED }}>{fmtScore(r.finalResult)}</span>
                          <span className="text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>/100</span>
                        </div>
                      </div>
                      <div className="px-4 py-3.5 text-center">
                        <FaixaBadge minScore={r.platoonMinScore} maxScore={r.platoonMaxScore} color={r.platoonColor} />
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

/* ------------------------------------------------------------------ */
/* BÔNUS & PAGAMENTOS TAB                                              */
/* ------------------------------------------------------------------ */

function PaymentsTab({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [payTarget, setPayTarget] = useState<QuarterlyResult | null>(null);
  const [payForm, setPayForm] = useState({ bonusStatus: "projected", paymentMethod: "Caju Saldo Livre", paymentNotes: "" });
  const [forceClose, setForceClose] = useState(false);
  const [forceReason, setForceReason] = useState("");
  const [search, setSearch] = useState("");
  const [filterEligible, setFilterEligible] = useState<"all" | "eligible" | "ineligible">("all");
  const [sortKey, setSortKey] = useState<keyof QuarterlyResult | null>("finalResult");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const qKey = getGetQuarterlyResultsQueryKey();
  const { data: results, isLoading } = useGetQuarterlyResults(undefined, { query: { queryKey: qKey } });

  const closeMutation = useCloseQuarter({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: `Ciclo fechado! ${data.totalProcessed} colaborador(es) processado(s).` });
        setForceClose(false);
        setForceReason("");
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao fechar ciclo", description: e.message, variant: "destructive" }),
    },
  });

  function handleCloseCycle() {
    if (forceClose && !forceReason.trim()) {
      toast({ title: "Justificativa obrigatória para fechamento forçado", variant: "destructive" });
      return;
    }
    closeMutation.mutate({
      data: forceClose ? { forced: true, reason: forceReason.trim() } : {},
    });
  }

  const recomputeMutation = useRecomputeQuarter({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: qKey });
        qc.invalidateQueries({ queryKey: getGetRankingQueryKey() });
        toast({ title: `Ciclo recalculado! ${data.totalProcessed} colaborador(es) processado(s).` });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao recalcular ciclo", description: e.message, variant: "destructive" }),
    },
  });

  const paymentMutation = useUpdateBonusPayment({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Pagamento atualizado" });
        setPayTarget(null);
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao atualizar pagamento", description: e.message, variant: "destructive" }),
    },
  });

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

  function openPayment(r: QuarterlyResult) {
    setPayTarget(r);
    setPayForm({
      bonusStatus: r.bonusStatus ?? "projected",
      paymentMethod: r.paymentMethod ?? "Caju Saldo Livre",
      paymentNotes: r.paymentNotes ?? "",
    });
  }

  function savePayment() {
    if (!payTarget?.id) return;
    paymentMutation.mutate({
      id: payTarget.id,
      data: {
        bonusStatus: payForm.bonusStatus,
        paymentMethod: payForm.paymentMethod,
        paymentNotes: payForm.paymentNotes || undefined,
        paidAt: payForm.bonusStatus === "paid" ? new Date().toISOString() : null,
      },
    });
  }

  function handleSort(key: keyof QuarterlyResult) {
    if (sortKey === key) {
      setSortDir(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const rows = results ?? [];
  const filteredRows = rows.filter(r => {
    const matchSearch = !search || (r.employeeName ?? "").toLowerCase().includes(search.toLowerCase());
    if (filterEligible === "eligible" && r.eligible === false) return false;
    if (filterEligible === "ineligible" && r.eligible !== false) return false;
    return matchSearch;
  });

  const totalBonus = filteredRows.reduce((acc, r) => acc + (r.bonusValue ?? 0), 0);
  const eligibleCount = filteredRows.filter(r => r.eligible !== false).length;
  const eligibilityPct = filteredRows.length > 0 ? Math.round((eligibleCount / filteredRows.length) * 100) : 0;
  const sortedRows = useSort(filteredRows, sortKey, sortDir);

  const payHeaderCell = (label: string, key: keyof QuarterlyResult, align: "left" | "center" = "center") => (
    <div
      className={cn("px-4 py-3 text-[10px] font-bold uppercase cursor-pointer select-none transition-colors hover:opacity-70", align === "center" && "text-center")}
      style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}
      onClick={() => handleSort(key)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <SortIcon active={sortKey === key} dir={sortDir} />
      </span>
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="flex gap-2.5 items-center flex-wrap justify-end">
        <button
          data-testid="button-export-results"
          onClick={handleExport}
          className="rounded-lg px-4 py-2.5 font-bold text-xs uppercase tracking-wide flex items-center gap-2 transition-colors hover:opacity-80"
          style={{ fontFamily: CONDENSED, border: "1px solid var(--border)" }}
        >
          <Download size={15} /> Exportar
        </button>

        {canManage && (
          <button
            data-testid="button-recompute-quarter"
            onClick={() => recomputeMutation.mutate()}
            disabled={recomputeMutation.isPending}
            title="Recalcula os resultados do ciclo atual agora, sem fechar o ciclo (ex.: após alterar o cargo de um colaborador)"
            className="rounded-lg px-4 py-2.5 font-bold text-xs uppercase tracking-wide flex items-center gap-2 disabled:opacity-50 transition-colors hover:opacity-80"
            style={{ fontFamily: CONDENSED, border: "1px solid var(--border)" }}
          >
            <RefreshCw size={15} className={recomputeMutation.isPending ? "animate-spin" : ""} /> {recomputeMutation.isPending ? "Recalculando..." : "Recalcular Ciclo"}
          </button>
        )}

        {canManage && (
          <AlertDialog onOpenChange={(o) => { if (!o) { setForceClose(false); setForceReason(""); } }}>
            <AlertDialogTrigger asChild>
              <button
                data-testid="button-close-quarter"
                className="rounded-lg px-4 py-2.5 font-bold text-xs uppercase tracking-wide flex items-center gap-2 transition-opacity hover:opacity-90"
                style={{ fontFamily: CONDENSED, backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                <LockKeyhole size={15} /> Fechar Ciclo
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
              <AlertDialogHeader>
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: "var(--primary)" }}>
                  <LockKeyhole size={22} style={{ color: "var(--primary-foreground)" }} />
                </div>
                <AlertDialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Consolidar Resultados do Ciclo?</AlertDialogTitle>
                <AlertDialogDescription className="text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                  O fechamento irá congelar as notas, calcular as faixas de bônus e gerar a projeção de premiação baseada nos eventos já finalizados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4 py-4 px-4 rounded-lg mt-2" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="force-close"
                    data-testid="checkbox-force-close"
                    checked={forceClose}
                    onCheckedChange={(c) => setForceClose(c === true)}
                    className="mt-0.5"
                    style={{ borderColor: WARNING }}
                  />
                  <Label htmlFor="force-close" className="text-sm font-bold leading-snug cursor-pointer" style={{ color: "var(--foreground)" }}>
                    Existem eventos pendentes. Forçar o fechamento ignorando esses eventos?
                  </Label>
                </div>
                {forceClose && (
                  <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2">
                    <Label htmlFor="force-reason" className="text-xs font-black uppercase tracking-wide" style={{ color: WARNING }}>Justificativa Obrigatória</Label>
                    <Textarea
                      id="force-reason"
                      data-testid="input-force-reason"
                      value={forceReason}
                      onChange={(e) => setForceReason(e.target.value)}
                      placeholder="Por que o ciclo deve ser fechado agora?"
                      className="rounded-lg"
                      style={fieldStyle}
                      rows={3}
                    />
                  </div>
                )}
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-lg font-bold uppercase text-xs tracking-wide" style={{ border: "1px solid var(--border)" }}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCloseCycle}
                  disabled={closeMutation.isPending || (forceClose && !forceReason.trim())}
                  className="rounded-lg font-bold uppercase text-xs tracking-wide"
                  style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  {closeMutation.isPending ? "Processando..." : "Confirmar Fechamento"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </section>

      {rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
              <Wallet2 size={15} />
              <p className="font-bold uppercase text-xs tracking-wide">Total em Bônus</p>
            </div>
            <h3 className="text-3xl font-black mt-2" style={{ fontFamily: CONDENSED }}>{fmtBRL(totalBonus)}</h3>
          </div>
          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
              <CheckCircle2 size={15} />
              <p className="font-bold uppercase text-xs tracking-wide">Elegibilidade</p>
            </div>
            <h3 className="text-3xl font-black mt-2" style={{ fontFamily: CONDENSED }}>{eligibilityPct}%</h3>
            <span className="inline-block mt-2.5 font-black uppercase text-[10px] px-2 py-1 rounded" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>{eligibleCount} de {rows.length}</span>
          </div>
          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
              <Users size={15} />
              <p className="font-bold uppercase text-xs tracking-wide">Colaboradores</p>
            </div>
            <h3 className="text-3xl font-black mt-2" style={{ fontFamily: CONDENSED }}>{rows.length}</h3>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-20 font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Carregando resultados...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-24 rounded-xl" style={{ border: "1px dashed var(--border)" }}>
          <Wallet2 size={44} className="mx-auto mb-4 opacity-20" />
          <h3 className="text-xl font-black uppercase tracking-tight mb-1" style={{ fontFamily: CONDENSED }}>Nenhum resultado consolidado</h3>
          <p className="max-w-md mx-auto" style={{ color: "var(--muted-foreground)" }}>Não há dados gerados para o ciclo atual.</p>
          {canManage && <p className="text-sm mt-2" style={{ color: "var(--muted-foreground)" }}>Clique em "Fechar Ciclo" para gerar os resultados oficiais.</p>}
        </div>
      ) : (
        <div className="space-y-3.5">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative max-w-md flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 h-11 rounded-lg text-sm outline-none"
                style={fieldStyle}
                placeholder="Buscar colaborador..."
              />
            </div>
            <select value={filterEligible} onChange={e => setFilterEligible(e.target.value as any)} className="h-11 rounded-lg px-3 text-sm font-bold" style={fieldStyle}>
              <option value="all">Todos</option>
              <option value="eligible">Elegíveis</option>
              <option value="ineligible">Não elegíveis</option>
            </select>
          </div>

          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <Wallet size={16} style={{ color: "var(--accent)" }} />
              <span className="font-black uppercase tracking-tight text-xs" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>Bônus & Pagamentos</span>
            </div>
            <div className="overflow-x-auto">
              <div className={cn("min-w-[900px]", canManage && "min-w-[980px]")}>
                <div className="grid items-center" style={{ backgroundColor: "var(--secondary)", gridTemplateColumns: canManage ? "1.6fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 0.7fr" : "1.6fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr" }}>
                  {payHeaderCell("Colaborador", "employeeName", "left")}
                  {payHeaderCell("Atividade", "eventsCount")}
                  {payHeaderCell("Nota Final", "finalResult")}
                  {payHeaderCell("Faixa", "platoon")}
                  {payHeaderCell("Elegibilidade", "eligible")}
                  {payHeaderCell("Bônus", "bonusValue")}
                  {payHeaderCell("Bônus Extra", "extraBonusValue")}
                  {payHeaderCell("Status do Pagamento", "bonusStatus")}
                  {canManage && <div className="px-4 py-3 text-[10px] font-bold uppercase text-center" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Ação</div>}
                </div>
                {sortedRows.map((r) => {
                  const statusInfo = r.bonusStatus ? (BONUS_STATUS_LABELS[r.bonusStatus] ?? { label: r.bonusStatus, bg: "var(--secondary)", color: "var(--muted-foreground)" }) : null;
                  return (
                    <div
                      key={r.employeeId}
                      data-testid={`row-result-${r.employeeId}`}
                      className="grid items-center transition-colors cursor-pointer group hover:opacity-90"
                      style={{ borderTop: "1px solid var(--border)", gridTemplateColumns: canManage ? "1.6fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 0.7fr" : "1.6fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr" }}
                      onClick={() => setSelectedId(r.employeeId)}
                    >
                      <div className="px-4 py-3.5">
                        <div className="font-bold uppercase text-sm">{r.employeeName}</div>
                      </div>
                      <div className="px-4 py-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}>{r.eventsCount ?? 0} c/ nota</span>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>{r.participatedEventsCount ?? 0} participados</span>
                          {(r.totalAbsences ?? 0) > 0 && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(229,72,77,0.12)", color: WARNING }}>{r.totalAbsences} penalidades</span>}
                        </div>
                      </div>
                      <div className="px-4 py-3.5 text-center">
                        <div className="inline-flex items-baseline gap-1">
                          <span className="font-black text-2xl leading-none" style={{ fontFamily: CONDENSED }}>{fmtScore(r.finalResult)}</span>
                          <span className="text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>/100</span>
                        </div>
                      </div>
                      <div className="px-4 py-3.5 text-center">
                        <FaixaBadge minScore={r.platoonMinScore} maxScore={r.platoonMaxScore} color={r.platoonColor} />
                      </div>
                      <div className="px-4 py-3.5 text-center">
                        {r.eligible === false ? (
                          <span className="inline-block text-[10px] uppercase font-black px-2 py-1 rounded-full cursor-help" style={{ backgroundColor: "rgba(229,72,77,0.12)", color: WARNING }} title={r.eligibilityReason ?? undefined}>
                            Não Elegível
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-black px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(154,176,0,0.14)", color: GOOD }}>
                            <CheckCircle2 size={10} /> Elegível
                          </span>
                        )}
                      </div>
                      <div className="px-4 py-3.5 text-center">
                        {r.bonusValue > 0 ? (
                          <span className="font-black px-2.5 py-1 rounded-lg" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>{fmtBRL(r.bonusValue)}</span>
                        ) : (
                          <span className="font-bold" style={{ color: "var(--muted-foreground)" }}>R$ 0,00</span>
                        )}
                      </div>
                      <div className="px-4 py-3.5 text-center">
                        {(r.extraBonusValue ?? 0) > 0 ? (
                          <span className="font-black px-2.5 py-1 rounded-lg" style={{ backgroundColor: "var(--secondary)" }}>{fmtBRL(r.extraBonusValue ?? 0)}</span>
                        ) : (
                          <span className="font-bold" style={{ color: "var(--muted-foreground)" }}>R$ 0,00</span>
                        )}
                      </div>
                      <div className="px-4 py-3.5 text-center">
                        {statusInfo ? (
                          <span className="text-[10px] uppercase font-black px-2.5 py-1 rounded-full" style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}>{statusInfo.label}</span>
                        ) : (
                          <span style={{ color: "var(--muted-foreground)" }}>—</span>
                        )}
                      </div>
                      {canManage && (
                        <div className="px-4 py-3.5 text-center">
                          {r.id != null && (
                            <button
                              data-testid={`button-payment-${r.employeeId}`}
                              className="p-2 rounded-lg transition-colors hover:opacity-80"
                              style={{ color: "var(--muted-foreground)", border: "1px solid transparent" }}
                              onClick={(e) => { e.stopPropagation(); openPayment(r); }}
                            >
                              <Wallet size={15} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!payTarget} onOpenChange={o => !o && setPayTarget(null)}>
        <DialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Gestão de Pagamento</DialogTitle>
            <p className="text-sm font-bold uppercase mt-1" style={{ color: "var(--muted-foreground)" }}>{payTarget?.employeeName}</p>
          </DialogHeader>
          <div className="rounded-lg p-4 flex items-center justify-between mb-2 mt-4" style={{ backgroundColor: "var(--primary)" }}>
            <span className="text-xs font-black uppercase tracking-wide" style={{ color: "var(--primary-foreground)" }}>Valor do Bônus</span>
            <span className="text-2xl font-black" style={{ fontFamily: CONDENSED, color: "var(--primary-foreground)" }}>{payTarget ? fmtBRL(payTarget.bonusValue) : "R$ 0,00"}</span>
          </div>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="font-bold uppercase text-xs tracking-wide" style={{ color: "var(--muted-foreground)" }}>Status do Bônus</Label>
              <Select value={payForm.bonusStatus} onValueChange={v => setPayForm(f => ({ ...f, bonusStatus: v }))}>
                <SelectTrigger data-testid="select-bonus-status" className="h-11 rounded-lg font-bold" style={fieldStyle}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BONUS_STATUS_OPTIONS.map(s => (
                    <SelectItem key={s} value={s} className="font-medium">{BONUS_STATUS_LABELS[s]?.label ?? s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold uppercase text-xs tracking-wide" style={{ color: "var(--muted-foreground)" }}>Método de Pagamento</Label>
              <Input
                data-testid="input-payment-method"
                value={payForm.paymentMethod}
                onChange={e => setPayForm(f => ({ ...f, paymentMethod: e.target.value }))}
                className="h-11 rounded-lg"
                style={fieldStyle}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold uppercase text-xs tracking-wide" style={{ color: "var(--muted-foreground)" }}>Observações (Opcional)</Label>
              <Textarea
                data-testid="input-payment-notes"
                value={payForm.paymentNotes}
                onChange={e => setPayForm(f => ({ ...f, paymentNotes: e.target.value }))}
                placeholder="Detalhes adicionais sobre o pagamento..."
                className="resize-none rounded-lg"
                style={fieldStyle}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 mt-2" style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={() => setPayTarget(null)} className="rounded-lg px-4 py-2.5 font-bold text-xs uppercase tracking-wide transition-colors hover:opacity-80" style={{ border: "1px solid var(--border)" }}>Cancelar</button>
              <button
                data-testid="button-save-payment"
                onClick={savePayment}
                disabled={paymentMutation.isPending}
                className="rounded-lg px-4 py-2.5 font-bold text-xs uppercase tracking-wide transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                {paymentMutation.isPending ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EmployeeDetailSheet employeeId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PAGE                                                                */
/* ------------------------------------------------------------------ */

export default function ResultsPage() {
  const { user } = useAuth();
  const isManager = !!user && ["admin", "rh", "diretoria"].includes(user.role);
  const canManage = !!user && ["admin", "rh", "diretoria"].includes(user.role);
  const [tab, setTab] = useState("ranking");

  return (
    <div className="min-h-full" style={{ backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: BODY }}>
      <div className="p-6 md:p-10 space-y-7">
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <h1 data-testid="text-page-title" className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-none" style={{ fontFamily: CONDENSED }}>
              Resultados &amp; Ranking
            </h1>
            <p className="text-[11px] font-bold uppercase tracking-wide mt-1.5" style={{ color: "var(--muted-foreground)" }}>Classificação geral do ciclo</p>
          </div>
          <CycleBadge />
        </section>

        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="rounded-lg p-1 h-auto flex-wrap gap-1 w-fit" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <TabsTrigger
              value="ranking"
              data-testid="tab-ranking"
              className="rounded-md font-bold uppercase text-xs tracking-wide px-4 py-2 flex items-center gap-2 shadow-none data-[state=active]:shadow-none"
              style={{ fontFamily: CONDENSED, backgroundColor: tab === "ranking" ? "var(--primary)" : "transparent", color: tab === "ranking" ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
            >
              <ListOrdered size={14} /> Ranking
            </TabsTrigger>
            <TabsTrigger
              value="consolidacao"
              data-testid="tab-consolidacao"
              className="rounded-md font-bold uppercase text-xs tracking-wide px-4 py-2 flex items-center gap-2 shadow-none data-[state=active]:shadow-none"
              style={{ fontFamily: CONDENSED, backgroundColor: tab === "consolidacao" ? "var(--primary)" : "transparent", color: tab === "consolidacao" ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
            >
              <Table2 size={14} /> Consolidação
            </TabsTrigger>
            {isManager && (
              <TabsTrigger
                value="bonus"
                data-testid="tab-bonus"
                className="rounded-md font-bold uppercase text-xs tracking-wide px-4 py-2 flex items-center gap-2 shadow-none data-[state=active]:shadow-none"
                style={{ fontFamily: CONDENSED, backgroundColor: tab === "bonus" ? "var(--primary)" : "transparent", color: tab === "bonus" ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
              >
                <Wallet size={14} /> Bônus &amp; Pagamentos
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="ranking" className="mt-0">
            <RankingTab canViewDetail={true} />
          </TabsContent>
          <TabsContent value="consolidacao" className="mt-0">
            <ConsolidationTab isManager={isManager} />
          </TabsContent>
          {isManager && (
            <TabsContent value="bonus" className="mt-0">
              <PaymentsTab canManage={canManage} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
