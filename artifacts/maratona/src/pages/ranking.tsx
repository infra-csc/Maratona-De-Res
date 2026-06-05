import { useState } from "react";
import { useGetRanking, exportRanking, getGetRankingQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Trophy, Download, Medal, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PlatoonBadge } from "@/components/ui/platoon-badge";
import { cn } from "@/lib/utils";

const currentYear = new Date().getFullYear();
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

function PodiumCard({ entry, rank }: { entry: any, rank: number }) {
  const heightClass = rank === 1 ? "h-40" : rank === 2 ? "h-32" : "h-24";
  const bgClass = rank === 1 ? "bg-gradient-to-b from-yellow-100 to-yellow-200 border-yellow-300 shadow-yellow-200/50 shadow-lg" : 
                  rank === 2 ? "bg-gradient-to-b from-slate-100 to-slate-200 border-slate-300 shadow-slate-200/50 shadow-md" : 
                  "bg-gradient-to-b from-orange-100 to-orange-200 border-orange-300 shadow-orange-200/50 shadow-md";
  const medalColor = rank === 1 ? "text-yellow-500 fill-yellow-500" : rank === 2 ? "text-slate-400 fill-slate-400" : "text-orange-500 fill-orange-500";
  
  const initials = entry.employeeName.split(' ').map((n:string) => n[0]).slice(0,2).join('').toUpperCase();

  return (
    <div className={cn("flex flex-col items-center justify-end w-full max-w-[180px]", rank === 1 ? "order-2 z-10" : rank === 2 ? "order-1" : "order-3")}>
      <div className="flex flex-col items-center mb-4 relative">
        {rank === 1 && (
          <div className="absolute -top-8 text-yellow-500 animate-bounce">
            <ChevronUp size={24} className="stroke-2" />
          </div>
        )}
        <div className={cn("rounded-full border-4 flex items-center justify-center font-bold text-white bg-sidebar mb-2 z-10 relative overflow-hidden", rank === 1 ? "w-20 h-20 text-2xl border-yellow-400 shadow-xl" : "w-16 h-16 text-xl border-slate-300")}>
          {initials}
        </div>
        <div className="text-center bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-100 absolute top-full -mt-4 w-max z-20">
          <p className="font-bold text-sm leading-tight text-slate-800">{entry.employeeName}</p>
          <p className="text-xs font-black text-primary mt-0.5">{entry.finalResult.toFixed(1)} <span className="font-normal text-muted-foreground">pts</span></p>
        </div>
      </div>
      
      <div className={cn("w-full rounded-t-xl border-t border-x flex flex-col items-center pt-8 relative overflow-hidden", bgClass, heightClass)}>
        <span className="absolute inset-0 bg-white/40 z-0"></span>
        <div className="z-10 relative flex flex-col items-center">
          <span className="font-black text-5xl opacity-40">{rank}</span>
          <Medal size={28} className={cn("mt-2", medalColor)} />
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

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-5xl mx-auto bg-slate-50/30 min-h-full">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="text-center md:text-left">
          <h1 data-testid="text-page-title" className="text-3xl font-black flex items-center justify-center md:justify-start gap-3 tracking-tight text-foreground uppercase">
            <Trophy size={28} className="text-yellow-500 fill-yellow-500" />
            Ranking Maratona
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Reconhecimento de alta performance</p>
        </div>
        
        <div className="flex gap-2">
          <div className="flex bg-white p-1 rounded-lg border shadow-sm">
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger data-testid="select-year" className="w-24 border-none shadow-none font-medium bg-slate-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="w-px bg-border my-1 mx-1" />
            <Select value={String(quarter)} onValueChange={v => setQuarter(Number(v))}>
              <SelectTrigger data-testid="select-quarter" className="w-24 border-none shadow-none font-medium bg-slate-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">T1</SelectItem>
                <SelectItem value="2">T2</SelectItem>
                <SelectItem value="3">T3</SelectItem>
                <SelectItem value="4">T4</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            data-testid="button-export-ranking"
            className="bg-sidebar text-white shadow-sm"
            onClick={handleExport}
          >
            <Download size={16} className="mr-2" /> Exportar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-24 text-muted-foreground">Carregando ranking...</div>
      ) : !ranking || ranking.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-dashed text-muted-foreground shadow-sm">
          <Trophy size={64} className="mx-auto mb-6 text-slate-200" />
          <h3 className="text-xl font-bold text-slate-700 mb-2">Ranking Indisponível</h3>
          <p>Nenhum resultado consolidado para T{quarter}/{year}.</p>
          <p className="text-sm mt-1">Feche o trimestre na área de Resultados para gerar o ranking oficial.</p>
        </div>
      ) : (
        <>
          {!search && top3.length > 0 && (
            <div className="pt-12 pb-6 flex justify-center items-end gap-2 sm:gap-6 border-b border-slate-200/60 mb-8">
              {top3[1] && <PodiumCard entry={top3[1]} rank={2} />}
              {top3[0] && <PodiumCard entry={top3[0]} rank={1} />}
              {top3[2] && <PodiumCard entry={top3[2]} rank={3} />}
            </div>
          )}

          <div className="bg-white p-3 rounded-xl border shadow-sm flex items-center mb-6 max-w-md mx-auto">
            <Search size={18} className="text-muted-foreground ml-3 shrink-0" />
            <Input
              data-testid="input-search-ranking"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="border-none shadow-none focus-visible:ring-0 text-base h-10"
              placeholder="Buscar colaborador no ranking..."
            />
          </div>

          <div className="space-y-3">
            {(search ? ranking : rest).map((entry, index) => {
              const actualRank = search ? entry.position : index + 4;
              return (
                <Card key={entry.employeeId} data-testid={`card-ranking-${entry.employeeId}`} className="border-none shadow-sm hover:shadow-md transition-shadow bg-white overflow-hidden group">
                  <CardContent className="p-0">
                    <div className="flex items-center">
                      <div className="w-16 flex flex-col items-center justify-center py-4 bg-slate-50 border-r border-slate-100 group-hover:bg-primary/5 transition-colors">
                        <span className="text-sm font-medium text-slate-400">POS</span>
                        <span className="text-2xl font-black text-slate-700">{actualRank}</span>
                      </div>
                      
                      <div className="flex-1 py-4 px-5 flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-lg text-slate-900 truncate" data-testid={`text-employee-name-${entry.employeeId}`}>{entry.employeeName}</p>
                          <div className="flex flex-wrap items-center gap-3 mt-1.5">
                            <PlatoonBadge platoon={entry.platoon} colorHex={entry.platoonColor} />
                            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{entry.eventsCount} eventos</span>
                            {entry.absences > 0 && <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">{entry.absences} faltas</span>}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6 shrink-0 sm:pr-4">
                          <div className="text-right">
                            <span className="block text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Nota Final</span>
                            <p className="font-black text-primary text-2xl" data-testid={`text-final-result-${entry.employeeId}`}>{fmt(entry.finalResult)}</p>
                          </div>
                          
                          {entry.bonusValue > 0 && (
                            <div className="text-right hidden sm:block bg-green-50 px-4 py-2 rounded-lg border border-green-100">
                              <span className="block text-[10px] uppercase font-bold text-green-700 mb-0.5">Bônus</span>
                              <p className="font-black text-green-600 text-lg">{fmtBRL(entry.bonusValue)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
