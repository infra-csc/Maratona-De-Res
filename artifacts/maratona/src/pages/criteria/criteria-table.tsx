import type { Criterion, useUpdateCriterion } from "@workspace/api-client-react";
import { Search } from "lucide-react";
import type { CriterionRouting } from "@/lib/routing-api";
import { PremiumCard } from "@/lib/premium-theme";
import { fieldStyle, evaluatorsForArea } from "./helpers";
import { CriterionRow } from "./criterion-row";
import type { AreaOption, EvaluatorOption } from "./types";

/** Barra de filtros (busca, área, inativos) + tabela de critérios. */
export function CriteriaTable({
  displayedCriteria, baseCount, inactiveCount, showInactive, onToggleInactive,
  searchQuery, onSearchChange, filterAreaId, onFilterAreaChange, areas,
  routingMap, evaluators, updateMutation, onDuplicate, onOpenRouting, onRoutingSaved,
}: {
  displayedCriteria: Criterion[];
  baseCount: number;
  inactiveCount: number;
  showInactive: boolean;
  onToggleInactive: () => void;
  searchQuery: string;
  onSearchChange: (v: string) => void;
  filterAreaId: string;
  onFilterAreaChange: (v: string) => void;
  areas: AreaOption[] | undefined;
  routingMap: Map<number, CriterionRouting>;
  evaluators: (EvaluatorOption & { areaId?: number | null })[];
  updateMutation: ReturnType<typeof useUpdateCriterion>;
  onDuplicate: (c: Criterion) => void;
  onOpenRouting: (id: number) => void;
  onRoutingSaved: () => void;
}) {
  return (
    <PremiumCard className="overflow-hidden">
      {/* Filter bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
          <input
            type="text"
            aria-label="Buscar critério ou descrição"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Buscar critério ou descrição..."
            className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
            style={fieldStyle}
          />
        </div>
        <select
          aria-label="Filtrar por área"
          value={filterAreaId}
          onChange={e => onFilterAreaChange(e.target.value)}
          className="rounded-lg px-3 py-2 text-xs font-bold outline-none min-w-[160px]"
          style={fieldStyle}
        >
          <option value="__all">Todas as áreas</option>
          {(areas ?? []).map(a => (
            <option key={a.id} value={String(a.id)}>{a.name}</option>
          ))}
          <option value="__none">Sem área</option>
        </select>
        <div className="flex items-center gap-3 ml-auto shrink-0">
          <span className="text-xs font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>
            {displayedCriteria.length} de {baseCount}
          </span>
          {inactiveCount > 0 && (
            <button
              type="button"
              onClick={onToggleInactive}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-colors"
              style={showInactive ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" } : { border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
            >
              {showInactive ? "Ocultar Inativos" : `+ Inativos (${inactiveCount})`}
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={{ backgroundColor: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
              <th className="px-5 py-3 text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Critério &amp; Descrição</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Área</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase text-center" style={{ color: "var(--muted-foreground)" }}>Peso</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Avaliador Padrão</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase text-right" style={{ color: "var(--muted-foreground)" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {displayedCriteria.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-16 font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>
                  {searchQuery || filterAreaId !== "__all"
                    ? "Nenhum critério encontrado para esses filtros."
                    : "Nenhum critério configurado."}
                </td>
              </tr>
            )}
            {displayedCriteria.map((c, i) => (
              <CriterionRow
                key={c.id}
                criterion={c}
                index={i}
                routing={routingMap.get(c.id)}
                pickerEvaluators={evaluatorsForArea(evaluators, c.responsibleAreaId)}
                updateMutation={updateMutation}
                onDuplicate={onDuplicate}
                onOpenRouting={onOpenRouting}
                onRoutingSaved={onRoutingSaved}
              />
            ))}
          </tbody>
        </table>
      </div>
    </PremiumCard>
  );
}
