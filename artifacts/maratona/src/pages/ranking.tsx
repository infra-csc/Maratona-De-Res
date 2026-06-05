import { useState } from "react";
import { useGetRanking, exportRanking, getGetRankingQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Trophy, Download, Crown, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PlatoonBadge } from "@/components/ui/platoon-badge";
import { cn } from "@/lib/utils";

const currentYear = new Date().getFullYear();
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";
const HARD_SHADOW_HOVER = "transition-all hover:shadow-[2px_2px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px]";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

function PodiumCard({ entry, rank, maxResult }: { entry: any, rank: number, maxResult: number }) {
  const isLeader = rank === 1;
  const orderClass = rank === 1 ? "order-1 md:order-2" : rank === 2 ? "order-2 md:order-1" : "order-3";
  const pct = maxResult > 0 ? Math.min(100, Math.round((entry.finalResult / maxResult) * 100)) : 0;

  return (
    <div
      data-testid={`podium-card-${entry.employeeId}`}
      className={cn(
        "border-[#191c1e] flex flex-col items-center text-center transition-transform",
        orderClass,
        isLeader
          ? `bg-[#ccff00] border-4 p-8 md:p-10 skew-x-[-6deg] relative z-10 ${HARD_SHADOW} hover:-translate-y-2`
          : "bg-white border-2 p-6 md:p-8 skew-x-[-3deg] hover:-translate-y-1",
      )}
    >
      <div className={cn("flex flex-col items-center w-full", isLeader ? "skew-x-[6deg]" : "skew-x-[3deg]")}>
        {isLeader && (
          <div className="bg-[#191c1e] text-[#ccff00] px-5 py-1.5 italic font-black text-sm md:text-base border-2 border-[#ccff00] skew-x-[-8deg] mb-4 flex items-center gap-2">
            <span className="skew-x-[8deg] inline-flex items-center gap-1.5"><Crown size={16} /> Líder da Prova</span>
          </div>
        )}
        <div className={cn("font-black italic mb-4", isLeader ? "text-5xl md:text-6xl text-[#191c1e]" : "text-3xl md:text-4xl text-[#747a60]")}>
          #{String(rank).padStart(2, "0")}
        </div>
        <div className="relative mb-6">
          <div
            className={cn(
              "border-[#191c1e] bg-[#e0e3e5] flex items-center justify-center skew-x-[-6deg] overflow-hidden",
              isLeader ? "w-28 h-28 md:w-32 md:h-32 border-4" : "w-20 h-20 md:w-24 md:h-24 border-2",
            )}
          >
            <span className={cn("skew-x-[6deg] font-black italic", isLeader ? "text-3xl md:text-4xl" : "text-2xl")}>
              {initials(entry.employeeName)}
            </span>
          </div>
          <div className="absolute -bottom-2 -right-2 skew-x-[-12deg]">
            <PlatoonBadge platoon={entry.platoon} colorHex={entry.platoonColor} />
          </div>
        </div>
        <h3 className="text-base md:text-lg italic uppercase font-black tracking-tight" data-testid={`text-podium-name-${entry.employeeId}`}>{entry.employeeName}</h3>
        <p className={cn("italic font-black mt-2", isLeader ? "text-3xl text-[#191c1e]" : "text-2xl text-[#506600]")} data-testid={`text-podium-result-${entry.employeeId}`}>
          {entry.finalResult.toFixed(1)} <span className="text-sm not-italic font-bold opacity-70">pts</span>
        </p>
        <div className={cn("w-full mt-5", isLeader ? "h-4 bg-[#191c1e]/20" : "h-2 bg-[#eceef0]")}>
          <div className={cn("h-full", isLeader ? "bg-[#191c1e]" : "bg-[#506600]")} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function RankingPage() {
  const { toast } = useToast();
  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState(currentQuarter);
  const [search, setSearch] = useState("");

  const qKey = getGetRankingQueryKey({ year, quarter, search: search || undefined });
  const { data: ranking, isLoading } = useGetRanking({ year, quarter, search: search || undefined }, {
    query: { queryKey: qKey },
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
  const rest = ranking?.slice(3) || [];

  const maxResult = ranking && ranking.length > 0 ? Math.max(...ranking.map(r => r.finalResult)) : 0;
  const activeRunners = ranking?.length ?? 0;
  const avgResult = ranking && ranking.length > 0
    ? ranking.reduce((acc, r) => acc + r.finalResult, 0) / ranking.length
    : 0;

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
          <>
            {!search && top3.length > 0 && (
              <section className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-end">
                {top3[1] && <PodiumCard entry={top3[1]} rank={2} maxResult={maxResult} />}
                {top3[0] && <PodiumCard entry={top3[0]} rank={1} maxResult={maxResult} />}
                {top3[2] && <PodiumCard entry={top3[2]} rank={3} maxResult={maxResult} />}
              </section>
            )}

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

            {/* Leaderboard list */}
            <section className="bg-white border-2 border-[#191c1e]">
              <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center gap-3 italic">
                <span className="w-3 h-6 bg-[#ccff00] inline-block skew-x-[-12deg]" />
                <h3 className="text-xs font-bold uppercase tracking-widest">O Pelotão de Elite</h3>
              </div>
              <div className="divide-y-2 divide-[#eceef0]">
                {(search ? ranking : rest).map((entry, index) => {
                  const actualRank = search ? entry.position : index + 4;
                  const pct = maxResult > 0 ? Math.min(100, Math.round((entry.finalResult / maxResult) * 100)) : 0;
                  return (
                    <div
                      key={entry.employeeId}
                      data-testid={`card-ranking-${entry.employeeId}`}
                      className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 md:px-6 py-4 hover:bg-[#f2f4f6] transition-all hover:translate-x-1 group"
                    >
                      {/* POS */}
                      <div className="w-14 h-14 border-2 border-[#191c1e] bg-[#eceef0] flex flex-col items-center justify-center skew-x-[-6deg] shrink-0 group-hover:bg-[#ccff00] transition-colors">
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
                              <span className="inline-block skew-x-[8deg]">{entry.absences} faltas</span>
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
                      <div className="flex items-center gap-5 shrink-0 sm:pl-4">
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
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
