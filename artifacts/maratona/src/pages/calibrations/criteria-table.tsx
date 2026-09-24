// Tabela de critérios da calibração (ou aviso quando o filtro não retorna nada).
import { CONDENSED } from "@/lib/premium-theme";
import { CriterionRow, type CriterionRowSharedProps } from "./criterion-row";
import type { EventCriterion } from "./types";

export type CriteriaTableProps = {
  filteredActiveCriteria: EventCriterion[];
  displayActiveCount: number;
  rowProps: CriterionRowSharedProps;
};

export function CriteriaTable({ filteredActiveCriteria, displayActiveCount, rowProps }: CriteriaTableProps) {
  return (
              filteredActiveCriteria.length === 0 && displayActiveCount > 0 ? (
                <div className="rounded-xl px-5 py-4 text-center" style={{ backgroundColor: "var(--secondary)" }}>
                  <p className="text-sm font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Nenhum critério para o filtro selecionado.</p>
                </div>
              ) : (
                <div className="rounded-xl overflow-x-auto" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  <table className="w-full text-sm border-collapse min-w-[520px]">
                    <thead>
                      <tr style={{ backgroundColor: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
                        <th className="text-left px-3 py-2.5 text-[11px] font-black uppercase tracking-wider" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Critério</th>
                        <th className="text-center px-2 py-2.5 text-[11px] font-black uppercase tracking-wider w-16" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Peso</th>
                        <th className="text-center px-2 py-2.5 text-[11px] font-black uppercase tracking-wider w-20" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }} title="Média das notas enviadas pelos avaliadores da área">Avaliador</th>
                        <th className="text-center px-2 py-2.5 text-[11px] font-black uppercase tracking-wider w-28" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Calibrada</th>
                        <th className="text-center px-2 py-2.5 text-[11px] font-black uppercase tracking-wider w-32 hidden sm:table-cell" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredActiveCriteria.map(c => (
                        <CriterionRow key={c.criterionId} c={c} {...rowProps} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )
  );
}
