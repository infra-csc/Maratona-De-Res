import { useState } from "react";
import {
  getGetRankingQueryKey, getGetRankingTotalQueryKey, getListCyclesQueryKey, getListCycleOptionsQueryKey, getGetCurrentCycleQueryKey,
  useGetQuarterlyResults, getGetQuarterlyResultsQueryKey, exportQuarterlyResults,
  useCloseQuarter, useUpdateBonusPayment, useRecomputeQuarter,
} from "@workspace/api-client-react";
import type { QuarterlyResult } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Download, Wallet, CheckCircle2, Wallet2, Users, Search, RefreshCw } from "lucide-react";
import { cn, plural } from "@/lib/utils";
import { CONDENSED, GOOD_TEXT, DANGER_TEXT } from "@/lib/premium-theme";
import { BONUS_STATUS_LABELS, useSort, onKeyActivate, fmtScore, fmtBRL, fieldStyle, type SortDir } from "./helpers";
import { SortIcon, FaixaBadge } from "./badges";
import { CloseCycleDialog } from "./close-cycle-dialog";
import { PaymentDialog } from "./payment-dialog";
import { EmployeeDetailSheet } from "./employee-detail-sheet";

export function PaymentsTab({ canManage: canManageRole, cycleId, readOnly = false, cycleClosed = false }: { canManage: boolean; cycleId?: string; readOnly?: boolean; /** Ciclo fechado: o bônus é OFICIAL; aberto, é PROJETADO. */ cycleClosed?: boolean }) {
  // Ciclo anterior: só consulta (sem recalcular, fechar nem mexer em pagamento).
  const canManage = canManageRole && !readOnly;
  // Pagamento de ciclo ANTERIOR continua liberado: o bônus é pago depois de o
  // ciclo terminar (ex.: 08/01, com o ciclo seguinte já aberto). Só fechar e
  // recalcular ficam no ciclo atual. No Total geral não há pagamento por linha.
  const canPay = canManageRole && cycleId !== "all";
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

  const params = cycleId ? { cycleId } : undefined;
  const qKey = getGetQuarterlyResultsQueryKey(params);
  const { data: results, isLoading } = useGetQuarterlyResults(params, { query: { queryKey: qKey } });

  const closeMutation = useCloseQuarter({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: qKey });
        qc.invalidateQueries({ queryKey: getGetRankingQueryKey() });
        // O ciclo mudou de situação (fechado): seletor, Ciclos e Total geral.
        qc.invalidateQueries({ queryKey: getGetRankingTotalQueryKey() });
        qc.invalidateQueries({ queryKey: getListCyclesQueryKey() });
        qc.invalidateQueries({ queryKey: getListCycleOptionsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetCurrentCycleQueryKey() });
        toast({ title: `Ciclo fechado! ${plural(data.totalProcessed, "colaborador processado", "colaboradores processados")}.` });
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
        qc.invalidateQueries({ queryKey: getGetRankingTotalQueryKey() });
        qc.invalidateQueries({ queryKey: getListCyclesQueryKey() });
        toast({ title: `Ciclo recalculado! ${plural(data.totalProcessed, "colaborador processado", "colaboradores processados")}.` });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao recalcular ciclo", description: e.message, variant: "destructive" }),
    },
  });

  const paymentMutation = useUpdateBonusPayment({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey });
        // Pago muda o "Bônus pago" do Total geral, dos números de Ciclos e do detalhe.
        qc.invalidateQueries({ queryKey: getGetRankingTotalQueryKey() });
        qc.invalidateQueries({ queryKey: getListCyclesQueryKey() });
        qc.invalidateQueries({ predicate: q => typeof q.queryKey[0] === "string" && q.queryKey[0].startsWith("/cycles/") });
        qc.invalidateQueries({ queryKey: ["/ranking-detail"] as unknown[] });
        toast({ title: "Pagamento atualizado" });
        setPayTarget(null);
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao atualizar pagamento", description: e.message, variant: "destructive" }),
    },
  });

  async function handleExport() {
    try {
      const data = await exportQuarterlyResults(params);
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

  // Colunas da tabela de Bônus & Pagamentos (cabeçalho e linhas usam a MESMA lista).
  const payCols = ["minmax(0,1.5fr)", "minmax(0,1fr)", "minmax(0,0.9fr)", "minmax(0,1.3fr)", "minmax(0,1.2fr)", "minmax(0,1.2fr)", "minmax(0,0.9fr)", "minmax(0,1.2fr)", ...(canPay ? ["minmax(0,0.6fr)"] : [])].join(" ");
  const payHeaderCell = (label: string, key: keyof QuarterlyResult, align: "left" | "center" = "center", title?: string) => (
    <div
      role="columnheader"
      aria-sort={sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("px-2.5 py-3 text-[11px] font-bold uppercase select-none", align === "center" && "text-center")}
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
              <Wallet2 size={15} />
              <p className="font-bold uppercase text-xs tracking-wide" data-testid="payments-bonus-label">{cycleClosed ? "Bônus oficial" : "Bônus projetado"}</p>
            </div>
            <h3 className="text-3xl font-black mt-2 whitespace-nowrap" style={{ fontFamily: CONDENSED }}>{fmtBRL(totalBonus)}</h3>
            <p className="text-[12px] mt-1" style={{ color: "var(--muted-foreground)" }}>{cycleClosed ? "Apurado no fechamento do ciclo" : "Ciclo aberto — muda até o fechamento"}</p>
          </div>
          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
              <CheckCircle2 size={15} />
              <p className="font-bold uppercase text-xs tracking-wide">Elegibilidade</p>
            </div>
            <h3 className="text-3xl font-black mt-2" style={{ fontFamily: CONDENSED }}>{eligibilityPct}%</h3>
            <span className="inline-block mt-2.5 font-black uppercase text-[11px] px-2 py-1 rounded" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>{eligibleCount} de {plural(rows.length, "colaborador", "colaboradores")}</span>
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
          <p className="max-w-md mx-auto" style={{ color: "var(--muted-foreground)" }}>{readOnly ? "Não há dados gerados neste ciclo." : "Não há dados gerados para o ciclo atual."}</p>
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

          {/* Celular/tablet: um cartão por pessoa (a tabela de 9 colunas rolava a página de lado a 390 px). */}
          <ul className="grid gap-2.5 lg:hidden" aria-label="Bônus e pagamentos por colaborador" data-testid="payments-cards">
            {sortedRows.map(r => {
              const statusInfo = r.bonusStatus ? (BONUS_STATUS_LABELS[r.bonusStatus] ?? { label: r.bonusStatus, bg: "var(--secondary)", color: "var(--muted-foreground)" }) : null;
              return (
                <li key={r.employeeId} className="rounded-xl p-3.5 min-w-0" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }} data-testid={`card-result-${r.employeeId}`}>
                  <div className="flex items-start gap-2.5">
                    <button type="button" onClick={() => setSelectedId(r.employeeId)} className="min-w-0 flex-1 text-left" aria-label={`Ver detalhamento de ${r.employeeName}`}>
                      <span className="block font-bold uppercase text-sm break-words">{r.employeeName}</span>
                      <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                        {r.eventsCount ?? 0} com nota · {plural(r.participatedEventsCount ?? 0, "participado", "participados")}
                        {(r.totalAbsences ?? 0) > 0 && <> · <span style={{ color: DANGER_TEXT }}>{plural(r.totalAbsences ?? 0, "penalidade", "penalidades")}</span></>}
                      </span>
                    </button>
                    <span className="shrink-0 text-right">
                      <span className="block font-black text-xl leading-none" style={{ fontFamily: CONDENSED }}>{fmtScore(r.finalResult)}</span>
                      <span className="text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Nota final</span>
                    </span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <FaixaBadge name={r.platoon} minScore={r.platoonMinScore} maxScore={r.platoonMaxScore} color={r.platoonColor} compact />
                    {r.eligible === false ? (
                      <span className="text-[11px] uppercase font-black px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(229,72,77,0.12)", color: DANGER_TEXT }} title={r.eligibilityReason ?? undefined}>Não Elegível</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] uppercase font-black px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(154,176,0,0.14)", color: GOOD_TEXT }}><CheckCircle2 size={10} aria-hidden /> Elegível</span>
                    )}
                    {statusInfo && !(r.eligible === false && r.bonusStatus === "not_eligible") && <span className="text-[11px] uppercase font-black px-2 py-0.5 rounded-full" style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}>{statusInfo.label}</span>}
                  </div>
                  {r.eligible === false && r.eligibilityReason && (
                    <p className="mt-1.5 text-[11px]" style={{ color: "var(--muted-foreground)" }}>{r.eligibilityReason}</p>
                  )}
                  <div className="mt-2.5 flex items-end justify-between gap-2">
                    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[12px] min-w-0">
                      <div className="min-w-0"><dt className="text-[10px] font-bold uppercase" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>{cycleClosed ? "Bônus" : "Bônus projetado"}</dt><dd className="font-black whitespace-nowrap">{fmtBRL(r.bonusValue ?? 0)}</dd></div>
                      <div className="min-w-0" title="Já incluído no bônus"><dt className="text-[10px] font-bold uppercase" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Extra (incluído)</dt><dd className="font-bold whitespace-nowrap">{fmtBRL(r.extraBonusValue ?? 0)}</dd></div>
                    </dl>
                    {canPay && r.id != null && (
                      <button
                        type="button"
                        data-testid={`button-payment-card-${r.employeeId}`}
                        aria-label={`Gerir pagamento de ${r.employeeName}`}
                        onClick={() => openPayment(r)}
                        className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[11px] font-bold uppercase"
                        style={{ fontFamily: CONDENSED, border: "1px solid var(--border)" }}
                      >
                        <Wallet size={14} aria-hidden /> Pagamento
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="rounded-xl overflow-hidden hidden lg:block" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <Wallet size={16} style={{ color: "var(--accent-text)" }} />
              <span className="font-black uppercase tracking-tight text-xs" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>Bônus & Pagamentos</span>
            </div>
            <div className="overflow-x-auto">
              {/* Uma grade só para cabeçalho e linhas (minmax(0, …)): as colunas não mudam
                  de largura conforme o conteúdo de cada linha — antes o selo e o valor
                  empurravam a coluna e as linhas ficavam desalinhadas. */}
              <div className={cn("min-w-[900px]", canPay && "min-w-[960px]")}>
                <div className="grid items-center" style={{ backgroundColor: "var(--secondary)", gridTemplateColumns: payCols }}>
                  {payHeaderCell("Colaborador", "employeeName", "left")}
                  {payHeaderCell("Atividade", "eventsCount")}
                  {payHeaderCell("Nota Final", "finalResult")}
                  {payHeaderCell("Faixa", "platoon")}
                  {payHeaderCell("Elegibilidade", "eligible")}
                  {payHeaderCell(cycleClosed ? "Bônus" : "Bônus projetado", "bonusValue", "center", "Valor total do bônus, já incluindo a parcela extra")}
                  {payHeaderCell("Bônus Extra", "extraBonusValue", "center", "Parcela do Bônus referente a eventos extras — já está incluída no total da coluna Bônus, não some as duas")}
                  {payHeaderCell("Status do Pagamento", "bonusStatus")}
                  {canPay && <div className="px-2.5 py-3 text-[11px] font-bold uppercase text-center" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Ação</div>}
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
                      style={{ borderTop: "1px solid var(--border)", gridTemplateColumns: payCols }}
                      onClick={() => setSelectedId(r.employeeId)}
                      onKeyDown={onKeyActivate(() => setSelectedId(r.employeeId))}
                    >
                      <div className="px-2.5 py-3.5">
                        <div className="font-bold uppercase text-sm break-words">{r.employeeName}</div>
                      </div>
                      <div className="px-2.5 py-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}>{r.eventsCount ?? 0} c/ nota</span>
                          <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>{r.participatedEventsCount ?? 0} {(r.participatedEventsCount ?? 0) === 1 ? "participado" : "participados"}</span>
                          {(r.totalAbsences ?? 0) > 0 && <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(229,72,77,0.12)", color: DANGER_TEXT }}>{plural(r.totalAbsences ?? 0, "penalidade", "penalidades")}</span>}
                        </div>
                      </div>
                      <div className="px-2.5 py-3.5 text-center">
                        <div className="inline-flex items-baseline gap-1">
                          <span className="font-black text-2xl leading-none" style={{ fontFamily: CONDENSED }}>{fmtScore(r.finalResult)}</span>
                          <span className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>/100</span>
                        </div>
                      </div>
                      <div className="px-2.5 py-3.5 text-center">
                        <FaixaBadge name={r.platoon} minScore={r.platoonMinScore} maxScore={r.platoonMaxScore} color={r.platoonColor} />
                      </div>
                      <div className="px-2.5 py-3.5 text-center">
                        {r.eligible === false ? (
                          <span className="inline-block whitespace-nowrap text-[11px] uppercase font-black px-2 py-1 rounded-full cursor-help" style={{ backgroundColor: "rgba(229,72,77,0.12)", color: DANGER_TEXT }} title={r.eligibilityReason ?? undefined}>
                            Não Elegível
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] uppercase font-black px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(154,176,0,0.14)", color: GOOD_TEXT }}>
                            <CheckCircle2 size={10} /> Elegível
                          </span>
                        )}
                      </div>
                      <div className="px-2.5 py-3.5 text-center">
                        {r.bonusValue > 0 ? (
                          <span className="inline-block whitespace-nowrap font-black px-2 py-1 rounded-lg" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>{fmtBRL(r.bonusValue)}</span>
                        ) : (
                          <span className="font-bold whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>R$ 0,00</span>
                        )}
                      </div>
                      <div className="px-2.5 py-3.5 text-center" title="Já incluído no total da coluna Bônus">
                        {(r.extraBonusValue ?? 0) > 0 ? (
                          <span className="inline-block whitespace-nowrap font-black px-2 py-1 rounded-lg" style={{ backgroundColor: "var(--secondary)" }}>{fmtBRL(r.extraBonusValue ?? 0)}</span>
                        ) : (
                          <span className="font-bold whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>R$ 0,00</span>
                        )}
                      </div>
                      <div className="px-2.5 py-3.5 text-center">
                        {statusInfo ? (
                          <span className="inline-block whitespace-nowrap text-[11px] uppercase font-black px-2 py-1 rounded-full" style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}>{statusInfo.label}</span>
                        ) : (
                          <span style={{ color: "var(--muted-foreground)" }}>—</span>
                        )}
                      </div>
                      {canPay && (
                        <div className="px-2.5 py-3.5 text-center">
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

      <EmployeeDetailSheet employeeId={selectedId} onClose={() => setSelectedId(null)} cycleId={cycleId} readOnly={readOnly} />
    </div>
  );
}
