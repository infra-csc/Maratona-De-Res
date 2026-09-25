import type { ReactNode } from "react";
import { KeyRound, GitMerge, X, RefreshCw, Hash, CreditCard, Search } from "lucide-react";
import { CONDENSED, WARNING, GOOD, GOOD_TEXT } from "@/lib/premium-theme";
import { employmentTypeLabel, fieldStyle } from "./utils";
import type { EmploymentType } from "./types";

/** Título da página + botões de ações em massa. O diálogo "Novo Colaborador" entra pelo slot `createDialog`. */
export function EmployeesHeader({
  canEdit,
  canBulk,
  mergeMode,
  onToggleMergeMode,
  onOpenBulkAccess,
  onOpenBulkPin,
  onOpenResetTypes,
  onOpenBulkCpf,
  createDialog,
}: {
  canEdit: boolean;
  canBulk: boolean;
  mergeMode: boolean;
  onToggleMergeMode: () => void;
  onOpenBulkAccess: () => void;
  onOpenBulkPin: () => void;
  onOpenResetTypes: () => void;
  onOpenBulkCpf: () => void;
  createDialog: ReactNode;
}) {
  return (
    <section className="flex flex-col md:flex-row md:items-end justify-between gap-5">
      <div>
        <h1 data-testid="text-page-title" className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-none" style={{ fontFamily: CONDENSED }}>Colaboradores</h1>
        <p className="text-sm mt-1.5" style={{ color: "var(--muted-foreground)" }}>Gestão do time e elegibilidade da Maratona</p>
      </div>
      {canEdit && (
        <div className="flex flex-col sm:flex-row gap-2.5">
          {canBulk && (
            <>
              <button
                type="button"
                onClick={onToggleMergeMode}
                className="h-10 px-4 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center gap-2 transition-colors hover:opacity-85"
                style={mergeMode ? { backgroundColor: WARNING, color: "#fff" } : { border: "1px solid var(--border)" }}
              >
                {mergeMode ? <><X size={16} /> Cancelar Mesclagem</> : <><GitMerge size={16} /> Mesclar Duplicatas</>}
              </button>
              <button
                type="button"
                data-testid="button-bulk-generate-access"
                onClick={onOpenBulkAccess}
                className="h-10 px-4 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center gap-2 transition-colors hover:opacity-80"
                style={{ border: "1px solid var(--border)" }}
              >
                <KeyRound size={16} /> Gerar Acessos em Massa
              </button>
              <button
                type="button"
                onClick={onOpenBulkPin}
                className="h-10 px-4 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center gap-2 transition-colors hover:opacity-90"
                style={{ backgroundColor: "var(--accent)", color: "#000" }}
                title="Define a senha (CPF) de todos os colaboradores casa"
              >
                <Hash size={16} /> Gerar Senhas (Casa)
              </button>
              <button
                type="button"
                onClick={onOpenResetTypes}
                className="h-10 px-4 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center gap-2 transition-colors hover:opacity-80"
                style={{ border: "1px solid var(--border)" }}
                title="Define quais colaboradores contam no ranking (Casa vs Freela)"
              >
                <RefreshCw size={15} /> Redefinir Tipos
              </button>
              <button
                type="button"
                onClick={onOpenBulkCpf}
                className="h-10 px-4 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center gap-2 transition-colors hover:opacity-80"
                style={{ border: "1px solid var(--border)" }}
                title="Importar CPFs para os colaboradores listados"
              >
                <CreditCard size={15} /> Importar CPFs
              </button>
            </>
          )}
          {createDialog}
        </div>
      )}
    </section>
  );
}

export type EmployeeStats = { total: number; ativos: number; elegiveis: number };

/** Cartões de KPI: total, ativos e elegíveis (com barra proporcional ao total). */
export function EmployeesKpis({ stats }: { stats: EmployeeStats }) {
  const pct = (n: number) => (stats.total > 0 ? Math.round((n / stats.total) * 100) : 0);
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Total de Registros</span>
        <p data-testid="stat-total" className="text-4xl leading-none font-black mt-2" style={{ fontFamily: CONDENSED }}>{stats.total}</p>
        <div className="w-full h-1.5 rounded-full mt-4 overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}><div className="h-full rounded-full" style={{ width: "100%", backgroundColor: "var(--foreground)" }} /></div>
      </div>
      <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Ativos</span>
        <p data-testid="stat-ativos" className="text-4xl leading-none font-black mt-2" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>{stats.ativos}</p>
        <div className="w-full h-1.5 rounded-full mt-4 overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}><div className="h-full rounded-full" style={{ width: `${pct(stats.ativos)}%`, backgroundColor: "var(--primary)" }} /></div>
      </div>
      <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Elegíveis para Bônus</span>
        <p data-testid="stat-elegiveis" className="text-4xl leading-none font-black mt-2" style={{ fontFamily: CONDENSED, color: GOOD_TEXT }}>{stats.elegiveis}</p>
        <div className="w-full h-1.5 rounded-full mt-4 overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}><div className="h-full rounded-full" style={{ width: `${pct(stats.elegiveis)}%`, backgroundColor: GOOD }} /></div>
      </div>
    </section>
  );
}

/** Busca + filtros Ativos/Inativos e tipo de contratação. */
export function EmployeesFilters({
  search,
  onSearchChange,
  filterActive,
  onFilterActiveChange,
  filterType,
  onFilterTypeChange,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  filterActive: "true" | "false";
  onFilterActiveChange: (v: "true" | "false") => void;
  filterType: "all" | EmploymentType;
  onFilterTypeChange: (v: "all" | EmploymentType) => void;
}) {
  return (
    <section className="flex flex-col md:flex-row gap-3 items-center flex-wrap">
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
        <input
          data-testid="input-search-employees"
          aria-label="Buscar colaborador por nome, função ou departamento"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full pl-9 h-10 rounded-lg text-sm outline-none"
          style={fieldStyle}
          placeholder="Buscar por nome, função ou departamento..."
        />
      </div>
      <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        {(["true", "false"] as const).map(v => {
          const active = filterActive === v;
          return (
            <button
              key={v}
              data-testid={`filter-active-${v}`}
              onClick={() => onFilterActiveChange(v)}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors"
              style={{ fontFamily: CONDENSED, backgroundColor: active ? "var(--primary)" : "transparent", color: active ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
            >
              {v === "true" ? "Ativos" : "Inativos"}
            </button>
          );
        })}
      </div>
      <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        {(["all", "casa", "freela"] as const).map(v => {
          const active = filterType === v;
          return (
            <button
              key={v}
              data-testid={`filter-type-${v}`}
              onClick={() => onFilterTypeChange(v)}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors"
              style={{ fontFamily: CONDENSED, backgroundColor: active ? "var(--primary)" : "transparent", color: active ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
            >
              {v === "all" ? "Todos os Tipos" : employmentTypeLabel(v)}
            </button>
          );
        })}
      </div>
    </section>
  );
}
