import { useState } from "react";
import { useGetQuarterlyResults, useCloseQuarter, useUpdateBonusPayment, exportQuarterlyResults, getGetQuarterlyResultsQueryKey } from "@workspace/api-client-react";
import type { QuarterlyResult } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Download, LockKeyhole, BarChart3, Wallet, CheckCircle2, FilterX, Wallet2, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PlatoonBadge } from "@/components/ui/platoon-badge";

const currentYear = new Date().getFullYear();
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

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

  const rows = results ?? [];
  const totalBonus = rows.reduce((acc, r) => acc + (r.bonusValue ?? 0), 0);
  const eligibleCount = rows.filter(r => r.eligible !== false).length;
  const eligibilityPct = rows.length > 0 ? Math.round((eligibleCount / rows.length) * 100) : 0;

  return (
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="p-6 md:p-10 space-y-8">
        {/* Page header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-l-8 border-[#ccff00] pl-6 py-1">
          <div>
            <h1 data-testid="text-page-title" className="text-4xl md:text-5xl italic uppercase tracking-tighter font-black leading-none">
              Resultados <span className="text-[#ccff00] bg-[#191c1e] px-3 inline-block -rotate-1">Trimestrais</span>
            </h1>
            <p className="text-base md:text-lg text-[#444933] italic mt-2 max-w-2xl">Fechamento consolidado, classificação de pelotões e pagamentos de bônus.</p>
          </div>

          <div className="flex gap-3 items-center flex-wrap">
            <div className="flex border-2 border-[#191c1e] bg-white p-1">
              <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
                <SelectTrigger data-testid="select-year" className="w-24 border-none shadow-none rounded-none font-bold italic uppercase text-xs tracking-wider focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="w-0.5 bg-[#191c1e] my-1 mx-1" />
              <Select value={String(quarter)} onValueChange={v => setQuarter(Number(v))}>
                <SelectTrigger data-testid="select-quarter" className="w-20 border-none shadow-none rounded-none font-bold italic uppercase text-xs tracking-wider focus:ring-0">
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

            <button
              data-testid="button-export-results"
              onClick={handleExport}
              className={`bg-white border-2 border-[#191c1e] px-5 py-3 font-bold text-xs italic uppercase tracking-wider flex items-center gap-2 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
            >
              <Download size={15} /> Exportar
            </button>

            {canClose && (
              <AlertDialog onOpenChange={(o) => { if (!o) { setForceClose(false); setForceReason(""); } }}>
                <AlertDialogTrigger asChild>
                  <button
                    data-testid="button-close-quarter"
                    className={`bg-[#ccff00] text-[#161e00] border-2 border-[#191c1e] px-5 py-3 font-bold text-xs italic uppercase tracking-wider flex items-center gap-2 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
                  >
                    <LockKeyhole size={15} /> Fechar Trimestre
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-md rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
                  <AlertDialogHeader>
                    <div className="w-12 h-12 bg-[#ccff00] border-2 border-[#191c1e] flex items-center justify-center mb-4">
                      <LockKeyhole size={24} className="text-[#161e00]" />
                    </div>
                    <AlertDialogTitle className="text-2xl italic uppercase font-black tracking-tight">Consolidar Resultados T{quarter}/{year}?</AlertDialogTitle>
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
                          placeholder="Por que o trimestre deve ser fechado agora?"
                          className="bg-white rounded-none border-2 border-[#191c1e] focus-visible:ring-0"
                          rows={3}
                        />
                      </div>
                    )}
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-none border-2 border-[#191c1e] font-bold italic uppercase text-xs tracking-wider">Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCloseQuarter}
                      disabled={closeMutation.isPending || (forceClose && !forceReason.trim())}
                      className="rounded-none border-2 border-[#191c1e] bg-[#ccff00] text-[#161e00] hover:bg-[#abd600] font-bold italic uppercase text-xs tracking-wider"
                    >
                      {closeMutation.isPending ? "Processando..." : "Confirmar Fechamento"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </section>

        {/* KPI bento */}
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
            <FilterX size={48} className="mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-black italic uppercase tracking-tight text-[#191c1e] mb-1">Nenhum resultado consolidado</h3>
            <p className="text-[#747a60] italic max-w-md mx-auto">Não há dados gerados para T{quarter}/{year}.</p>
            {canClose && <p className="text-sm mt-2 text-[#444933] italic">Clique em "Fechar Trimestre" para gerar os resultados oficiais.</p>}
          </div>
        ) : (
          <div className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
            <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center gap-2 italic">
              <BarChart3 size={18} />
              <span className="font-black uppercase tracking-tight">Detalhamento Individual</span>
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
                    {canPay && <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Ação</th>}
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
                            <span className="text-[10px] font-bold italic uppercase text-[#444933] bg-[#eceef0] border-2 border-[#191c1e] px-2 py-0.5">{r.eventsCount} eventos</span>
                            {(r.totalAbsences ?? 0) > 0 && <span className="text-[10px] font-bold italic uppercase text-white bg-[#ff5722] border-2 border-[#191c1e] px-2 py-0.5">{r.totalAbsences} faltas</span>}
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
                        {canPay && (
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
      </div>

      <Dialog open={!!payTarget} onOpenChange={o => !o && setPayTarget(null)}>
        <DialogContent className="max-w-md rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
          <DialogHeader>
            <DialogTitle className="text-2xl italic uppercase font-black tracking-tight">Gestão de Pagamento</DialogTitle>
            <p className="text-sm font-bold italic uppercase text-[#747a60] mt-1">{payTarget?.employeeName} • T{quarter}/{year}</p>
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
                className={`bg-[#ccff00] text-[#161e00] border-2 border-[#191c1e] px-5 py-2.5 font-bold text-xs italic uppercase tracking-wider ${HARD_SHADOW} ${HARD_SHADOW_HOVER} disabled:opacity-50`}
              >
                {paymentMutation.isPending ? "Salvando..." : "Salvar Status"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
