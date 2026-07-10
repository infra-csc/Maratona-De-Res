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

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";
const HARD_SHADOW_HOVER = "transition-all hover:shadow-[2px_2px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px]";

const BONUS_STATUS_LABELS: Record<string, { label: string; class: string }> = {
  projected: { label: "Projetado", class: "bg-[#eceef0] text-[#444933]" },
  approved: { label: "Aprovado", class: "bg-[#191c1e] text-[#ccff00]" },
  scheduled: { label: "Agendado", class: "bg-[#ffb5a0] text-[#3b0900]" },
  paid: { label: "Pago", class: "bg-[#ccff00] text-[#161e00]" },
  blocked: { label: "Bloqueado", class: "bg-[#ff5722] text-white" },
  not_eligible: { label: "Não elegível", class: "bg-[#eceef0] text-[#747a60]" },
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
  if (!active) return <ArrowUpDown size={12} className="text-[#747a60] opacity-50" />;
  return dir === "asc" ? <ArrowUp size={12} className="text-[#191c1e]" /> : <ArrowDown size={12} className="text-[#191c1e]" />;
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

const fmtScore = (v: number) => v.toFixed(1);
const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtBRLShort = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function FaixaBadge({ minScore, maxScore, color }: { minScore?: number | null; maxScore?: number | null; color?: string | null }) {
  if (minScore == null && maxScore == null) return <span className="text-[#c4c9ac] font-bold italic">—</span>;
  const bg = color ?? "#eceef0";
  const isDark = bg === "#191c1e" || bg.toLowerCase() === "#000000";
  const fgClass = isDark ? "text-[#ccff00]" : "text-[#191c1e]";
  const label = minScore != null && maxScore != null
    ? `${minScore}–${maxScore}`
    : minScore != null ? `≥ ${minScore}` : `≤ ${maxScore}`;
  return (
    <span
      className={`inline-block text-[10px] font-black italic uppercase px-2 py-0.5 border-2 border-[#191c1e] skew-x-[-6deg] ${fgClass}`}
      style={{ backgroundColor: bg }}
    >
      <span className="inline-block skew-x-[6deg]">{label}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* RANKING TAB                                                         */
/* ------------------------------------------------------------------ */

const PODIUM_THEME: Record<number, { bg: string; accent: string; label: string }> = {
  1: { bg: "bg-[#ccff00]", accent: "text-[#191c1e]", label: "Ouro" },
  2: { bg: "bg-white", accent: "text-[#506600]", label: "Prata" },
  3: { bg: "bg-white", accent: "text-[#506600]", label: "Bronze" },
};

function PodiumRow({ entry, rank, onClick, clickable }: { entry: any; rank: number; onClick: () => void; clickable: boolean }) {
  const theme = PODIUM_THEME[rank];
  const isLeader = rank === 1;
  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      data-testid={`podium-card-${entry.employeeId}`}
      className={cn(
        "w-full text-left border-[#191c1e] flex items-center gap-4 p-4 border-2",
        theme.bg,
        isLeader && `border-4 ${HARD_SHADOW}`,
        clickable && HARD_SHADOW_HOVER,
        clickable && "cursor-pointer",
      )}
    >
      <div className={cn("font-black italic shrink-0 leading-none", isLeader ? "text-4xl text-[#191c1e]" : "text-3xl text-[#747a60]")}>
        #{rank}
      </div>
      <div className="relative shrink-0">
        <div className={cn("border-2 border-[#191c1e] bg-[#e0e3e5] flex items-center justify-center skew-x-[-6deg] overflow-hidden", isLeader ? "w-16 h-16" : "w-14 h-14")}>
          <span className="skew-x-[6deg] font-black italic text-lg">{initials(entry.employeeName)}</span>
        </div>
        {isLeader && (
          <div className="absolute -top-2 -right-2 bg-[#191c1e] text-[#ccff00] w-6 h-6 flex items-center justify-center border-2 border-[#ccff00] skew-x-[-8deg]">
            <Crown size={12} className="skew-x-[8deg]" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm italic uppercase font-black tracking-tight break-words" data-testid={`text-podium-name-${entry.employeeId}`}>{entry.employeeName}</h3>
      </div>
      <div className="text-right shrink-0">
        <span className="block text-[9px] uppercase font-bold italic text-[#747a60] leading-none mb-1">{theme.label}</span>
        <p className={cn("italic font-black leading-none", isLeader ? "text-2xl text-[#191c1e]" : `text-xl ${theme.accent}`)} data-testid={`text-podium-result-${entry.employeeId}`}>
          {entry.finalResult.toFixed(1)}
        </p>
      </div>
    </button>
  );
}

function RankingTab({ canViewDetail }: { canViewDetail: boolean }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterEligible, setFilterEligible] = useState<"all" | "eligible" | "ineligible">("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const qKey = getGetRankingQueryKey({ search: search || undefined });
  const { data: ranking, isLoading } = useGetRanking({ search: search || undefined }, { query: { queryKey: qKey } });

  const detailParams = { employeeId: selectedId ?? 0 };
  const { data: detail, isLoading: detailLoading } = useGetRankingDetail(detailParams, {
    query: { queryKey: getGetRankingDetailQueryKey(detailParams), enabled: !!selectedId && canViewDetail },
  });

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
  // Só entram na média colaboradores com pelo menos 1 evento pontuado no ciclo
  // (eventsCount > 0) — mesmo critério do "Média do Ciclo" no Dashboard. Quem
  // ainda não tem nota (0 eventos fechados/pontuados) tem finalResult=0 "por
  // enquanto" e distorceria a média para baixo mesmo sem ninguém ter ido mal.
  const scoredRanking = filteredRanking.filter(r => r.eventsCount > 0);
  const avgResult = scoredRanking.length > 0 ? scoredRanking.reduce((acc, r) => acc + r.finalResult, 0) / scoredRanking.length : 0;

  function openDetail(id: number) {
    if (!canViewDetail) return;
    setSelectedId(id);
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {ranking && ranking.length > 0 && (
          <div className="flex gap-4">
            <div className={`bg-[#ccff00] border-2 border-[#191c1e] p-4 skew-x-[-6deg] ${HARD_SHADOW}`}>
              <div className="skew-x-[6deg]">
                <span className="text-[11px] font-bold uppercase italic tracking-wider block flex items-center gap-1.5"><Trophy size={12} /> Nota Média</span>
                <span className="text-2xl md:text-3xl italic font-black block mt-1" data-testid="stat-avg-result">{avgResult.toFixed(1)}</span>
              </div>
            </div>
            <div className="bg-white border-2 border-[#191c1e] p-4 skew-x-[-6deg]">
              <div className="skew-x-[6deg]">
                <span className="text-[11px] font-bold uppercase italic tracking-wider text-[#444933] block flex items-center gap-1.5"><Users size={12} /> Competidores</span>
                <span className="text-2xl md:text-3xl italic font-black block mt-1" data-testid="stat-active-runners">{activeRunners}</span>
              </div>
            </div>
          </div>
        )}
        <button
          data-testid="button-export-ranking"
          className={`bg-[#ccff00] border-2 border-[#191c1e] px-6 py-2.5 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 justify-center md:ml-auto ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
          onClick={handleExport}
        >
          <Download size={16} /> Exportar
        </button>
      </section>

      {isLoading ? (
        <div className="text-center py-24 italic uppercase font-bold text-[#747a60]">Carregando ranking...</div>
      ) : !ranking || ranking.length === 0 ? (
        <div className="text-center py-20 bg-white border-2 border-[#191c1e]">
          <Trophy size={64} className="mx-auto mb-6 text-[#e0e3e5]" strokeWidth={1.5} />
          <h3 className="text-2xl italic uppercase font-black tracking-tight mb-2">Ranking Indisponível</h3>
          <p className="text-[#444933] italic font-medium">Nenhum resultado consolidado para o ciclo atual.</p>
          <p className="text-sm mt-1 text-[#747a60] italic">Feche o ciclo na aba "Bônus & Pagamentos" para gerar o ranking oficial.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-5">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative max-w-md flex-1">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747a60]" />
                <Input
                  data-testid="input-search-ranking"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-10 h-12 rounded-none border-2 border-[#191c1e] bg-white italic font-medium focus-visible:ring-0"
                  placeholder="Buscar colaborador no ranking..."
                />
              </div>
              <div className="flex gap-3">
                <div className="w-48">
                  <Select value={filterEligible} onValueChange={(v) => setFilterEligible(v as any)}>
                    <SelectTrigger className="h-12 rounded-none border-2 border-[#191c1e] bg-white italic font-medium focus:ring-0">
                      <SelectValue placeholder="Elegibilidade" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border-2 border-[#191c1e]">
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="eligible">Elegíveis</SelectItem>
                      <SelectItem value="ineligible">Não elegíveis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <section className="bg-white border-2 border-[#191c1e]">
              <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center gap-3 italic">
                <span className="w-3 h-6 bg-[#ccff00] inline-block skew-x-[-12deg]" />
                <h3 className="text-xs font-bold uppercase tracking-widest">Classificação Geral</h3>
              </div>
              <div className="divide-y-2 divide-[#eceef0]">
                {filteredRanking.map((entry) => {
                  const actualRank = entry.position;
                  // Barra em escala absoluta (Nota Final já é 0–100) — mostra
                  // o aproveitamento real da pessoa, não uma comparação com o
                  // 1º colocado do filtro atual (que gerava 100% "cheio" para
                  // vários empatados e confundia quem via o gráfico).
                  const scorePct = Math.max(0, Math.min(100, entry.finalResult));
                  return (
                    <button
                      type="button"
                      key={entry.employeeId}
                      data-testid={`card-ranking-${entry.employeeId}`}
                      onClick={() => openDetail(entry.employeeId)}
                      className={cn(
                        "w-full text-left flex flex-col sm:flex-row sm:items-center gap-4 px-5 md:px-6 py-4 transition-all group",
                        canViewDetail ? "hover:bg-[#f2f4f6] hover:translate-x-1 cursor-pointer" : "cursor-default",
                      )}
                    >
                      <div className={cn("w-14 h-14 border-2 border-[#191c1e] bg-[#eceef0] flex flex-col items-center justify-center skew-x-[-6deg] shrink-0 transition-colors", canViewDetail && "group-hover:bg-[#ccff00]")}>
                        <span className="skew-x-[6deg] text-[9px] font-bold uppercase italic text-[#747a60] leading-none">Pos</span>
                        <span className="skew-x-[6deg] text-xl font-black italic leading-none mt-0.5">{String(actualRank).padStart(2, "0")}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black italic uppercase text-base md:text-lg break-words" data-testid={`text-employee-name-${entry.employeeId}`}>{entry.employeeName}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <span className="text-[11px] font-bold uppercase italic text-[#444933] border-2 border-[#191c1e] px-2 py-0.5 skew-x-[-8deg] inline-block">
                            <span className="inline-block skew-x-[8deg]">{entry.eventsCount} eventos</span>
                          </span>
                          {entry.absences > 0 && (
                            <span className="text-[11px] font-bold uppercase italic text-white bg-[#ba1a1a] border-2 border-[#191c1e] px-2 py-0.5 skew-x-[-8deg] inline-block">
                              <span className="inline-block skew-x-[8deg]">{entry.absences} penalidades</span>
                            </span>
                          )}
                          <FaixaBadge minScore={entry.platoonMinScore} maxScore={entry.platoonMaxScore} color={entry.platoonColor} />
                        </div>
                      </div>
                      <div className="hidden md:flex items-center gap-3 w-40 shrink-0">
                        <div className="flex-1 h-2.5 bg-[#eceef0] border border-[#191c1e]">
                          <div className="h-full bg-[#ccff00]" style={{ width: `${scorePct}%` }} />
                        </div>
                        <span className="text-[11px] font-bold italic w-14 text-right whitespace-nowrap">{fmtScore(entry.finalResult)}/100</span>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 sm:pl-4 sm:w-[17rem] sm:justify-end">
                        <div className="text-right">
                          <span className="block text-[9px] uppercase font-bold italic text-[#747a60] leading-none mb-1">Nota Final</span>
                          <p className="font-black italic text-2xl text-[#506600] leading-none" data-testid={`text-final-result-${entry.employeeId}`}>{fmtScore(entry.finalResult)}</p>
                        </div>
                        <div className="text-right hidden sm:block w-28 shrink-0">
                          {entry.bonusValue > 0 && (
                            <div className="bg-[#ccff00] border-2 border-[#191c1e] px-3 py-1.5 skew-x-[-6deg]">
                              <div className="skew-x-[6deg]">
                                <span className="block text-[9px] uppercase font-bold italic text-[#161e00] leading-none mb-1">Bônus</span>
                                <p className="font-black italic text-base text-[#191c1e] leading-none">{fmtBRLShort(entry.bonusValue)}</p>
                              </div>
                            </div>
                          )}
                        </div>
                        {canViewDetail && <ChevronRight size={18} className="text-[#747a60] group-hover:text-[#191c1e] transition-colors shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="lg:col-span-1 lg:sticky lg:top-6 space-y-4">
            <div className="bg-[#191c1e] text-[#ccff00] px-5 py-3 flex items-center gap-2 italic border-2 border-[#191c1e]">
              <Trophy size={16} />
              <h3 className="text-xs font-bold uppercase tracking-widest">Pódio da Maratona</h3>
            </div>
            {top3[0] && <PodiumRow entry={top3[0]} rank={1} clickable={canViewDetail} onClick={() => openDetail(top3[0].employeeId)} />}
            {top3[1] && <PodiumRow entry={top3[1]} rank={2} clickable={canViewDetail} onClick={() => openDetail(top3[1].employeeId)} />}
            {top3[2] && <PodiumRow entry={top3[2]} rank={3} clickable={canViewDetail} onClick={() => openDetail(top3[2].employeeId)} />}
            {canViewDetail && (
              <p className="text-[11px] italic text-[#747a60] font-medium px-1">Clique em um colaborador para ver o detalhamento de provas, penalidades e méritos.</p>
            )}
          </aside>
        </div>
      )}

      <Sheet open={!!selectedId} onOpenChange={(o) => { if (!o) setSelectedId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto rounded-none border-l-4 border-[#191c1e] bg-[#f7f9fb] p-0">
          {detailLoading || !detail ? (
            <div className="p-10 text-center italic uppercase font-bold text-[#747a60]">Carregando detalhamento...</div>
          ) : (
            <div>
              <SheetHeader className="bg-[#191c1e] text-white p-6 space-y-3 text-left">
                <SheetTitle className="text-white text-2xl italic uppercase font-black tracking-tight leading-none">
                  {detail.employee.name}
                </SheetTitle>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase italic">
                  {detail.employee.functionName && (
                    <span className="border-2 border-[#ccff00] text-[#ccff00] px-2 py-0.5">{detail.employee.functionName}</span>
                  )}
                  <span className="text-[#9da3a8]">{detail.cycle.name}</span>
                </div>
              </SheetHeader>

              <div className="p-6 space-y-8">
                <section className="grid grid-cols-2 gap-3">
                  <div className={`bg-[#ccff00] border-2 border-[#191c1e] p-4 ${HARD_SHADOW}`}>
                    <span className="text-[10px] font-bold uppercase italic text-[#161e00] block">Nota Final</span>
                    <p className="text-3xl font-black italic leading-none mt-1" data-testid="detail-final-result">
                      {detail.summary.finalResult != null ? detail.summary.finalResult.toFixed(1) : "—"}
                    </p>
                  </div>
                  <div className="bg-white border-2 border-[#191c1e] p-4">
                    <span className="text-[10px] font-bold uppercase italic text-[#747a60] block">Média Bruta</span>
                    <p className="text-3xl font-black italic leading-none mt-1 text-[#506600]">
                      {detail.summary.grossAverage != null ? detail.summary.grossAverage.toFixed(1) : "—"}
                    </p>
                  </div>
                  <div className="bg-white border-2 border-[#191c1e] p-3 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-[#ff5722] shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold uppercase italic text-[#747a60] block leading-none">Penalidades</span>
                      <p className="text-lg font-black italic leading-none text-[#ff5722]">-{detail.summary.penaltyPoints}</p>
                    </div>
                  </div>
                  <div className="bg-white border-2 border-[#191c1e] p-3 flex items-center gap-2">
                    <Award size={18} className="text-[#506600] shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold uppercase italic text-[#747a60] block leading-none">Méritos</span>
                      <p className="text-lg font-black italic leading-none text-[#506600]">+{detail.summary.meritPoints}</p>
                    </div>
                  </div>
                </section>

                {!detail.summary.isQuarterClosed && (
                  <div className="bg-[#fff3cd] border-2 border-[#191c1e] px-4 py-3 text-xs font-bold italic uppercase text-[#664d03]">
                    Ciclo ainda não fechado — valores parciais.
                  </div>
                )}

                <section className="space-y-3">
                  <h4 className="text-sm font-black italic uppercase tracking-tight flex items-center gap-2">
                    <Trophy size={16} /> Desempenho nas Provas
                  </h4>
                  {detail.events.filter(ev => ev.resultsConfirmed).length === 0 ? (
                    <p className="text-sm italic text-[#747a60] font-medium">Nenhum evento confirmado no ciclo.</p>
                  ) : (
                    <div className="space-y-2">
                      {detail.events.filter(ev => ev.resultsConfirmed).map(ev => (
                        <div key={ev.eventId} data-testid={`detail-event-${ev.eventId}`} className={cn("bg-white border-2 border-[#191c1e] p-3 flex items-center gap-3", !ev.countsForScore && "opacity-70")}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-black italic uppercase text-sm">{ev.eventName}</p>
                              {!ev.countsForScore && (
                                <span
                                  data-testid={`detail-event-no-score-${ev.eventId}`}
                                  className="px-1.5 py-0.5 border-2 border-[#862200] bg-[#862200]/10 text-[#862200] font-bold text-[9px] italic uppercase skew-x-[-8deg] inline-block shrink-0"
                                  title={(ev as { noScoreReason?: string }).noScoreReason === "sup_ceno" ? `Função: ${(ev as { participationFunction?: string }).participationFunction ?? "Sup Ceno"} — participação informativa, não entra na nota.` : (ev as { noScoreReason?: string }).noScoreReason === "freela" ? "Freela — não entra na nota." : "Participação informativa — não entra na nota."}
                                >
                                  <span className="inline-block skew-x-[8deg]">
                                    {(ev as { noScoreReason?: string }).noScoreReason === "sup_ceno"
                                      ? `Sup Ceno — não conta p/ nota`
                                      : (ev as { noScoreReason?: string }).noScoreReason === "freela"
                                      ? "Freela — não conta p/ nota"
                                      : "Não conta p/ nota"}
                                  </span>
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] font-bold italic text-[#747a60]">
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
                            <span className="block text-[9px] uppercase font-bold italic text-[#747a60] leading-none mb-1">Nota Time</span>
                            <p className="text-xl font-black italic leading-none text-[#506600]">{ev.eventScore.toFixed(1)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="space-y-3">
                  <h4 className="text-sm font-black italic uppercase tracking-tight flex items-center gap-2 text-[#ff5722]">
                    <AlertTriangle size={16} /> Penalidades
                  </h4>
                  {detail.penalties.length === 0 ? (
                    <p className="text-sm italic text-[#747a60] font-medium">Sem penalidades no ciclo.</p>
                  ) : (
                    <div className="space-y-2">
                      {detail.penalties.map(p => (
                        <div key={p.id} data-testid={`detail-penalty-${p.id}`} className="bg-white border-2 border-[#191c1e] p-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-black italic uppercase text-sm">{p.label}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] font-bold italic text-[#747a60]">
                              <span>{new Date(p.date).toLocaleDateString("pt-BR")}</span>
                              {p.eventName && <span>· {p.eventName}</span>}
                              {p.quantity > 1 && <span>· {p.quantity}x</span>}
                            </div>
                          </div>
                          <span className="bg-[#ff5722] text-white font-black px-3 py-1 border-2 border-[#191c1e] text-xs shrink-0">-{p.total}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="space-y-3">
                  <h4 className="text-sm font-black italic uppercase tracking-tight flex items-center gap-2 text-[#506600]">
                    <Award size={16} /> Méritos
                  </h4>
                  {detail.merits.length === 0 ? (
                    <p className="text-sm italic text-[#747a60] font-medium">Sem méritos no ciclo.</p>
                  ) : (
                    <div className="space-y-2">
                      {detail.merits.map(m => (
                        <div key={m.id} data-testid={`detail-merit-${m.id}`} className="bg-white border-2 border-[#191c1e] p-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-black italic uppercase text-sm">{m.label}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] font-bold italic text-[#747a60]">
                              <span>{new Date(m.date).toLocaleDateString("pt-BR")}</span>
                              {m.eventName && <span>· {m.eventName}</span>}
                              {m.quantity > 1 && <span>· {m.quantity}x</span>}
                            </div>
                          </div>
                          <span className="bg-[#ccff00] text-[#191c1e] font-black px-3 py-1 border-2 border-[#191c1e] text-xs shrink-0">+{m.total}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {detail.summary.bonusValue != null && detail.summary.bonusValue > 0 && (
                  <section className={`bg-[#ccff00] border-2 border-[#191c1e] p-4 flex items-center justify-between ${HARD_SHADOW}`}>
                    <span className="text-xs font-black uppercase italic tracking-wider">Bônus do Ciclo</span>
                    <span className="text-2xl font-black italic">{fmtBRL(detail.summary.bonusValue)}</span>
                  </section>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CONSOLIDAÇÃO TAB                                                    */
/* ------------------------------------------------------------------ */

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
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto rounded-none border-l-4 border-[#191c1e] bg-[#f7f9fb] p-0">
        {detailLoading || !detail ? (
          <div className="p-10 text-center italic uppercase font-bold text-[#747a60]">Carregando detalhamento...</div>
        ) : (
          <div>
            <SheetHeader className="bg-[#191c1e] text-white p-6 space-y-3 text-left">
              <SheetTitle className="text-white text-2xl italic uppercase font-black tracking-tight leading-none">
                {detail.employee.name}
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase italic">
                {detail.employee.functionName && (
                  <span className="border-2 border-[#ccff00] text-[#ccff00] px-2 py-0.5">{detail.employee.functionName}</span>
                )}
                <span className="text-[#9da3a8]">{detail.cycle.name}</span>
              </div>
            </SheetHeader>

            <div className="p-6 space-y-8">
              <section className="grid grid-cols-2 gap-3">
                <div className={`bg-[#ccff00] border-2 border-[#191c1e] p-4 ${HARD_SHADOW}`}>
                  <span className="text-[10px] font-bold uppercase italic text-[#161e00] block">Nota Final</span>
                  <p className="text-3xl font-black italic leading-none mt-1" data-testid="detail-final-result">
                    {detail.summary.finalResult != null ? detail.summary.finalResult.toFixed(1) : "—"}
                  </p>
                </div>
                <div className="bg-white border-2 border-[#191c1e] p-4">
                  <span className="text-[10px] font-bold uppercase italic text-[#747a60] block">Média Bruta</span>
                  <p className="text-3xl font-black italic leading-none mt-1 text-[#506600]">
                    {detail.summary.grossAverage != null ? detail.summary.grossAverage.toFixed(1) : "—"}
                  </p>
                </div>
                <div className="bg-white border-2 border-[#191c1e] p-3 flex items-center gap-2">
                  <AlertTriangle size={18} className="text-[#ff5722] shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold uppercase italic text-[#747a60] block leading-none">Penalidades</span>
                    <p className="text-lg font-black italic leading-none text-[#ff5722]">-{detail.summary.penaltyPoints}</p>
                  </div>
                </div>
                <div className="bg-white border-2 border-[#191c1e] p-3 flex items-center gap-2">
                  <Award size={18} className="text-[#506600] shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold uppercase italic text-[#747a60] block leading-none">Méritos</span>
                    <p className="text-lg font-black italic leading-none text-[#506600]">+{detail.summary.meritPoints}</p>
                  </div>
                </div>
              </section>

              {!detail.summary.isQuarterClosed && (
                <div className="bg-[#fff3cd] border-2 border-[#191c1e] px-4 py-3 text-xs font-bold italic uppercase text-[#664d03]">
                  Ciclo ainda não fechado — valores parciais.
                </div>
              )}

              <section className="space-y-3">
                <h4 className="text-sm font-black italic uppercase tracking-tight flex items-center gap-2">
                  <Trophy size={16} /> Desempenho nas Provas
                </h4>
                {detail.events.filter(ev => ev.resultsConfirmed).length === 0 ? (
                  <p className="text-sm italic text-[#747a60] font-medium">Nenhum evento confirmado no ciclo.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.events.filter(ev => ev.resultsConfirmed).map(ev => (
                      <div key={ev.eventId} data-testid={`detail-event-${ev.eventId}`} className={cn("bg-white border-2 border-[#191c1e] p-3 flex items-center gap-3", !ev.countsForScore && "opacity-70")}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-black italic uppercase text-sm">{ev.eventName}</p>
                            {!ev.countsForScore && (
                              <span
                                data-testid={`detail-event-no-score-${ev.eventId}`}
                                className="px-1.5 py-0.5 border-2 border-[#862200] bg-[#862200]/10 text-[#862200] font-bold text-[9px] italic uppercase skew-x-[-8deg] inline-block shrink-0"
                                title={(ev as { noScoreReason?: string }).noScoreReason === "sup_ceno" ? `Função: ${(ev as { participationFunction?: string }).participationFunction ?? "Sup Ceno"} — participação informativa, não entra na nota.` : (ev as { noScoreReason?: string }).noScoreReason === "freela" ? "Freela — não entra na nota." : "Participação informativa — não entra na nota."}
                              >
                                <span className="inline-block skew-x-[8deg]">
                                  {(ev as { noScoreReason?: string }).noScoreReason === "sup_ceno"
                                    ? `Sup Ceno — não conta p/ nota`
                                    : (ev as { noScoreReason?: string }).noScoreReason === "freela"
                                    ? "Freela — não conta p/ nota"
                                    : "Não conta p/ nota"}
                                </span>
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] font-bold italic text-[#747a60]">
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
                          <span className="block text-[9px] uppercase font-bold italic text-[#747a60] leading-none mb-1">Nota Time</span>
                          <p className="text-xl font-black italic leading-none text-[#506600]">{ev.eventScore.toFixed(1)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-black italic uppercase tracking-tight flex items-center gap-2 text-[#ff5722]">
                  <AlertTriangle size={16} /> Penalidades
                </h4>
                {detail.penalties.length === 0 ? (
                  <p className="text-sm italic text-[#747a60] font-medium">Sem penalidades no ciclo.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.penalties.map(p => (
                      <div key={p.id} data-testid={`detail-penalty-${p.id}`} className="bg-white border-2 border-[#191c1e] p-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-black italic uppercase text-sm">{p.label}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] font-bold italic text-[#747a60]">
                            <span>{new Date(p.date).toLocaleDateString("pt-BR")}</span>
                            {p.eventName && <span>· {p.eventName}</span>}
                            {p.quantity > 1 && <span>· {p.quantity}x</span>}
                          </div>
                        </div>
                        <span className="bg-[#ff5722] text-white font-black px-3 py-1 border-2 border-[#191c1e] text-xs shrink-0">-{p.total}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-black italic uppercase tracking-tight flex items-center gap-2 text-[#506600]">
                  <Award size={16} /> Méritos
                </h4>
                {detail.merits.length === 0 ? (
                  <p className="text-sm italic text-[#747a60] font-medium">Sem méritos no ciclo.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.merits.map(m => (
                      <div key={m.id} data-testid={`detail-merit-${m.id}`} className="bg-white border-2 border-[#191c1e] p-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-black italic uppercase text-sm">{m.label}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] font-bold italic text-[#747a60]">
                            <span>{new Date(m.date).toLocaleDateString("pt-BR")}</span>
                            {m.eventName && <span>· {m.eventName}</span>}
                            {m.quantity > 1 && <span>· {m.quantity}x</span>}
                          </div>
                        </div>
                        <span className="bg-[#ccff00] text-[#191c1e] font-black px-3 py-1 border-2 border-[#191c1e] text-xs shrink-0">+{m.total}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {detail.summary.bonusValue != null && detail.summary.bonusValue > 0 && (
                <section className={`bg-[#ccff00] border-2 border-[#191c1e] p-4 flex items-center justify-between ${HARD_SHADOW}`}>
                  <span className="text-xs font-black uppercase italic tracking-wider">Bônus do Ciclo</span>
                  <span className="text-2xl font-black italic">{fmtBRL(detail.summary.bonusValue)}</span>
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
    <th
      className={cn(
        "px-5 py-4 text-xs font-bold uppercase italic text-[#444933] cursor-pointer select-none hover:bg-[#e0e3e5] transition-colors",
        align === "center" && "text-center"
      )}
      onClick={() => handleSort(key)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <SortIcon active={sortKey === key} dir={sortDir} />
      </span>
    </th>
  );

  return (
    <div className="space-y-6">
      {isManager && (
        <div className="flex justify-end">
          <button
            data-testid="button-export-consolidation"
            onClick={handleExport}
            className={`bg-white border-2 border-[#191c1e] px-5 py-3 font-bold text-xs italic uppercase tracking-wider flex items-center gap-2 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
          >
            <Download size={15} /> Exportar
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-20 text-[#747a60] italic uppercase font-bold">Carregando consolidação...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-24 bg-white border-2 border-dashed border-[#191c1e]">
          <Table2 size={48} className="mx-auto mb-4 opacity-20" />
          <h3 className="text-xl font-black italic uppercase tracking-tight text-[#191c1e] mb-1">Nenhum dado consolidado</h3>
          <p className="text-[#747a60] italic max-w-md mx-auto">Não há resultados gerados para o ciclo atual.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative max-w-md flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747a60]" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 h-12 rounded-none border-2 border-[#191c1e] bg-white italic font-medium focus-visible:ring-0"
                placeholder="Buscar colaborador..."
              />
            </div>
          </div>

          <div className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
            <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center gap-2 italic">
              <Table2 size={18} />
              <span className="font-black uppercase tracking-tight">Planilha de Consolidação</span>
            </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-[#191c1e] bg-[#eceef0]">
                  {headerCell("Colaborador", "employeeName", "left")}
                  {headerCell("Soma das Notas", "scoreSum")}
                  {headerCell("Eventos c/ Nota", "eventsCount")}
                  {headerCell("Eventos Participados", "participatedEventsCount")}
                  {headerCell("Penalidades / Méritos", "absencePenalty")}
                  {headerCell("Média (Nota Final)", "finalResult")}
                  {headerCell("Faixa", "platoon")}
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#eceef0]">
                {sortedRows.map((r) => {
                  const penalty = r.absencePenalty ?? 0;
                  const merit = r.meritPoints ?? 0;
                  const net = Math.round((merit - penalty) * 10) / 10;
                  return (
                    <tr
                      key={r.employeeId}
                      data-testid={`row-consolidation-${r.employeeId}`}
                      className="hover:bg-[#f2f4f6] transition-all cursor-pointer"
                      onClick={() => setSelectedId(r.employeeId)}
                    >
                      <td className="px-5 py-4">
                        <div className="font-black italic uppercase text-sm text-[#191c1e]">{r.employeeName}</div>
                      </td>
                      <td className="px-5 py-4 text-center font-black italic text-[#506600]">{fmtScore(r.scoreSum ?? 0)}</td>
                      <td className="px-5 py-4 text-center">
                        <span className="text-[11px] font-bold italic uppercase text-[#444933] bg-[#eceef0] border-2 border-[#191c1e] px-2 py-0.5">{r.eventsCount ?? 0}</span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={cn(
                          "text-[11px] font-bold italic uppercase border-2 border-[#191c1e] px-2 py-0.5",
                          (r.participatedEventsCount ?? 0) > (r.eventsCount ?? 0)
                            ? "text-white bg-[#ff8c00]"
                            : "text-[#161e00] bg-[#ccff00]"
                        )} title={(r.participatedEventsCount ?? 0) > (r.eventsCount ?? 0) ? "Participou em mais eventos do que os que entraram na nota" : undefined}>
                          {r.participatedEventsCount ?? 0}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        {net < 0 ? (
                          <span className="text-xs font-black italic text-white bg-[#ff5722] border-2 border-[#191c1e] px-2 py-0.5">-{Math.abs(net)}</span>
                        ) : net > 0 ? (
                          <span className="text-xs font-black italic text-[#161e00] bg-[#ccff00] border-2 border-[#191c1e] px-2 py-0.5">+{net}</span>
                        ) : (
                          <span className="text-[#c4c9ac] font-bold italic">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="inline-flex items-baseline gap-1">
                          <span className="font-black italic text-2xl text-[#191c1e] leading-none">{fmtScore(r.finalResult)}</span>
                          <span className="text-[10px] font-bold italic text-[#747a60] uppercase">/100</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <FaixaBadge minScore={r.platoonMinScore} maxScore={r.platoonMaxScore} color={r.platoonColor} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
    <th
      className={cn(
        "px-6 py-4 text-xs font-bold uppercase italic text-[#444933] cursor-pointer select-none hover:bg-[#e0e3e5] transition-colors",
        align === "center" && "text-center"
      )}
      onClick={() => handleSort(key)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <SortIcon active={sortKey === key} dir={sortDir} />
      </span>
    </th>
  );

  return (
    <div className="space-y-8">
      <section className="flex gap-3 items-center flex-wrap justify-end">
        <button
          data-testid="button-export-results"
          onClick={handleExport}
          className={`bg-white border-2 border-[#191c1e] px-5 py-3 font-bold text-xs italic uppercase tracking-wider flex items-center gap-2 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
        >
          <Download size={15} /> Exportar
        </button>

        {canManage && (
          <button
            data-testid="button-recompute-quarter"
            onClick={() => recomputeMutation.mutate()}
            disabled={recomputeMutation.isPending}
            title="Recalcula os resultados do ciclo atual agora, sem fechar o ciclo (ex.: após alterar o cargo de um colaborador)"
            className={`bg-white border-2 border-[#191c1e] px-5 py-3 font-bold text-xs italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
          >
            <RefreshCw size={15} className={recomputeMutation.isPending ? "animate-spin" : ""} /> {recomputeMutation.isPending ? "Recalculando..." : "Recalcular Ciclo"}
          </button>
        )}

        {canManage && (
          <AlertDialog onOpenChange={(o) => { if (!o) { setForceClose(false); setForceReason(""); } }}>
            <AlertDialogTrigger asChild>
              <button
                data-testid="button-close-quarter"
                className={`bg-[#ccff00] text-[#161e00] border-2 border-[#191c1e] px-5 py-3 font-bold text-xs italic uppercase tracking-wider flex items-center gap-2 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
              >
                <LockKeyhole size={15} /> Fechar Ciclo
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-md rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
              <AlertDialogHeader>
                <div className="w-12 h-12 bg-[#ccff00] border-2 border-[#191c1e] flex items-center justify-center mb-4">
                  <LockKeyhole size={24} className="text-[#161e00]" />
                </div>
                <AlertDialogTitle className="text-2xl italic uppercase font-black tracking-tight">Consolidar Resultados do Ciclo?</AlertDialogTitle>
                <AlertDialogDescription className="text-sm leading-relaxed text-[#444933] italic">
                  O fechamento irá congelar as notas, calcular as faixas de bônus e gerar a projeção de premiação baseada nos eventos já finalizados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4 py-4 bg-[#f7f9fb] p-4 border-2 border-[#191c1e] mt-2">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="force-close"
                    data-testid="checkbox-force-close"
                    checked={forceClose}
                    onCheckedChange={(c) => setForceClose(c === true)}
                    className="mt-0.5 rounded-none border-2 border-[#ff5722] data-[state=checked]:bg-[#ff5722] data-[state=checked]:border-[#ff5722]"
                  />
                  <Label htmlFor="force-close" className="text-sm font-bold italic leading-snug cursor-pointer text-[#444933]">
                    Existem eventos pendentes. Forçar o fechamento ignorando esses eventos?
                  </Label>
                </div>
                {forceClose && (
                  <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2">
                    <Label htmlFor="force-reason" className="text-xs font-black italic uppercase tracking-wider text-[#b02f00]">Justificativa Obrigatória</Label>
                    <Textarea
                      id="force-reason"
                      data-testid="input-force-reason"
                      value={forceReason}
                      onChange={(e) => setForceReason(e.target.value)}
                      placeholder="Por que o ciclo deve ser fechado agora?"
                      className="bg-white rounded-none border-2 border-[#191c1e] focus-visible:ring-0"
                      rows={3}
                    />
                  </div>
                )}
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-none border-2 border-[#191c1e] font-bold italic uppercase text-xs tracking-wider">Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCloseCycle}
                  disabled={closeMutation.isPending || (forceClose && !forceReason.trim())}
                  className="rounded-none border-2 border-[#191c1e] bg-[#ccff00] text-[#161e00] hover:bg-[#abd600] font-bold italic uppercase text-xs tracking-wider"
                >
                  {closeMutation.isPending ? "Processando..." : "Confirmar Fechamento"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </section>

      {rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className={`bg-white border-2 border-[#191c1e] p-6 ${HARD_SHADOW}`}>
            <div className="flex items-center gap-2 text-[#747a60]">
              <Wallet2 size={16} />
              <p className="font-bold uppercase text-xs italic tracking-wider">Total em Bônus</p>
            </div>
            <h3 className="text-3xl md:text-4xl font-black italic mt-2 text-[#191c1e]">{fmtBRL(totalBonus)}</h3>
          </div>
          <div className={`bg-white border-2 border-[#191c1e] p-6 ${HARD_SHADOW}`}>
            <div className="flex items-center gap-2 text-[#747a60]">
              <CheckCircle2 size={16} />
              <p className="font-bold uppercase text-xs italic tracking-wider">Elegibilidade</p>
            </div>
            <h3 className="text-3xl md:text-4xl font-black italic mt-2 text-[#191c1e]">{eligibilityPct}%</h3>
            <span className="inline-block mt-3 bg-[#ccff00] text-[#161e00] font-black italic uppercase text-[10px] px-2 py-1 border-2 border-[#191c1e]">{eligibleCount} de {rows.length}</span>
          </div>
          <div className={`bg-white border-2 border-[#191c1e] p-6 ${HARD_SHADOW}`}>
            <div className="flex items-center gap-2 text-[#747a60]">
              <Users size={16} />
              <p className="font-bold uppercase text-xs italic tracking-wider">Colaboradores</p>
            </div>
            <h3 className="text-3xl md:text-4xl font-black italic mt-2 text-[#191c1e]">{rows.length}</h3>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-20 text-[#747a60] italic uppercase font-bold">Carregando resultados...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-24 bg-white border-2 border-dashed border-[#191c1e]">
          <Wallet2 size={48} className="mx-auto mb-4 opacity-20" />
          <h3 className="text-xl font-black italic uppercase tracking-tight text-[#191c1e] mb-1">Nenhum resultado consolidado</h3>
          <p className="text-[#747a60] italic max-w-md mx-auto">Não há dados gerados para o ciclo atual.</p>
          {canManage && <p className="text-sm mt-2 text-[#444933] italic">Clique em "Fechar Ciclo" para gerar os resultados oficiais.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative max-w-md flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747a60]" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 h-12 rounded-none border-2 border-[#191c1e] bg-white italic font-medium focus-visible:ring-0"
                placeholder="Buscar colaborador..."
              />
            </div>
            <div className="w-48">
              <Select value={filterEligible} onValueChange={(v) => setFilterEligible(v as any)}>
                <SelectTrigger className="h-12 rounded-none border-2 border-[#191c1e] bg-white italic font-medium focus:ring-0">
                  <SelectValue placeholder="Elegibilidade" />
                </SelectTrigger>
                <SelectContent className="rounded-none border-2 border-[#191c1e]">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="eligible">Elegíveis</SelectItem>
                  <SelectItem value="ineligible">Não elegíveis</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
            <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center gap-2 italic">
              <Wallet size={18} />
              <span className="font-black uppercase tracking-tight">Bônus & Pagamentos</span>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-[#191c1e] bg-[#eceef0]">
                  {payHeaderCell("Colaborador", "employeeName", "left")}
                  {payHeaderCell("Atividade", "eventsCount")}
                  {payHeaderCell("Nota Final", "finalResult")}
                  {payHeaderCell("Faixa", "platoon")}
                  {payHeaderCell("Elegibilidade", "eligible")}
                  {payHeaderCell("Bônus", "bonusValue")}
                  {payHeaderCell("Bônus Extra", "extraBonusValue")}
                  {payHeaderCell("Status do Pagamento", "bonusStatus")}
                  {canManage && <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Ação</th>}
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#eceef0]">
                {sortedRows.map((r) => {
                  const statusInfo = r.bonusStatus ? (BONUS_STATUS_LABELS[r.bonusStatus] ?? { label: r.bonusStatus, class: "bg-[#eceef0] text-[#444933]" }) : null;
                  return (
                    <tr
                      key={r.employeeId}
                      data-testid={`row-result-${r.employeeId}`}
                      className="hover:bg-[#f2f4f6] transition-all cursor-pointer group"
                      onClick={() => setSelectedId(r.employeeId)}
                    >
                      <td className="px-6 py-4">
                        <div className="font-black italic uppercase text-sm text-[#191c1e]">{r.employeeName}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] font-bold italic uppercase text-[#444933] bg-[#eceef0] border-2 border-[#191c1e] px-2 py-0.5">{r.eventsCount ?? 0} c/ nota</span>
                          <span className="text-[10px] font-bold italic uppercase text-[#161e00] bg-[#ccff00] border-2 border-[#191c1e] px-2 py-0.5">{r.participatedEventsCount ?? 0} participados</span>
                          {(r.totalAbsences ?? 0) > 0 && <span className="text-[10px] font-bold italic uppercase text-white bg-[#ff5722] border-2 border-[#191c1e] px-2 py-0.5">{r.totalAbsences} penalidades</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-baseline gap-1">
                          <span className="font-black italic text-2xl text-[#191c1e] leading-none">{fmtScore(r.finalResult)}</span>
                          <span className="text-[10px] font-bold italic text-[#747a60] uppercase">/100</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <FaixaBadge minScore={r.platoonMinScore} maxScore={r.platoonMaxScore} color={r.platoonColor} />
                      </td>
                      <td className="px-6 py-4 text-center">
                        {r.eligible === false ? (
                          <span className="inline-block text-[10px] uppercase font-black italic bg-[#ff5722] text-white border-2 border-[#191c1e] px-2 py-1 cursor-help" title={r.eligibilityReason ?? undefined}>
                            Não Elegível
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-black italic bg-[#ccff00] text-[#161e00] border-2 border-[#191c1e] px-2 py-1">
                            <CheckCircle2 size={10} /> Elegível
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {r.bonusValue > 0 ? (
                          <span className="font-black italic text-[#161e00] bg-[#ccff00] px-3 py-1 border-2 border-[#191c1e]">{fmtBRL(r.bonusValue)}</span>
                        ) : (
                          <span className="text-[#c4c9ac] font-bold italic">R$ 0,00</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {(r.extraBonusValue ?? 0) > 0 ? (
                          <span className="font-black italic text-[#191c1e] bg-[#eceef0] px-3 py-1 border-2 border-[#191c1e]">{fmtBRL(r.extraBonusValue ?? 0)}</span>
                        ) : (
                          <span className="text-[#c4c9ac] font-bold italic">R$ 0,00</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {statusInfo ? (
                          <span className={`text-[10px] uppercase font-black italic px-2.5 py-1 border-2 border-[#191c1e] ${statusInfo.class}`}>{statusInfo.label}</span>
                        ) : (
                          <span className="text-[#c4c9ac]">—</span>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-6 py-4 text-center">
                          {r.id != null && (
                            <button
                              data-testid={`button-payment-${r.employeeId}`}
                              className="p-2 border-2 border-transparent text-[#747a60] hover:border-[#191c1e] hover:text-[#161e00] hover:bg-[#ccff00] transition-all"
                              onClick={(e) => { e.stopPropagation(); openPayment(r); }}
                            >
                              <Wallet size={16} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      <Dialog open={!!payTarget} onOpenChange={o => !o && setPayTarget(null)}>
        <DialogContent className="max-w-md rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
          <DialogHeader>
            <DialogTitle className="text-2xl italic uppercase font-black tracking-tight">Gestão de Pagamento</DialogTitle>
            <p className="text-sm font-bold italic uppercase text-[#747a60] mt-1">{payTarget?.employeeName}</p>
          </DialogHeader>
          <div className="bg-[#ccff00] border-2 border-[#191c1e] p-4 flex items-center justify-between mb-2 mt-4">
            <span className="text-xs font-black italic uppercase tracking-wider text-[#161e00]">Valor do Bônus</span>
            <span className="text-2xl font-black italic text-[#161e00]">{payTarget ? fmtBRL(payTarget.bonusValue) : "R$ 0,00"}</span>
          </div>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Status do Bônus</Label>
              <Select value={payForm.bonusStatus} onValueChange={v => setPayForm(f => ({ ...f, bonusStatus: v }))}>
                <SelectTrigger data-testid="select-bonus-status" className="h-11 rounded-none border-2 border-[#191c1e] font-bold italic focus:ring-0">
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
              <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Método de Pagamento</Label>
              <Input
                data-testid="input-payment-method"
                value={payForm.paymentMethod}
                onChange={e => setPayForm(f => ({ ...f, paymentMethod: e.target.value }))}
                className="h-11 rounded-none border-2 border-[#191c1e]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Observações (Opcional)</Label>
              <Textarea
                data-testid="input-payment-notes"
                value={payForm.paymentNotes}
                onChange={e => setPayForm(f => ({ ...f, paymentNotes: e.target.value }))}
                placeholder="Detalhes adicionais sobre o pagamento..."
                className="resize-none rounded-none border-2 border-[#191c1e]"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#eceef0] mt-2">
              <button onClick={() => setPayTarget(null)} className="border-2 border-[#191c1e] bg-white px-5 py-2.5 font-bold text-xs italic uppercase tracking-wider hover:bg-[#eceef0] transition-colors">Cancelar</button>
              <button
                data-testid="button-save-payment"
                onClick={savePayment}
                disabled={paymentMutation.isPending}
                className="border-2 border-[#191c1e] bg-[#ccff00] text-[#161e00] px-5 py-2.5 font-bold text-xs italic uppercase tracking-wider hover:bg-[#abd600] transition-colors disabled:opacity-50"
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
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="p-6 md:p-10 space-y-8">
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-l-8 border-[#ccff00] pl-6 py-1">
          <div>
            <h1 data-testid="text-page-title" className="text-4xl md:text-5xl italic uppercase tracking-tighter font-black leading-none">
              Resultados <span className="text-[#ccff00] bg-[#191c1e] px-3 inline-block -rotate-1">do Ciclo</span>
            </h1>
            <p className="text-base md:text-lg text-[#444933] italic mt-2 max-w-2xl">Ranking, consolidação de notas e pagamentos de bônus do ciclo atual.</p>
          </div>
          <CycleBadge />
        </section>

        <Tabs value={tab} onValueChange={setTab} className="space-y-8">
          <TabsList className="bg-white border-2 border-[#191c1e] rounded-none p-1 h-auto flex-wrap gap-1">
            <TabsTrigger value="ranking" data-testid="tab-ranking" className="rounded-none data-[state=active]:bg-[#ccff00] data-[state=active]:text-[#161e00] data-[state=active]:shadow-none font-black italic uppercase text-xs tracking-wider px-4 py-2 flex items-center gap-2">
              <ListOrdered size={15} /> Ranking
            </TabsTrigger>
            <TabsTrigger value="consolidacao" data-testid="tab-consolidacao" className="rounded-none data-[state=active]:bg-[#ccff00] data-[state=active]:text-[#161e00] data-[state=active]:shadow-none font-black italic uppercase text-xs tracking-wider px-4 py-2 flex items-center gap-2">
              <Table2 size={15} /> Consolidação
            </TabsTrigger>
            {isManager && (
              <TabsTrigger value="bonus" data-testid="tab-bonus" className="rounded-none data-[state=active]:bg-[#ccff00] data-[state=active]:text-[#161e00] data-[state=active]:shadow-none font-black italic uppercase text-xs tracking-wider px-4 py-2 flex items-center gap-2">
                <Wallet size={15} /> Bônus &amp; Pagamentos
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
