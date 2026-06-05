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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Download, LockKeyhole, BarChart3, Wallet, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PlatoonBadge } from "@/components/ui/platoon-badge";
import { Card, CardContent } from "@/components/ui/card";

const currentYear = new Date().getFullYear();
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

const BONUS_STATUS_LABELS: Record<string, { label: string; class: string }> = {
  projected: { label: "Projetado", class: "bg-slate-100 text-slate-700 border-slate-200" },
  approved: { label: "Aprovado", class: "bg-blue-50 text-blue-700 border-blue-200" },
  scheduled: { label: "Agendado", class: "bg-amber-50 text-amber-700 border-amber-200" },
  paid: { label: "Pago", class: "bg-green-50 text-green-700 border-green-200" },
  blocked: { label: "Bloqueado", class: "bg-red-50 text-red-700 border-red-200" },
  not_eligible: { label: "Não elegível", class: "bg-slate-100 text-slate-400 border-slate-200" },
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
  const [forceClose, setForceClose] = useState(false);
  const [forceReason, setForceReason] = useState("");

  const qKey = getGetQuarterlyResultsQueryKey({ year, quarter });
  const { data: results, isLoading } = useGetQuarterlyResults({ year, quarter }, {
    query: { queryKey: qKey },
  });

  const closeMutation = useCloseQuarter({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: `Trimestre fechado! ${data.totalProcessed} colaborador(es) processado(s).` });
        setForceClose(false);
        setForceReason("");
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao fechar trimestre", description: e.message, variant: "destructive" }),
    },
  });

  function handleCloseQuarter() {
    if (forceClose && !forceReason.trim()) {
      toast({ title: "Justificativa obrigatória para fechamento forçado", variant: "destructive" });
      return;
    }
    closeMutation.mutate({
      data: forceClose
        ? { year, quarter, forced: true, reason: forceReason.trim() }
        : { year, quarter },
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
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto bg-slate-50/30 min-h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 data-testid="text-page-title" className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <BarChart3 size={28} className="text-primary" />
            Resultados Trimestrais
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Fechamento consolidado, classificação de pelotões e pagamentos de bônus.</p>
        </div>
        
        <div className="flex gap-2 items-center flex-wrap">
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

          <Button data-testid="button-export-results" variant="outline" className="bg-white shadow-sm" onClick={handleExport}>
            <Download size={15} className="mr-2" /> Exportar
          </Button>
          
          {canClose && (
            <AlertDialog onOpenChange={(o) => { if (!o) { setForceClose(false); setForceReason(""); } }}>
              <AlertDialogTrigger asChild>
                <Button data-testid="button-close-quarter" className="shadow-sm">
                  <LockKeyhole size={15} className="mr-2" /> Fechar Trimestre
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <LockKeyhole size={24} className="text-slate-700" />
                  </div>
                  <AlertDialogTitle className="text-xl">Consolidar Resultados T{quarter}/{year}?</AlertDialogTitle>
                  <AlertDialogDescription className="text-sm leading-relaxed text-slate-600">
                    O fechamento irá congelar as notas, classificar os pelotões oficiais e gerar a projeção de bônus baseada nos eventos já finalizados.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4 py-4 bg-slate-50/50 p-4 rounded-xl border mt-2">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="force-close"
                      data-testid="checkbox-force-close"
                      checked={forceClose}
                      onCheckedChange={(c) => setForceClose(c === true)}
                      className="mt-0.5 border-orange-400 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                    />
                    <Label htmlFor="force-close" className="text-sm font-medium leading-snug cursor-pointer text-slate-700">
                      Existem eventos pendentes. Forçar o fechamento ignorando esses eventos?
                    </Label>
                  </div>
                  {forceClose && (
                    <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2">
                      <Label htmlFor="force-reason" className="text-xs font-bold text-orange-700 uppercase">Justificativa Obrigatória</Label>
                      <Textarea
                        id="force-reason"
                        data-testid="input-force-reason"
                        value={forceReason}
                        onChange={(e) => setForceReason(e.target.value)}
                        placeholder="Por que o trimestre deve ser fechado agora?"
                        className="bg-white border-orange-200 focus-visible:ring-orange-500"
                        rows={3}
                      />
                    </div>
                  )}
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCloseQuarter}
                    disabled={closeMutation.isPending || (forceClose && !forceReason.trim())}
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
        <div className="text-center py-20 text-muted-foreground">Carregando resultados...</div>
      ) : !results || results.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-dashed text-slate-400 shadow-sm">
          <BarChart3 size={48} className="mx-auto mb-4 opacity-20" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Nenhum resultado consolidado</h3>
          <p className="max-w-md mx-auto">Não há dados gerados para T{quarter}/{year}.</p>
          {canClose && <p className="text-sm mt-2 text-slate-500">Clique em "Fechar Trimestre" para gerar os resultados oficiais.</p>}
        </div>
      ) : (
        <Card className="border-none shadow-sm overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-left font-semibold text-slate-500 uppercase tracking-wider text-xs">Colaborador</th>
                  <th className="px-6 py-4 text-center font-semibold text-slate-500 uppercase tracking-wider text-xs">Atividade</th>
                  <th className="px-6 py-4 text-center font-semibold text-slate-500 uppercase tracking-wider text-xs">Nota Final</th>
                  <th className="px-6 py-4 text-center font-semibold text-slate-500 uppercase tracking-wider text-xs">Pelotão Oficial</th>
                  <th className="px-6 py-4 text-center font-semibold text-slate-500 uppercase tracking-wider text-xs">Elegibilidade</th>
                  <th className="px-6 py-4 text-center font-semibold text-slate-500 uppercase tracking-wider text-xs">Bônus</th>
                  <th className="px-6 py-4 text-center font-semibold text-slate-500 uppercase tracking-wider text-xs">Status do Pagamento</th>
                  {canPay && <th className="px-6 py-4 text-center font-semibold text-slate-500 uppercase tracking-wider text-xs">Ação</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...results].sort((a, b) => b.finalResult - a.finalResult).map((r) => {
                  const statusInfo = r.bonusStatus ? (BONUS_STATUS_LABELS[r.bonusStatus] ?? { label: r.bonusStatus, class: "bg-slate-100 text-slate-700" }) : null;
                  
                  return (
                    <tr key={r.employeeId} data-testid={`row-result-${r.employeeId}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{r.employeeName}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">{r.eventsCount} eventos</span>
                          {(r.totalAbsences ?? 0) > 0 && <span className="text-[10px] font-bold text-red-600 border border-red-100 bg-red-50 px-2 py-0.5 rounded-full">{r.totalAbsences} faltas</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-baseline gap-1">
                          <span className="font-black text-xl text-primary leading-none">{fmtScore(r.finalResult)}</span>
                          <span className="text-[10px] font-bold text-primary/50 uppercase">/100</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {r.platoon ? <PlatoonBadge platoon={r.platoon} colorHex={r.platoonColor} /> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {r.eligible === false ? (
                          <Badge variant="outline" className="text-[10px] uppercase font-bold bg-red-50 text-red-700 border-red-200 cursor-help" title={r.eligibilityReason ?? undefined}>
                            Não Elegível
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] uppercase font-bold bg-green-50 text-green-700 border-green-200">
                            <CheckCircle2 size={10} className="mr-1" /> Elegível
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {r.bonusValue > 0 ? (
                          <span className="font-bold text-green-600 bg-green-50 px-3 py-1 rounded-lg border border-green-100">{fmtBRL(r.bonusValue)}</span>
                        ) : (
                          <span className="text-slate-300 font-medium">R$ 0,00</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {statusInfo ? (
                          <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-md border ${statusInfo.class}`}>{statusInfo.label}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      {canPay && (
                        <td className="px-6 py-4 text-center">
                          {r.id != null && (
                            <Button
                              data-testid={`button-payment-${r.employeeId}`}
                              variant="ghost" size="sm"
                              className="h-8 w-8 p-0 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-full"
                              onClick={() => openPayment(r)}
                            >
                              <Wallet size={16} />
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
        </Card>
      )}

      <Dialog open={!!payTarget} onOpenChange={o => !o && setPayTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Gestão de Pagamento</DialogTitle>
            <p className="text-sm font-medium text-slate-500 mt-1">{payTarget?.employeeName} • T{quarter}/{year}</p>
          </DialogHeader>
          <div className="bg-green-50 border border-green-100 p-4 rounded-xl flex items-center justify-between mb-2 mt-4">
            <span className="text-sm font-bold text-green-800 uppercase tracking-wider">Valor do Bônus</span>
            <span className="text-2xl font-black text-green-600">{payTarget ? fmtBRL(payTarget.bonusValue) : "R$ 0,00"}</span>
          </div>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="font-semibold text-slate-700">Status do Bônus</Label>
              <Select value={payForm.bonusStatus} onValueChange={v => setPayForm(f => ({ ...f, bonusStatus: v }))}>
                <SelectTrigger data-testid="select-bonus-status" className="h-11 font-medium">
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
              <Label className="font-semibold text-slate-700">Método de Pagamento</Label>
              <Input
                data-testid="input-payment-method"
                value={payForm.paymentMethod}
                onChange={e => setPayForm(f => ({ ...f, paymentMethod: e.target.value }))}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold text-slate-700">Observações (Opcional)</Label>
              <Textarea
                data-testid="input-payment-notes"
                value={payForm.paymentNotes}
                onChange={e => setPayForm(f => ({ ...f, paymentNotes: e.target.value }))}
                placeholder="Detalhes adicionais sobre o pagamento..."
                className="resize-none"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t mt-2">
              <Button variant="outline" onClick={() => setPayTarget(null)}>Cancelar</Button>
              <Button data-testid="button-save-payment" onClick={savePayment} disabled={paymentMutation.isPending}>
                {paymentMutation.isPending ? "Salvando..." : "Salvar Status"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
