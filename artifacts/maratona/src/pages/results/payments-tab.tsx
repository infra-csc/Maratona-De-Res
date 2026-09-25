import { useState } from "react";
import {
  getGetRankingQueryKey,
  useGetQuarterlyResults, getGetQuarterlyResultsQueryKey, exportQuarterlyResults,
  useCloseQuarter, useUpdateBonusPayment, useRecomputeQuarter,
} from "@workspace/api-client-react";
import type { QuarterlyResult } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Download, Wallet, CheckCircle2, Wallet2, Users, Search, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONDENSED, GOOD_TEXT, DANGER_TEXT } from "@/lib/premium-theme";
import { BONUS_STATUS_LABELS, useSort, onKeyActivate, fmtScore, fmtBRL, fieldStyle, type SortDir } from "./helpers";
import { SortIcon, FaixaBadge } from "./badges";
import { CloseCycleDialog } from "./close-cycle-dialog";
import { PaymentDialog } from "./payment-dialog";
import { EmployeeDetailSheet } from "./employee-detail-sheet";

export function PaymentsTab({ canManage }: { canManage: boolean }) {
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
        qc.invalidateQueries({ queryKey: getGetRankingQueryKey() });
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

  // Cards de resumo: sempre sobre o ciclo inteiro (`rows`), independentes da busca/filtro da tabela,
  // para que numerador, denominador e o card "Colaboradores" falem do mesmo conjunto.
  const totalBonus = rows.reduce((acc, r) => acc + (r.bonusValue ?? 0), 0);
  const eligibleCount = rows.filter(r => r.eligible !== false).length;
  const eligibilityPct = rows.length > 0 ? Math.round((eligibleCount / rows.length) * 100) : 0;
  const sortedRows = useSort(filteredRows, sortKey, sortDir);

  const payHeaderCell = (label: string, key: keyof QuarterlyResult, align: "left" | "center" = "center", title?: string) => (
    <div
      role="columnheader"
      aria-sort={sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("px-4 py-3 text-[11px] font-bold uppercase select-none", align === "center" && "text-center")}
      style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}
      title={title}
    >
      <button
        type="button"
        onClick={() => handleSort(key)}
        className="inline-flex items-center gap-1 uppercase transition-colors hover:opacity-70 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        style={{ fontFamily: CONDENSED, color: "inherit" }}
      >
        {label}
        <SortIcon active={sortKey === key} dir={sortDir} />
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="flex gap-2.5 items-center flex-wrap justify-end">
        <button
          data-testid="button-export-results"
          onClick={handleExport}
          className="rounded-lg px-4 py-2.5 font-bold text-xs uppercase tracking-wide flex items-center gap-2 transition-colors hover:opacity-80"
          style={{ fontFamily: CONDENSED, border: "1px solid var(--border)" }}
        >
          <Download size={15} /> Exportar
        </button>

        {canManage && (
          <button
            data-testid="button-recompute-quarter"
            onClick={() => recomputeMutation.mutate()}
            disabled={recomputeMutation.isPending}
            title="Recalcula os resultados do ciclo atual agora, sem fechar o ciclo (ex.: após alterar o cargo de um colaborador)"
            className="rounded-lg px-4 py-2.5 font-bold text-xs uppercase tracking-wide flex items-center gap-2 disabled:opacity-50 transition-colors hover:opacity-80"
            style={{ fontFamily: CONDENSED, border: "1px solid var(--border)" }}
          >
            <RefreshCw size={15} className={recomputeMutation.isPending ? "animate-spin" : ""} /> {recomputeMutation.isPending ? "Recalculando..." : "Recalcular Ciclo"}
          </button>
        )}

        {canManage && (
          <CloseCycleDialog
            forceClose={forceClose}
            setForceClose={setForceClose}
            forceReason={forceReason}
            setForceReason={setForceReason}
            onConfirm={handleCloseCycle}
            isPending={closeMutation.isPending}
          />
        )}
      </section>

      {rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
              <Wallet2 size={15} />
              <p className="font-bold uppercase text-xs tracking-wide">Total em Bônus</p>
            </div>
            <h3 className="text-3xl font-black mt-2" style={{ fontFamily: CONDENSED }}>{fmtBRL(totalBonus)}</h3>
          </div>
          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
              <CheckCircle2 size={15} />
              <p className="font-bold uppercase text-xs tracking-wide">Elegibilidade</p>
            </div>
            <h3 className="text-3xl font-black mt-2" style={{ fontFamily: CONDENSED }}>{eligibilityPct}%</h3>
            <span className="inline-block mt-2.5 font-black uppercase text-[11px] px-2 py-1 rounded" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>{eligibleCount} de {rows.length} colaborador{rows.length !== 1 ? "es" : ""}</span>
          </div>
          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
              <Users size={15} />
              <p className="font-bold uppercase text-xs tracking-wide">Colaboradores</p>
            </div>
            <h3 className="text-3xl font-black mt-2" style={{ fontFamily: CONDENSED }}>{rows.length}</h3>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-20 font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Carregando resultados...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-24 rounded-xl" style={{ border: "1px dashed var(--border)" }}>
          <Wallet2 size={44} className="mx-auto mb-4 opacity-20" />
          <h3 className="text-xl font-black uppercase tracking-tight mb-1" style={{ fontFamily: CONDENSED }}>Nenhum resultado consolidado</h3>
          <p className="max-w-md mx-auto" style={{ color: "var(--muted-foreground)" }}>Não há dados gerados para o ciclo atual.</p>
          {canManage && <p className="text-sm mt-2" style={{ color: "var(--muted-foreground)" }}>Clique em "Fechar Ciclo" para gerar os resultados oficiais.</p>}
        </div>
      ) : (
        <div className="space-y-3.5">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative max-w-md flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 h-11 rounded-lg text-sm outline-none"
                style={fieldStyle}
                placeholder="Buscar colaborador..."
                aria-label="Buscar colaborador em bônus e pagamentos"
              />
            </div>
            <select aria-label="Filtrar por elegibilidade" value={filterEligible} onChange={e => setFilterEligible(e.target.value as "all" | "eligible" | "ineligible")} className="h-11 rounded-lg px-3 text-sm font-bold" style={fieldStyle}>
              <option value="all">Todos</option>
              <option value="eligible">Elegíveis</option>
              <option value="ineligible">Não elegíveis</option>
            </select>
          </div>

          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <Wallet size={16} style={{ color: "var(--accent-text)" }} />
              <span className="font-black uppercase tracking-tight text-xs" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>Bônus & Pagamentos</span>
            </div>
            <div className="overflow-x-auto">
              <div className={cn("min-w-[900px]", canManage && "min-w-[980px]")}>
                <div className="grid items-center" style={{ backgroundColor: "var(--secondary)", gridTemplateColumns: canManage ? "1.6fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 0.7fr" : "1.6fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr" }}>
                  {payHeaderCell("Colaborador", "employeeName", "left")}
                  {payHeaderCell("Atividade", "eventsCount")}
                  {payHeaderCell("Nota Final", "finalResult")}
                  {payHeaderCell("Faixa", "platoon")}
                  {payHeaderCell("Elegibilidade", "eligible")}
                  {payHeaderCell("Bônus", "bonusValue", "center", "Valor total do bônus, já incluindo a parcela extra")}
                  {payHeaderCell("Bônus Extra", "extraBonusValue", "center", "Parcela do Bônus referente a eventos extras — já está incluída no total da coluna Bônus, não some as duas")}
                  {payHeaderCell("Status do Pagamento", "bonusStatus")}
                  {canManage && <div className="px-4 py-3 text-[11px] font-bold uppercase text-center" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Ação</div>}
                </div>
                {sortedRows.map((r) => {
                  const statusInfo = r.bonusStatus ? (BONUS_STATUS_LABELS[r.bonusStatus] ?? { label: r.bonusStatus, bg: "var(--secondary)", color: "var(--muted-foreground)" }) : null;
                  return (
                    <div
                      key={r.employeeId}
                      data-testid={`row-result-${r.employeeId}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`Ver detalhamento de ${r.employeeName}`}
                      className="grid items-center transition-colors cursor-pointer group hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
                      style={{ borderTop: "1px solid var(--border)", gridTemplateColumns: canManage ? "1.6fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 0.7fr" : "1.6fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr" }}
                      onClick={() => setSelectedId(r.employeeId)}
                      onKeyDown={onKeyActivate(() => setSelectedId(r.employeeId))}
                    >
                      <div className="px-4 py-3.5">
                        <div className="font-bold uppercase text-sm">{r.employeeName}</div>
                      </div>
                      <div className="px-4 py-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}>{r.eventsCount ?? 0} c/ nota</span>
                          <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>{r.participatedEventsCount ?? 0} participados</span>
                          {(r.totalAbsences ?? 0) > 0 && <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(229,72,77,0.12)", color: DANGER_TEXT }}>{r.totalAbsences} penalidades</span>}
                        </div>
                      </div>
                      <div className="px-4 py-3.5 text-center">
                        <div className="inline-flex items-baseline gap-1">
                          <span className="font-black text-2xl leading-none" style={{ fontFamily: CONDENSED }}>{fmtScore(r.finalResult)}</span>
                          <span className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>/100</span>
                        </div>
                      </div>
                      <div className="px-4 py-3.5 text-center">
                        <FaixaBadge name={r.platoon} minScore={r.platoonMinScore} maxScore={r.platoonMaxScore} color={r.platoonColor} />
                      </div>
                      <div className="px-4 py-3.5 text-center">
                        {r.eligible === false ? (
                          <span className="inline-block text-[11px] uppercase font-black px-2 py-1 rounded-full cursor-help" style={{ backgroundColor: "rgba(229,72,77,0.12)", color: DANGER_TEXT }} title={r.eligibilityReason ?? undefined}>
                            Não Elegível
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] uppercase font-black px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(154,176,0,0.14)", color: GOOD_TEXT }}>
                            <CheckCircle2 size={10} /> Elegível
                          </span>
                        )}
                      </div>
                      <div className="px-4 py-3.5 text-center">
                        {r.bonusValue > 0 ? (
                          <span className="font-black px-2.5 py-1 rounded-lg" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>{fmtBRL(r.bonusValue)}</span>
                        ) : (
                          <span className="font-bold" style={{ color: "var(--muted-foreground)" }}>R$ 0,00</span>
                        )}
                      </div>
                      <div className="px-4 py-3.5 text-center" title="Já incluído no total da coluna Bônus">
                        {(r.extraBonusValue ?? 0) > 0 ? (
                          <span className="font-black px-2.5 py-1 rounded-lg" style={{ backgroundColor: "var(--secondary)" }}>{fmtBRL(r.extraBonusValue ?? 0)}</span>
                        ) : (
                          <span className="font-bold" style={{ color: "var(--muted-foreground)" }}>R$ 0,00</span>
                        )}
                      </div>
                      <div className="px-4 py-3.5 text-center">
                        {statusInfo ? (
                          <span className="text-[11px] uppercase font-black px-2.5 py-1 rounded-full" style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}>{statusInfo.label}</span>
                        ) : (
                          <span style={{ color: "var(--muted-foreground)" }}>—</span>
                        )}
                      </div>
                      {canManage && (
                        <div className="px-4 py-3.5 text-center">
                          {r.id != null && (
                            <button
                              type="button"
                              data-testid={`button-payment-${r.employeeId}`}
                              aria-label={`Gerir pagamento de ${r.employeeName}`}
                              className="p-2 rounded-lg transition-colors hover:opacity-80"
                              style={{ color: "var(--muted-foreground)", border: "1px solid transparent" }}
                              onClick={(e) => { e.stopPropagation(); openPayment(r); }}
                            >
                              <Wallet size={15} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <PaymentDialog
        payTarget={payTarget}
        payForm={payForm}
        setPayForm={setPayForm}
        onClose={() => setPayTarget(null)}
        onSave={savePayment}
        isSaving={paymentMutation.isPending}
      />

      <EmployeeDetailSheet employeeId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
