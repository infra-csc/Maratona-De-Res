import type { Absence } from "@workspace/api-client-react";
import { UserMinus } from "lucide-react";
import { CONDENSED } from "@/lib/premium-theme";
import { AbsenceRow } from "./absence-row";

/** Grade "Registros de Penalidades e Méritos" (cabeçalho escuro + tabela). */
export function AbsencesTable({ rows, canEdit, typeLabel, onEdit, onDelete }: {
  rows: Absence[];
  canEdit: boolean | null;
  typeLabel: (slug: string) => string;
  onEdit: (a: Absence) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="px-5 py-3.5 flex items-center gap-2" style={{ backgroundColor: "#191c1e" }}>
        <UserMinus size={16} style={{ color: "#d4ff00" }} />
        <span className="font-black uppercase text-sm tracking-tight" style={{ color: "#d4ff00", fontFamily: CONDENSED }}>
          Registros de Penalidades e Méritos
        </span>
        <span className="ml-auto text-[11px] font-bold" style={{ color: "rgba(212,255,0,0.55)" }}>
          {rows.length} registro{rows.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
              <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Colaborador</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Lançamento</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Evento</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Data</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-center" style={{ color: "var(--muted-foreground)" }}>Qtd</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-center" style={{ color: "var(--muted-foreground)" }}>Pontos</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Motivo</th>
              {canEdit && <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-right" style={{ color: "var(--muted-foreground)" }}>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(a => (
              <AbsenceRow key={a.id} a={a} canEdit={canEdit} typeLabel={typeLabel} onEdit={onEdit} onDelete={onDelete} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 8 : 7} className="text-center py-16 text-sm font-bold uppercase tracking-widest" style={{ color: "var(--muted-foreground)" }}>
                  Nenhum lançamento encontrado para os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
