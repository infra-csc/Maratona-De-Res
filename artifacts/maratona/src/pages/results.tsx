import { useState } from "react";
import {
  useGetRanking, getGetRankingQueryKey, exportRanking,
  useGetRankingDetail, getGetRankingDetailQueryKey,
  useGetQuarterlyResults, getGetQuarterlyResultsQueryKey, exportQuarterlyResults,
  useCloseQuarter, useUpdateBonusPayment,
} from "@workspace/api-client-react";
import type { QuarterlyResult } from "@workspace/api-client-react";
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
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PlatoonBadge } from "@/components/ui/platoon-badge";
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

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

const fmtScore = (v: number) => v.toFixed(1);
const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtBRLShort = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

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
        <h3 className="text-sm italic uppercase font-black tracking-tight truncate" data-testid={`text-podium-name-${entry.employeeId}`}>{entry.employeeName}</h3>
        <div className="mt-1"><PlatoonBadge platoon={entry.platoon} colorHex={entry.platoonColor} /></div>
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

  const top3 = ranking?.slice(0, 3) || [];
  const maxResult = ranking && ranking.length > 0 ? Math.max(...ranking.map(r => r.finalResult)) : 0;
  const activeRunners = ranking?.length ?? 0;
  const avgResult = ranking && ranking.length > 0 ? ranking.reduce((acc, r) => acc + r.finalResult, 0) / ranking.length : 0;

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
            <div className="relative max-w-md">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747a60]" />
              <Input
                data-testid="input-search-ranking"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 h-12 rounded-none border-2 border-[#191c1e] bg-white italic font-medium focus-visible:ring-0"
                placeholder="Buscar colaborador no ranking..."
              />
            </div>

            <section className="bg-white border-2 border-[#191c1e]">
              <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center gap-3 italic">
                <span className="w-3 h-6 bg-[#ccff00] inline-block skew-x-[-12deg]" />
                <h3 className="text-xs font-bold uppercase tracking-widest">Classificação Geral</h3>
              </div>
              <div className="divide-y-2 divide-[#eceef0]">
                {ranking.map((entry) => {
                  const actualRank = entry.position;
                  const pct = maxResult > 0 ? Math.min(100, Math.round((entry.finalResult / maxResult) * 100)) : 0;
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
                        <p className="font-black italic uppercase text-base md:text-lg truncate" data-testid={`text-employee-name-${entry.employeeId}`}>{entry.employeeName}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <PlatoonBadge platoon={entry.platoon} colorHex={entry.platoonColor} />
                          <span className="text-[11px] font-bold uppercase italic text-[#444933] border-2 border-[#191c1e] px-2 py-0.5 skew-x-[-8deg] inline-block">
                            <span className="inline-block skew-x-[8deg]">{entry.eventsCount} eventos</span>
                          </span>
                          {entry.absences > 0 && (
                            <span className="text-[11px] font-bold uppercase italic text-white bg-[#ba1a1a] border-2 border-[#191c1e] px-2 py-0.5 skew-x-[-8deg] inline-block">
                              <span className="inline-block skew-x-[8deg]">{entry.absences} penalidades</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="hidden md:flex items-center gap-3 w-40 shrink-0">
                        <div className="flex-1 h-2.5 bg-[#eceef0] border border-[#191c1e]">
                          <div className="h-full bg-[#ccff00]" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] font-bold italic w-9 text-right">{pct}%</span>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 sm:pl-4">
                        <div className="text-right">
                          <span className="block text-[9px] uppercase font-bold italic text-[#747a60] leading-none mb-1">Nota Final</span>
                          <p className="font-black italic text-2xl text-[#506600] leading-none" data-testid={`text-final-result-${entry.employeeId}`}>{fmtScore(entry.finalResult)}</p>
                        </div>
                        {entry.bonusValue > 0 && (
                          <div className="text-right hidden sm:block bg-[#ccff00] border-2 border-[#191c1e] px-3 py-1.5 skew-x-[-6deg]">
                            <div className="skew-x-[6deg]">
                              <span className="block text-[9px] uppercase font-bold italic text-[#161e00] leading-none mb-1">Bônus</span>
                              <p className="font-black italic text-base text-[#191c1e] leading-none">{fmtBRLShort(entry.bonusValue)}</p>
                            </div>
                          </div>
                        )}
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
                  {detail.summary.platoon && <PlatoonBadge platoon={detail.summary.platoon} colorHex={detail.summary.platoonColor ?? undefined} />}
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
                  {detail.events.length === 0 ? (
                    <p className="text-sm italic text-[#747a60] font-medium">Nenhum evento avaliado no ciclo.</p>
                  ) : (
                    <div className="space-y-2">
                      {detail.events.map(ev => (
                        <div key={ev.eventId} data-testid={`detail-event-${ev.eventId}`} className="bg-white border-2 border-[#191c1e] p-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-black italic uppercase text-sm truncate">{ev.eventName}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] font-bold italic text-[#747a60]">
                              {(ev.city || ev.state) && (
                                <span className="inline-flex items-center gap-1"><MapPin size={11} />{[ev.city, ev.state].filter(Boolean).join(" / ")}</span>
                              )}
                              <span className="uppercase">{ev.evaluatedCriteria}/{ev.totalCriteria} quesitos</span>
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
                              {p.eventName && <span className="truncate">· {p.eventName}</span>}
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
                              {m.eventName && <span className="truncate">· {m.eventName}</span>}
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

function ConsolidationTab() {
  const { toast } = useToast();
  const { data: results, isLoading } = useGetQuarterlyResults(undefined, {
    query: { queryKey: getGetQuarterlyResultsQueryKey() },
  });
  const rows = results ?? [];

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

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          data-testid="button-export-consolidation"
          onClick={handleExport}
          className={`bg-white border-2 border-[#191c1e] px-5 py-3 font-bold text-xs italic uppercase tracking-wider flex items-center gap-2 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
        >
          <Download size={15} /> Exportar
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-[#747a60] italic uppercase font-bold">Carregando consolidação...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-24 bg-white border-2 border-dashed border-[#191c1e]">
          <Table2 size={48} className="mx-auto mb-4 opacity-20" />
          <h3 className="text-xl font-black italic uppercase tracking-tight text-[#191c1e] mb-1">Nenhum dado consolidado</h3>
          <p className="text-[#747a60] italic max-w-md mx-auto">Não há resultados gerados para o ciclo atual.</p>
        </div>
      ) : (
        <div className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
          <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center gap-2 italic">
            <Table2 size={18} />
            <span className="font-black uppercase tracking-tight">Planilha de Consolidação</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-[#191c1e] bg-[#eceef0]">
                  <th className="px-5 py-4 text-xs font-bold uppercase italic text-[#444933]">Colaborador</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Soma das Notas</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Eventos c/ Nota</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Eventos Participados</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Penalidades / Méritos</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Média (Nota Final)</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Pelotão</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#eceef0]">
                {[...rows].sort((a, b) => b.finalResult - a.finalResult).map((r) => {
                  const penalty = r.absencePenalty ?? 0;
                  const merit = r.meritPoints ?? 0;
                  const net = Math.round((merit - penalty) * 10) / 10;
                  return (
                    <tr key={r.employeeId} data-testid={`row-consolidation-${r.employeeId}`} className="hover:bg-[#f2f4f6] transition-all">
                      <td className="px-5 py-4">
                        <div className="font-black italic uppercase text-sm text-[#191c1e]">{r.employeeName}</div>
                      </td>
                      <td className="px-5 py-4 text-center font-black italic text-[#506600]">{fmtScore(r.scoreSum ?? 0)}</td>
                      <td className="px-5 py-4 text-center">
                        <span className="text-[11px] font-bold italic uppercase text-[#444933] bg-[#eceef0] border-2 border-[#191c1e] px-2 py-0.5">{r.eventsCount ?? 0}</span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="text-[11px] font-bold italic uppercase text-[#161e00] bg-[#ccff00] border-2 border-[#191c1e] px-2 py-0.5">{r.participatedEventsCount ?? 0}</span>
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
                        {r.platoon ? <PlatoonBadge platoon={r.platoon} colorHex={r.platoonColor} /> : <span className="text-[#c4c9ac]">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
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

  const rows = results ?? [];
  const totalBonus = rows.reduce((acc, r) => acc + (r.bonusValue ?? 0), 0);
  const eligibleCount = rows.filter(r => r.eligible !== false).length;
  const eligibilityPct = rows.length > 0 ? Math.round((eligibleCount / rows.length) * 100) : 0;

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
                  O fechamento irá congelar as notas, classificar os pelotões oficiais e gerar a projeção de bônus baseada nos eventos já finalizados.
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
        <div className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
          <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center gap-2 italic">
            <Wallet size={18} />
            <span className="font-black uppercase tracking-tight">Bônus & Pagamentos</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-[#191c1e] bg-[#eceef0]">
                  <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933]">Colaborador</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Atividade</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Nota Final</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Pelotão Oficial</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Elegibilidade</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Bônus</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Status do Pagamento</th>
                  {canManage && <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Ação</th>}
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#eceef0]">
                {[...rows].sort((a, b) => b.finalResult - a.finalResult).map((r) => {
                  const statusInfo = r.bonusStatus ? (BONUS_STATUS_LABELS[r.bonusStatus] ?? { label: r.bonusStatus, class: "bg-[#eceef0] text-[#444933]" }) : null;
                  return (
                    <tr key={r.employeeId} data-testid={`row-result-${r.employeeId}`} className="hover:bg-[#f2f4f6] transition-all group">
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
                        {r.platoon ? <PlatoonBadge platoon={r.platoon} colorHex={r.platoonColor} /> : <span className="text-[#c4c9ac]">—</span>}
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
                              onClick={() => openPayment(r)}
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PAGE                                                                */
/* ------------------------------------------------------------------ */

export default function ResultsPage() {
  const { user } = useAuth();
  const isManager = !!user && ["admin", "rh", "diretoria"].includes(user.role);
  const canManage = !!user && ["admin", "rh"].includes(user.role);
  const [tab, setTab] = useState("ranking");

  return (
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="p-6 md:p-10 space-y-8">
        <section className="border-l-8 border-[#ccff00] pl-6 py-1">
          <h1 data-testid="text-page-title" className="text-4xl md:text-5xl italic uppercase tracking-tighter font-black leading-none">
            Resultados <span className="text-[#ccff00] bg-[#191c1e] px-3 inline-block -rotate-1">do Ciclo</span>
          </h1>
          <p className="text-base md:text-lg text-[#444933] italic mt-2 max-w-2xl">Ranking, consolidação de notas e pagamentos de bônus do ciclo atual.</p>
        </section>

        {isManager ? (
          <Tabs value={tab} onValueChange={setTab} className="space-y-8">
            <TabsList className="bg-white border-2 border-[#191c1e] rounded-none p-1 h-auto flex-wrap gap-1">
              <TabsTrigger value="ranking" data-testid="tab-ranking" className="rounded-none data-[state=active]:bg-[#ccff00] data-[state=active]:text-[#161e00] data-[state=active]:shadow-none font-black italic uppercase text-xs tracking-wider px-4 py-2 flex items-center gap-2">
                <ListOrdered size={15} /> Ranking
              </TabsTrigger>
              <TabsTrigger value="consolidacao" data-testid="tab-consolidacao" className="rounded-none data-[state=active]:bg-[#ccff00] data-[state=active]:text-[#161e00] data-[state=active]:shadow-none font-black italic uppercase text-xs tracking-wider px-4 py-2 flex items-center gap-2">
                <Table2 size={15} /> Consolidação
              </TabsTrigger>
              <TabsTrigger value="bonus" data-testid="tab-bonus" className="rounded-none data-[state=active]:bg-[#ccff00] data-[state=active]:text-[#161e00] data-[state=active]:shadow-none font-black italic uppercase text-xs tracking-wider px-4 py-2 flex items-center gap-2">
                <Wallet size={15} /> Bônus &amp; Pagamentos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ranking" className="mt-0">
              <RankingTab canViewDetail={isManager} />
            </TabsContent>
            <TabsContent value="consolidacao" className="mt-0">
              <ConsolidationTab />
            </TabsContent>
            <TabsContent value="bonus" className="mt-0">
              <PaymentsTab canManage={canManage} />
            </TabsContent>
          </Tabs>
        ) : (
          <RankingTab canViewDetail={false} />
        )}
      </div>
    </div>
  );
}
