import { useState } from "react";
import { useGetRanking, exportRanking, getGetRankingQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Trophy, Download, Medal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const currentYear = new Date().getFullYear();
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

function positionStyle(pos: number) {
  if (pos === 1) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400";
  if (pos === 2) return "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300";
  if (pos === 3) return "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400";
  return "bg-muted text-muted-foreground";
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

  const fmt = (v: number) => `${(v * 100).toFixed(2)}%`;
  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 data-testid="text-page-title" className="text-2xl font-bold flex items-center gap-2">
            <Trophy size={22} className="text-yellow-500" />
            Maratona de Resultados
          </h1>
          <p className="text-muted-foreground text-sm">Ranking geral de colaboradores</p>
        </div>
        <Button
          data-testid="button-export-ranking"
          variant="outline"
          size="sm"
          onClick={handleExport}
        >
          <Download size={15} className="mr-1.5" /> Exportar CSV
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="input-search-ranking"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            placeholder="Buscar colaborador..."
          />
        </div>
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger data-testid="select-year" className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(quarter)} onValueChange={v => setQuarter(Number(v))}>
          <SelectTrigger data-testid="select-quarter" className="w-20"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">T1</SelectItem>
            <SelectItem value="2">T2</SelectItem>
            <SelectItem value="3">T3</SelectItem>
            <SelectItem value="4">T4</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Carregando ranking...</div>
      ) : !ranking || ranking.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Trophy size={48} className="mx-auto mb-4 opacity-20" />
          <p>Nenhum resultado para T{quarter}/{year}.</p>
          <p className="text-sm mt-1">Feche o trimestre para gerar o ranking.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ranking.map(entry => (
            <Card key={entry.employeeId} data-testid={`card-ranking-${entry.employeeId}`} className="hover:shadow-md transition-shadow">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-4">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${positionStyle(entry.position)}`}>
                    {entry.position <= 3 ? <Medal size={16} /> : entry.position}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" data-testid={`text-employee-name-${entry.employeeId}`}>{entry.employeeName}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {entry.platoon && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: (entry.platoonColor ?? "#94a3b8") + "25", color: entry.platoonColor ?? "#94a3b8" }}>
                          {entry.platoon}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{entry.eventsCount} evento(s)</span>
                      <span className="text-xs text-muted-foreground">{entry.absences} falta(s)</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-primary text-base" data-testid={`text-final-result-${entry.employeeId}`}>{fmt(entry.finalResult)}</p>
                    {entry.bonusValue > 0 && (
                      <p className="text-xs text-green-600 font-medium">{fmtBRL(entry.bonusValue)}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
