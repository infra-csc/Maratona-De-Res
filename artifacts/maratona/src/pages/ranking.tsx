import { useState } from "react";
import { useGetRanking, exportRanking, getGetRankingQueryKey, useGetRankingDetail, getGetRankingDetailQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search, Trophy, Download, Crown, Users, Award, AlertTriangle, MapPin, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PlatoonBadge } from "@/components/ui/platoon-badge";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const currentYear = new Date().getFullYear();
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";
const HARD_SHADOW_HOVER = "transition-all hover:shadow-[2px_2px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px]";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

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

export default function RankingPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canViewDetail = !!user && ["admin", "rh", "diretoria"].includes(user.role);
  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState(currentQuarter);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const qKey = getGetRankingQueryKey({ year, quarter, search: search || undefined });
  const { data: ranking, isLoading } = useGetRanking({ year, quarter, search: search || undefined }, {
    query: { queryKey: qKey },
  });

  const detailParams = { employeeId: selectedId ?? 0, year, quarter };
  const { data: detail, isLoading: detailLoading } = useGetRankingDetail(detailParams, {
    query: {
      queryKey: getGetRankingDetailQueryKey(detailParams),
      enabled: !!selectedId && canViewDetail,
    },
  });

  async function handleExport() {
    try {
      const data = await exportRanking({ year, quarter });
      const blob = new Blob([data.data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = data.filename;
      a.click(); URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    }
  }

  const fmt = (v: number) => `${v.toFixed(1)}`;
  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  const top3 = ranking?.slice(0, 3) || [];

  const maxResult = ranking && ranking.length > 0 ? Math.max(...ranking.map(r => r.finalResult)) : 0;
  const activeRunners = ranking?.length ?? 0;
  const avgResult = ranking && ranking.length > 0
    ? ranking.reduce((acc, r) => acc + r.finalResult, 0) / ranking.length
    : 0;

  function openDetail(id: number) {
    if (!canViewDetail) return;
    setSelectedId(id);
  }

  return (
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="p-6 md:p-10 space-y-10">
        {/* Hero / page header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b-4 border-[#191c1e] pb-8">
          <div className="border-l-8 border-[#ccff00] pl-6">
            <h1 data-testid="text-page-title" className="text-4xl md:text-6xl italic uppercase tracking-tighter font-black leading-none">
              O Ranking
            </h1>
            <p className="text-base md:text-lg text-[#444933] italic mt-3 max-w-xl">
              Velocidade, consistência e estratégia. O pelotão de frente define o ritmo da Maratona.
            </p>
          </div>
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
        </section>

        {/* Controls */}
        <section className="flex flex-col md:flex-row gap-3 md:items-center justify-end">
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger data-testid="select-year" className="w-28 rounded-none border-2 border-[#191c1e] bg-white font-bold italic uppercase text-xs tracking-wider focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(quarter)} onValueChange={v => setQuarter(Number(v))}>
            <SelectTrigger data-testid="select-quarter" className="w-28 rounded-none border-2 border-[#191c1e] bg-white font-bold italic uppercase text-xs tracking-wider focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1º Trimestre</SelectItem>
              <SelectItem value="2">2º Trimestre</SelectItem>
              <SelectItem value="3">3º Trimestre</SelectItem>
              <SelectItem value="4">4º Trimestre</SelectItem>
            </SelectContent>
          </Select>
          <button
            data-testid="button-export-ranking"
            className={`bg-[#ccff00] border-2 border-[#191c1e] px-6 py-2.5 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 justify-center ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
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
            <p className="text-[#444933] italic font-medium">Nenhum resultado consolidado para T{quarter}/{year}.</p>
            <p className="text-sm mt-1 text-[#747a60] italic">Feche o trimestre na área de Resultados para gerar o ranking oficial.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* MAIN: full ranking list */}
            <div className="lg:col-span-2 space-y-5">
              {/* Search */}
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
                        {/* POS */}
                        <div className={cn("w-14 h-14 border-2 border-[#191c1e] bg-[#eceef0] flex flex-col items-center justify-center skew-x-[-6deg] shrink-0 transition-colors", canViewDetail && "group-hover:bg-[#ccff00]")}>
                          <span className="skew-x-[6deg] text-[9px] font-bold uppercase italic text-[#747a60] leading-none">Pos</span>
                          <span className="skew-x-[6deg] text-xl font-black italic leading-none mt-0.5">{String(actualRank).padStart(2, "0")}</span>
                        </div>

                        {/* Name + platoon + meta */}
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

                        {/* Progress */}
                        <div className="hidden md:flex items-center gap-3 w-40 shrink-0">
                          <div className="flex-1 h-2.5 bg-[#eceef0] border border-[#191c1e]">
                            <div className="h-full bg-[#ccff00]" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[11px] font-bold italic w-9 text-right">{pct}%</span>
                        </div>

                        {/* Nota Final + Bônus */}
                        <div className="flex items-center gap-4 shrink-0 sm:pl-4">
                          <div className="text-right">
                            <span className="block text-[9px] uppercase font-bold italic text-[#747a60] leading-none mb-1">Nota Final</span>
                            <p className="font-black italic text-2xl text-[#506600] leading-none" data-testid={`text-final-result-${entry.employeeId}`}>{fmt(entry.finalResult)}</p>
                          </div>
                          {entry.bonusValue > 0 && (
                            <div className="text-right hidden sm:block bg-[#ccff00] border-2 border-[#191c1e] px-3 py-1.5 skew-x-[-6deg]">
                              <div className="skew-x-[6deg]">
                                <span className="block text-[9px] uppercase font-bold italic text-[#161e00] leading-none mb-1">Bônus</span>
                                <p className="font-black italic text-base text-[#191c1e] leading-none">{fmtBRL(entry.bonusValue)}</p>
                              </div>
                            </div>
                          )}
                          {canViewDetail && <ChevronRight size={18} className="text-[#747a60] group-hover:text-[#191c1e] transition-colors shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                  {ranking.length === 0 && (
                    <div className="text-center py-16 italic uppercase font-bold text-[#747a60]">Nenhum colaborador encontrado.</div>
                  )}
                </div>
              </section>
            </div>

            {/* RIGHT: podium top-3 */}
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
      </div>

      {/* Detail drawer */}
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
                  <span className="text-[#9da3a8]">T{detail.period.quarter}/{detail.period.year}</span>
                </div>
              </SheetHeader>

              <div className="p-6 space-y-8">
                {/* Summary cards */}
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
                    Trimestre ainda não fechado — valores parciais.
                  </div>
                )}

                {/* Events / provas */}
                <section className="space-y-3">
                  <h4 className="text-sm font-black italic uppercase tracking-tight flex items-center gap-2">
                    <Trophy size={16} /> Desempenho nas Provas
                  </h4>
                  {detail.events.length === 0 ? (
                    <p className="text-sm italic text-[#747a60] font-medium">Nenhum evento avaliado no período.</p>
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

                {/* Penalties */}
                <section className="space-y-3">
                  <h4 className="text-sm font-black italic uppercase tracking-tight flex items-center gap-2 text-[#ff5722]">
                    <AlertTriangle size={16} /> Penalidades
                  </h4>
                  {detail.penalties.length === 0 ? (
                    <p className="text-sm italic text-[#747a60] font-medium">Sem penalidades no período.</p>
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

                {/* Merits */}
                <section className="space-y-3">
                  <h4 className="text-sm font-black italic uppercase tracking-tight flex items-center gap-2 text-[#506600]">
                    <Award size={16} /> Méritos
                  </h4>
                  {detail.merits.length === 0 ? (
                    <p className="text-sm italic text-[#747a60] font-medium">Sem méritos no período.</p>
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
                    <span className="text-xs font-black uppercase italic tracking-wider">Bônus do Trimestre</span>
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
