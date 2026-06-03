import { useState } from "react";
import { useGetQuarterlyResults, useCloseQuarter, useUpdateBonusPayment, exportQuarterlyResults, getGetQuarterlyResultsQueryKey } from "@workspace/api-client-react";
import type { QuarterlyResult } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Download, LockKeyhole, BarChart3, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const currentYear = new Date().getFullYear();
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

const BONUS_STATUS_LABELS: Record<string, { label: string; class: string }> = {
  projected: { label: "Projetado", class: "bg-slate-100 text-slate-700" },
  approved: { label: "Aprovado", class: "bg-blue-100 text-blue-700" },
  scheduled: { label: "Agendado", class: "bg-amber-100 text-amber-700" },
  paid: { label: "Pago", class: "bg-green-100 text-green-700" },
  blocked: { label: "Bloqueado", class: "bg-red-100 text-red-700" },
  not_eligible: { label: "Não elegível", class: "bg-gray-100 text-gray-500" },
};

const BONUS_STATUS_OPTIONS = ["projected", "approved", "scheduled", "paid", "blocked", "not_eligible"];

export default function ResultsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState(currentQuarter);
  const [payTarget, setPayTarget] = useState<QuarterlyResult | null>(null);
  const [payForm, setPayForm] = useState({ bonusStatus: "projected", paymentMethod: "Caju Saldo Livre", paymentNotes: "" });

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

  const fmtScore = (v: number) => v.toFixed(1);
  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const canClose = user && ["admin", "rh"].includes(user.role);
  const canPay = user && ["admin", "rh"].includes(user.role);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 data-testid="text-page-title" className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 size={22} className="text-primary" />
            Resultados Trimestrais
          </h1>
          <p className="text-muted-foreground text-sm">Fechamento, elegibilidade e pagamento do bônus</p>
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
                    Isso irá consolidar os resultados de todos os colaboradores participantes nos eventos fechados de T{quarter}/{year}, aplicando penalidades por faltas, verificando elegibilidade e classificando os pelotões. Esta ação pode ser refeita.
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
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Colaborador</th>
                <th className="px-4 py-3 text-center font-medium">Eventos</th>
                <th className="px-4 py-3 text-center font-medium">Faltas</th>
                <th className="px-4 py-3 text-center font-medium">Resultado Final</th>
                <th className="px-4 py-3 text-center font-medium">Pelotão</th>
                <th className="px-4 py-3 text-center font-medium">Elegível</th>
                <th className="px-4 py-3 text-center font-medium">Bônus Caju</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                {canPay && <th className="px-4 py-3 text-center font-medium">Ação</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {[...results].sort((a, b) => b.finalResult - a.finalResult).map((r) => {
                const statusInfo = r.bonusStatus ? (BONUS_STATUS_LABELS[r.bonusStatus] ?? { label: r.bonusStatus, class: "bg-gray-100 text-gray-700" }) : null;
                return (
                  <tr key={r.employeeId} data-testid={`row-result-${r.employeeId}`} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{r.employeeName}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{r.eventsCount}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{r.totalAbsences}</td>
                    <td className="px-4 py-3 text-center font-bold text-primary">{fmtScore(r.finalResult)}<span className="text-xs font-normal text-muted-foreground">/100</span></td>
                    <td className="px-4 py-3 text-center">
                      {r.platoon ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: (r.platoonColor ?? "#94a3b8") + "25", color: r.platoonColor ?? "#94a3b8" }}>
                          {r.platoon}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.eligible === false ? (
                        <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200" title={r.eligibilityReason ?? undefined}>
                          Não
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Sim</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-green-600">
                      {r.bonusValue > 0 ? fmtBRL(r.bonusValue) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {statusInfo ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusInfo.class}`}>{statusInfo.label}</span>
                      ) : "—"}
                    </td>
                    {canPay && (
                      <td className="px-4 py-3 text-center">
                        {r.id != null && (
                          <Button
                            data-testid={`button-payment-${r.employeeId}`}
                            variant="ghost" size="sm"
                            onClick={() => openPayment(r)}
                          >
                            <Wallet size={14} />
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!payTarget} onOpenChange={o => !o && setPayTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Pagamento do Bônus — {payTarget?.employeeName}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>Status do Pagamento</Label>
              <Select value={payForm.bonusStatus} onValueChange={v => setPayForm(f => ({ ...f, bonusStatus: v }))}>
                <SelectTrigger data-testid="select-bonus-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BONUS_STATUS_OPTIONS.map(s => (
                    <SelectItem key={s} value={s}>{BONUS_STATUS_LABELS[s]?.label ?? s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Método de Pagamento</Label>
              <Input
                data-testid="input-payment-method"
                value={payForm.paymentMethod}
                onChange={e => setPayForm(f => ({ ...f, paymentMethod: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Input
                data-testid="input-payment-notes"
                value={payForm.paymentNotes}
                onChange={e => setPayForm(f => ({ ...f, paymentNotes: e.target.value }))}
                placeholder="Opcional..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPayTarget(null)}>Cancelar</Button>
              <Button data-testid="button-save-payment" onClick={savePayment} disabled={paymentMutation.isPending}>
                {paymentMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
