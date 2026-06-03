import { useState } from "react";
import { useGetQuarterlyResults, useCloseQuarter, exportQuarterlyResults, getGetQuarterlyResultsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Download, LockKeyhole, BarChart3 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const currentYear = new Date().getFullYear();
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

export default function ResultsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState(currentQuarter);

  const qKey = getGetQuarterlyResultsQueryKey({ year, quarter });
  const { data: results, isLoading } = useGetQuarterlyResults({ year, quarter }, {
    query: { queryKey: qKey },
  });

  const closeMutation = useCloseQuarter({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: `Trimestre fechado! ${data.totalProcessed} colaborador(es) processado(s).` });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao fechar trimestre", description: e.message, variant: "destructive" }),
    },
  });

  async function handleExport() {
    try {
      const data = await exportQuarterlyResults({ year, quarter });
      const blob = new Blob([data.data], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = data.filename;
      a.click();
    } catch {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    }
  }

  const fmt = (v: number) => `${(v * 100).toFixed(2)}%`;
  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const canClose = user && ["admin", "rh"].includes(user.role);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 data-testid="text-page-title" className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 size={22} className="text-primary" />
            Resultados Trimestrais
          </h1>
          <p className="text-muted-foreground text-sm">Fechamento e consolidação do trimestre</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
          <Button
            data-testid="button-export-results"
            variant="outline" size="sm"
            onClick={handleExport}
          >
            <Download size={15} className="mr-1.5" /> Exportar
          </Button>
          {canClose && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button data-testid="button-close-quarter" size="sm">
                  <LockKeyhole size={15} className="mr-1.5" /> Fechar Trimestre
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Fechar T{quarter}/{year}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso irá consolidar os resultados de todos os colaboradores participantes nos eventos fechados de T{quarter}/{year}, aplicando penalidades por faltas e classificando os pelotões. Esta ação pode ser refeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => closeMutation.mutate({ data: { year, quarter } })}
                    disabled={closeMutation.isPending}
                  >
                    {closeMutation.isPending ? "Processando..." : "Confirmar Fechamento"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Carregando resultados...</div>
      ) : !results || results.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>Nenhum resultado encontrado para T{quarter}/{year}.</p>
          {canClose && <p className="text-sm mt-1">Clique em "Fechar Trimestre" para gerar os resultados.</p>}
        </div>
      ) : (
        <div className="border rounded-lg overflow-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Colaborador</th>
                <th className="px-4 py-3 text-center font-medium">Eventos</th>
                <th className="px-4 py-3 text-center font-medium">Média Bruta</th>
                <th className="px-4 py-3 text-center font-medium">Faltas</th>
                <th className="px-4 py-3 text-center font-medium">Penalidade</th>
                <th className="px-4 py-3 text-center font-medium">Resultado Final</th>
                <th className="px-4 py-3 text-center font-medium">Pelotão</th>
                <th className="px-4 py-3 text-center font-medium">Bônus Caju</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {results.sort((a, b) => b.finalResult - a.finalResult).map((r) => (
                <tr key={r.employeeId} data-testid={`row-result-${r.employeeId}`} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{r.employeeName}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{r.eventsCount}</td>
                  <td className="px-4 py-3 text-center">{fmt(r.grossAverage)}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{r.totalAbsences}</td>
                  <td className="px-4 py-3 text-center text-destructive">{r.absencePenalty > 0 ? `-${fmt(r.absencePenalty)}` : "—"}</td>
                  <td className="px-4 py-3 text-center font-bold text-primary">{fmt(r.finalResult)}</td>
                  <td className="px-4 py-3 text-center">
                    {r.platoon ? (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: (r.platoonColor ?? "#94a3b8") + "25", color: r.platoonColor ?? "#94a3b8" }}>
                        {r.platoon}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center font-medium text-green-600">
                    {r.bonusValue > 0 ? fmtBRL(r.bonusValue) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
