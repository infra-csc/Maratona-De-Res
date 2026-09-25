import { CheckCircle2, XCircle, Filter, Pencil, Eye, Wifi, WifiOff, Hash } from "lucide-react";
import { CONDENSED, GOOD, PremiumCard, GOOD_TEXT } from "@/lib/premium-theme";
import { employmentTypeLabel, getEligibilityStatus, initials, toTitleCase } from "./utils";
import type { EmployeeWithCycle } from "./types";

type EmployeesTableProps = {
  isLoading: boolean;
  /** Lista já filtrada por busca e tipo. */
  filtered: EmployeeWithCycle[];
  total: number;
  mergeMode: boolean;
  selectedIds: Set<number>;
  canonicalId: number | null;
  canBulk: boolean;
  canEdit: boolean;
  isAdmin: boolean;
  previewingId: number | null;
  generatingPinId: number | null;
  onToggleMergeSelection: (id: number) => void;
  onPreviewAs: (emp: EmployeeWithCycle) => void;
  onGeneratePin: (emp: EmployeeWithCycle) => void;
  onEdit: (emp: EmployeeWithCycle) => void;
};

/** Grid de colaboradores (com coluna de seleção no modo mesclagem, acesso e ações). */
export function EmployeesTable({
  isLoading,
  filtered,
  total,
  mergeMode,
  selectedIds,
  canonicalId,
  canBulk,
  canEdit,
  isAdmin,
  previewingId,
  generatingPinId,
  onToggleMergeSelection,
  onPreviewAs,
  onGeneratePin,
  onEdit,
}: EmployeesTableProps) {
  if (isLoading) {
    return <div className="text-center py-20 font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Carregando colaboradores...</div>;
  }
  return (
    <PremiumCard className="overflow-hidden">
      <div className="px-5 py-3 flex justify-between items-center" style={{ borderBottom: "1px solid var(--border)" }}>
        <h3 className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>Grid de Colaboradores</h3>
        <Filter size={16} style={{ color: "var(--muted-foreground)" }} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={{ backgroundColor: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
              {mergeMode && <th className="px-4 py-3 text-[11px] font-bold uppercase text-center w-10" style={{ color: "var(--muted-foreground)" }}>✓</th>}
              <th className="px-5 py-3 text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Atleta / Colaborador</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Departamento</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Cargo</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase text-center" style={{ color: "var(--muted-foreground)" }}>Tipo</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase text-center" style={{ color: "var(--muted-foreground)" }}>Status</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase text-center" style={{ color: "var(--muted-foreground)" }}>Elegibilidade</th>
              {canBulk && !mergeMode && <th className="px-5 py-3 text-[11px] font-bold uppercase text-center" style={{ color: "var(--muted-foreground)" }}>Acesso</th>}
              {canEdit && !mergeMode && <th className="px-5 py-3 text-[11px] font-bold uppercase text-center" style={{ color: "var(--muted-foreground)" }}>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp, i) => {
              const isSelected = selectedIds.has(emp.id);
              const isCanonical = canonicalId === emp.id;
              return (
              <tr
                key={emp.id}
                data-testid={`row-employee-${emp.id}`}
                onClick={mergeMode ? () => onToggleMergeSelection(emp.id) : undefined}
                className="transition-colors group"
                style={{
                  borderTop: i > 0 ? "1px solid var(--border)" : "none",
                  cursor: mergeMode ? "pointer" : "default",
                  backgroundColor: mergeMode && isSelected ? "rgba(154,176,0,0.10)" : "transparent",
                }}
              >
                {mergeMode && (
                  <td className="px-4 py-3.5 text-center" onClick={e => e.stopPropagation()}>
                    {/* Checkbox real: a linha inteira continua clicável como atalho, mas o teclado e o leitor de tela usam este controle. */}
                    <input
                      type="checkbox"
                      className="w-4 h-4 cursor-pointer align-middle"
                      style={{ accentColor: GOOD }}
                      aria-label={`Selecionar ${toTitleCase(emp.name)} para mesclagem`}
                      checked={isSelected}
                      onChange={() => onToggleMergeSelection(emp.id)}
                    />
                  </td>
                )}
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: isCanonical ? "var(--primary)" : "var(--secondary)" }}>
                      <span className="text-sm font-black" style={{ color: isCanonical ? "var(--primary-foreground)" : "var(--foreground)" }}>{initials(emp.name)}</span>
                    </div>
                    <div>
                      <p className="font-bold">{toTitleCase(emp.name)}</p>
                      {isCanonical && <span className="text-[11px] font-black uppercase rounded px-1" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>CANÔNICO</span>}
                      {emp.email && <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{emp.email}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 font-bold uppercase text-sm">{emp.department}</td>
                <td className="px-5 py-3.5" style={{ color: "var(--muted-foreground)" }}>{emp.functionName}</td>
                <td className="px-5 py-3.5 text-center">
                  <span className="px-2.5 py-1 rounded-full font-bold text-[11px] uppercase" style={{ backgroundColor: emp.employmentType === "freela" ? "var(--secondary)" : "transparent", border: "1px solid var(--border)" }}>
                    {employmentTypeLabel(emp.employmentType)}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-center">
                  {emp.active ? (
                    <span className="px-2.5 py-1 rounded-full font-bold text-[11px] uppercase" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>Ativo</span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full font-bold text-[11px] uppercase" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}>Inativo</span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <EligibilityCell emp={emp} />
                </td>
                {canBulk && !mergeMode && (
                  <td className="px-5 py-3.5 text-center">
                    <AccessCell
                      emp={emp}
                      isAdmin={isAdmin}
                      previewingId={previewingId}
                      generatingPinId={generatingPinId}
                      onPreviewAs={onPreviewAs}
                      onGeneratePin={onGeneratePin}
                    />
                  </td>
                )}
                {canEdit && !mergeMode && (
                  <td className="px-5 py-3.5 text-center">
                    <button
                      type="button"
                      data-testid={`button-edit-employee-${emp.id}`}
                      aria-label={`Editar ${toTitleCase(emp.name)}`}
                      onClick={() => onEdit(emp)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[11px] uppercase transition-colors hover:opacity-80"
                      style={{ border: "1px solid var(--border)" }}
                    >
                      <Pencil size={13} /> Editar
                    </button>
                  </td>
                )}
              </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6 + (mergeMode ? 1 : 0) + (!mergeMode && canBulk ? 1 : 0) + (!mergeMode && canEdit ? 1 : 0)} className="text-center py-16 font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Nenhum colaborador encontrado com os filtros atuais.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3.5" style={{ borderTop: "1px solid var(--border)" }}>
        <span className="text-xs font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Mostrando {filtered.length} de {total} colaboradores</span>
      </div>
    </PremiumCard>
  );
}

/** Coluna "Elegibilidade": status do ciclo atual + contagem de eventos quando houver. */
function EligibilityCell({ emp }: { emp: EmployeeWithCycle }) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 font-bold uppercase text-sm">
      {(() => {
        const status = getEligibilityStatus(emp);
        if (status === "freela") return (
          <span className="flex items-center gap-1.5 opacity-60" style={{ color: "var(--muted-foreground)" }}>— Não pontua</span>
        );
        if (status === "eligible") return (
          <>
            <span className="flex items-center gap-1.5" style={{ color: GOOD_TEXT }}><CheckCircle2 size={16} /> Elegível</span>
            {emp.participatedEventsCount !== null && (
              <span className="text-[11px] font-normal normal-case opacity-60" style={{ color: "var(--muted-foreground)" }}>{emp.participatedEventsCount} eventos</span>
            )}
          </>
        );
        if (status === "not_eligible") return (
          <>
            <span className="flex items-center gap-1.5 opacity-70" style={{ color: "var(--muted-foreground)" }}><XCircle size={16} /> Não Elegível</span>
            {emp.participatedEventsCount !== null && (
              <span className="text-[11px] font-normal normal-case opacity-60" style={{ color: "var(--muted-foreground)" }}>{emp.participatedEventsCount} eventos</span>
            )}
          </>
        );
        return (
          <span className="flex items-center gap-1.5 opacity-60" style={{ color: "var(--muted-foreground)" }}>— Sem dados</span>
        );
      })()}
    </div>
  );
}

/** Coluna "Acesso": com/sem acesso, "Ver visão" (só admin) e "Gerar PIN" (só casa). */
function AccessCell({
  emp,
  isAdmin,
  previewingId,
  generatingPinId,
  onPreviewAs,
  onGeneratePin,
}: {
  emp: EmployeeWithCycle;
  isAdmin: boolean;
  previewingId: number | null;
  generatingPinId: number | null;
  onPreviewAs: (emp: EmployeeWithCycle) => void;
  onGeneratePin: (emp: EmployeeWithCycle) => void;
}) {
  if (emp.hasAccess) {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: GOOD_TEXT }}>
          <Wifi size={11} /> Com acesso
        </span>
        {isAdmin && (
          <button
            type="button"
            title={`Visualizar app como ${emp.name}`}
            disabled={previewingId === emp.id}
            onClick={() => onPreviewAs(emp)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-black text-[11px] uppercase transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            {previewingId === emp.id
              ? <><Eye size={11} className="animate-pulse" /> Abrindo…</>
              : <><Eye size={11} /> Ver visão</>}
          </button>
        )}
        {emp.employmentType === "casa" && (
          <button
            type="button"
            title={`Gerar novo PIN para ${emp.name}`}
            disabled={generatingPinId === emp.id}
            onClick={() => onGeneratePin(emp)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-black text-[11px] uppercase transition-all hover:opacity-90 disabled:opacity-50"
            style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
          >
            {generatingPinId === emp.id
              ? <><Hash size={11} className="animate-spin" /> Gerando…</>
              : <><Hash size={11} /> Gerar PIN</>}
          </button>
        )}
      </div>
    );
  }
  if (emp.employmentType === "casa") {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold opacity-50" style={{ color: "var(--muted-foreground)" }}>
          <WifiOff size={11} /> Sem acesso
        </span>
        <button
          type="button"
          title={`Criar acesso com PIN para ${emp.name}`}
          disabled={generatingPinId === emp.id}
          onClick={() => onGeneratePin(emp)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-black text-[11px] uppercase transition-all hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "#000" }}
        >
          {generatingPinId === emp.id
            ? <><Hash size={11} className="animate-spin" /> Gerando…</>
            : <><Hash size={11} /> Gerar PIN</>}
        </button>
      </div>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold opacity-50" style={{ color: "var(--muted-foreground)" }}>
      <WifiOff size={11} /> Sem acesso
    </span>
  );
}
