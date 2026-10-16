import { useState } from "react";
import {
  getGetRankingTotalQueryKey, getListCyclesQueryKey,
  useGetQuarterlyResults, getGetQuarterlyResultsQueryKey, exportQuarterlyResults,
  useUpdateBonusPayment,
} from "@workspace/api-client-react";
import type { QuarterlyResult } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Download, SearchX, Wallet2, X } from "lucide-react";
import { cn, plural } from "@/lib/utils";
import { BONUS_STATUS_LABELS, BONUS_STATUS_OPTIONS, useSort, fmtBRLShort, type SortDir } from "./helpers";
import { BONUS_BAR, EligibilityFilter, EmptyBlock, ErrorBlock, Eyebrow, ListSkeleton, SearchField, btnSmall, surfaceCls, type EligFilter } from "./results-ui";
import { PaymentsCards, PaymentsTable } from "./payments-list";
import { PaymentDialog } from "./payment-dialog";
import { EmployeeDetailSheet } from "./employee-detail-sheet";

export function PaymentsTab({ canManage: canManageRole, cycleId, readOnly = false, cycleClosed = false }: { canManage: boolean; cycleId?: string; readOnly?: boolean; /** Ciclo fechado: o bônus é OFICIAL; aberto, é PROJETADO. */ cycleClosed?: boolean }) {
  // Pagamento de ciclo ANTERIOR continua liberado: o bônus é pago depois de o
  // ciclo terminar (ex.: 08/01, com o ciclo seguinte já aberto). Fechar e
  // recalcular ficam no topo, só no ciclo atual. No Total geral não há pagamento por linha.
  const canPay = canManageRole && cycleId !== "all";
  const { toast } = useToast();
  const qc = useQueryClient();
  const [payTarget, setPayTarget] = useState<QuarterlyResult | null>(null);
  const [payForm, setPayForm] = useState({ bonusStatus: "projected", paymentMethod: "Caju Saldo Livre", paymentNotes: "" });
  const [search, setSearch] = useState("");
  const [filterEligible, setFilterEligible] = useState<EligFilter>("all");
  const [sortKey, setSortKey] = useState<keyof QuarterlyResult | null>("finalResult");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const params = cycleId ? { cycleId } : undefined;
  const qKey = getGetQuarterlyResultsQueryKey(params);
  const { data: results, isLoading, isError, refetch } = useGetQuarterlyResults(params, { query: { queryKey: qKey } });

  const paymentMutation = useUpdateBonusPayment({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey });
        // Pago muda o "Bônus pago" do Total geral, dos números de Ciclos e do detalhe.
        qc.invalidateQueries({ queryKey: getGetRankingTotalQueryKey() });
        qc.invalidateQueries({ queryKey: getListCyclesQueryKey() });
        qc.invalidateQueries({ predicate: q => typeof q.queryKey[0] === "string" && q.queryKey[0].startsWith("/cycles/") });
        qc.invalidateQueries({ queryKey: ["/ranking-detail"] as unknown[] });
        toast({ title: "Pagamento atualizado", description: payTarget ? `${payTarget.employeeName} · ${BONUS_STATUS_LABELS[payForm.bonusStatus]?.label ?? payForm.bonusStatus}` : undefined });
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
  const term = search.trim().toLowerCase();
  const matches = (r: QuarterlyResult) => !term || (r.employeeName ?? "").toLowerCase().includes(term);
  const filteredRows = rows.filter(r => {
    if (filterEligible === "eligible" && r.eligible === false) return false;
    if (filterEligible === "ineligible" && r.eligible !== false) return false;
    return matches(r);
  });
  const sortedRows = useSort(filteredRows, sortKey, sortDir);
  const searched = rows.filter(matches);
  const counts = { all: searched.length, eligible: searched.filter(r => r.eligible !== false).length, ineligible: searched.filter(r => r.eligible === false).length };
  const hasFilter = !!term || filterEligible !== "all";

  if (isLoading) return <ListSkeleton label="Carregando bônus e pagamentos" />;
  if (isError) return <ErrorBlock title="Não foi possível carregar o bônus do ciclo" onRetry={() => { void refetch(); }} />;
  if (rows.length === 0) {
    return (
      <div className={cn(surfaceCls, "border-dashed")}>
        <EmptyBlock icon={Wallet2} title="Nenhum resultado apurado" testId="payments-empty">
          {readOnly ? "Não há resultado gerado neste ciclo." : canManageRole ? "Os resultados oficiais saem ao fechar o ciclo, pelo botão Fechar ciclo no topo." : "Não há resultado gerado para o ciclo atual."}
        </EmptyBlock>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PaymentProgress rows={rows} />

      <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
        <SearchField value={search} onChange={setSearch} label="Buscar colaborador em bônus e pagamentos" className="lg:w-72" testId="input-search-payments" />
        <EligibilityFilter value={filterEligible} onChange={setFilterEligible} counts={counts} className="w-full lg:w-auto" />
        <button type="button" data-testid="button-export-results" onClick={handleExport} className={cn(btnSmall, "lg:ml-auto self-start lg:self-auto")}>
          <Download size={15} aria-hidden /> Exportar CSV
        </button>
      </div>

      {sortedRows.length === 0 ? (
        <div className={surfaceCls}>
          <EmptyBlock icon={SearchX} title="Ninguém encontrado" testId="payments-no-results"
            action={hasFilter ? <button type="button" className={btnSmall} onClick={() => { setSearch(""); setFilterEligible("all"); }}><X size={14} aria-hidden /> Limpar filtros</button> : undefined}>
            Nenhum colaborador bate com a busca e o filtro escolhidos.
          </EmptyBlock>
        </div>
      ) : (
        <>
          <PaymentsCards rows={sortedRows} cycleClosed={cycleClosed} canPay={canPay} onOpen={r => setSelectedId(r.employeeId)} onPay={openPayment} />
          <PaymentsTable rows={sortedRows} cycleClosed={cycleClosed} canPay={canPay} sortKey={sortKey} sortDir={sortDir} onSort={handleSort}
            onOpen={r => setSelectedId(r.employeeId)} onPay={openPayment} />
          {hasFilter && <p className="text-[13px] text-muted-foreground" aria-live="polite"><b className="font-semibold text-foreground tabular-nums">{sortedRows.length}</b> de {plural(rows.length, "colaborador", "colaboradores")} com os filtros</p>}
        </>
      )}

      <PaymentDialog
        payTarget={payTarget}
        payForm={payForm}
        setPayForm={setPayForm}
        onClose={() => setPayTarget(null)}
        onSave={savePayment}
        isSaving={paymentMutation.isPending}
        cycleClosed={cycleClosed}
      />

      <EmployeeDetailSheet employeeId={selectedId} onClose={() => setSelectedId(null)} cycleId={cycleId} readOnly={readOnly} />
    </div>
  );
}

/** Andamento do pagamento: quantas pessoas (e quanto) em cada situação. */
function PaymentProgress({ rows }: { rows: QuarterlyResult[] }) {
  const withBonus = rows.filter(r => (r.bonusValue ?? 0) > 0);
  if (withBonus.length === 0) return null;
  const parts = BONUS_STATUS_OPTIONS
    .map(s => {
      const list = withBonus.filter(r => (r.bonusStatus ?? "projected") === s);
      return { s, count: list.length, value: list.reduce((n, r) => n + (r.bonusValue ?? 0), 0) };
    })
    .filter(p => p.count > 0);
  const paid = parts.find(p => p.s === "paid");
  return (
    <section aria-label="Andamento do pagamento" data-testid="payments-progress" className={cn(surfaceCls, "px-4 py-3.5 lg:px-5")}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Eyebrow as="h2">Andamento do pagamento</Eyebrow>
        <span className="text-[13px] text-muted-foreground">
          <b className="font-semibold text-foreground tabular-nums">{paid?.count ?? 0}</b> de {plural(withBonus.length, "pessoa com bônus", "pessoas com bônus")} {(paid?.count ?? 0) === 1 ? "paga" : "pagas"}
        </span>
      </div>
      <span role="img" aria-label={parts.map(p => `${BONUS_STATUS_LABELS[p.s]?.label}: ${plural(p.count, "pessoa", "pessoas")}`).join("; ")}
        className="mt-3 flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-secondary">
        {parts.map(p => (
          <span key={p.s} className={cn("h-full first:rounded-l-full last:rounded-r-full transition-[width] duration-300 motion-reduce:transition-none", BONUS_BAR[p.s])} style={{ width: `${(p.count / withBonus.length) * 100}%` }} />
        ))}
      </span>
      <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
        {parts.map(p => (
          <li key={p.s} className="inline-flex items-center gap-1.5 text-[13px]">
            <span aria-hidden className={cn("w-2.5 h-2.5 rounded-[3px]", BONUS_BAR[p.s])} />
            <span className="font-semibold">{BONUS_STATUS_LABELS[p.s]?.label}</span>
            <span className="text-muted-foreground tabular-nums">{p.count} · {fmtBRLShort(p.value)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
