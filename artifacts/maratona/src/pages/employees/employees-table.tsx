import { CheckCircle2, XCircle, Filter, Pencil, Eye, Wifi, WifiOff, Hash, UserMinus, UserPlus } from "lucide-react";
import { CONDENSED, GOOD, PremiumCard, GOOD_TEXT } from "@/lib/premium-theme";
import { cycleStatus, employmentTypeLabel, getEligibilityStatus, initials, toTitleCase } from "./utils";
import type { EmployeeWithCycle } from "./types";

type EmployeesTableProps = {
  isLoading: boolean;
  /** Lista já filtrada por situação no ciclo e busca. */
  filtered: EmployeeWithCycle[];
  /** Quem bate com a busca e ainda não tem nota no ciclo (só com texto na busca). */
  noScore?: EmployeeWithCycle[];
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
  /** Só admin: tirar do ciclo / devolver ao ciclo. */
  onToggleCycle?: (emp: EmployeeWithCycle) => void;
};

/** Grid de colaboradores (com coluna de seleção no modo mesclagem, acesso e ações). */
export function EmployeesTable({
  isLoading,
  filtered,
  noScore = [],
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
  onToggleCycle,
}: EmployeesTableProps) {
  if (isLoading) {
    return <div className="text-center py-20 font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Carregando colaboradores...</div>;
  }
  const colCount = 6 + (mergeMode ? 1 : 0) + (!mergeMode && canBulk ? 1 : 0) + (!mergeMode && canEdit ? 1 : 0);

  const renderRow = (emp: EmployeeWithCycle, i: number) => {
    const isSelected = selectedIds.has(emp.id);
    const isCanonical = canonicalId === emp.id;
    const status = cycleStatus(emp);
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
          <CycleCell emp={emp} />
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
            <div className="inline-flex flex-col items-stretch gap-1.5">
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
            {/* Sem nota no ciclo: não há o que tirar do ciclo (entra sozinho quando tiver nota). */}
            {onToggleCycle && status !== "none" && (
              <button
                type="button"
                data-testid={`button-cycle-${status === "out" ? "include" : "exclude"}-${emp.id}`}
                onClick={() => onToggleCycle(emp)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[11px] uppercase transition-colors hover:opacity-80"
                style={status === "out"
                  ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }
                  : { border: "1px solid var(--border)", color: "var(--status-danger-text)" }}
              >
                {status === "out" ? <><UserPlus size={13} aria-hidden /> Devolver ao ciclo</> : <><UserMinus size={13} aria-hidden /> Tirar do ciclo</>}
              </button>
            )}
            </div>
          </td>
        )}
      </tr>
    );
  };

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
              <th className="px-5 py-3 text-[11px] font-bold uppercase min-w-[210px]" style={{ color: "var(--muted-foreground)" }}>Atleta / Colaborador</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Departamento</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Cargo</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase text-center" style={{ color: "var(--muted-foreground)" }}>Tipo</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase text-center" style={{ color: "var(--muted-foreground)" }}>No ciclo</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase text-center" style={{ color: "var(--muted-foreground)" }}>Elegibilidade</th>
              {canBulk && !mergeMode && <th className="px-5 py-3 text-[11px] font-bold uppercase text-center" style={{ color: "var(--muted-foreground)" }}>Acesso</th>}
              {canEdit && !mergeMode && <th className="px-5 py-3 text-[11px] font-bold uppercase text-center" style={{ color: "var(--muted-foreground)" }}>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(renderRow)}
            {filtered.length === 0 && (
              <tr><td colSpan={colCount} className="text-center py-16 font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>
                {noScore.length > 0 ? "Ninguém aqui com essa busca — veja abaixo quem ainda não tem nota." : "Ninguém aqui com os filtros atuais."}
              </td></tr>
            )}
          </tbody>
          {noScore.length > 0 && (
            <tbody data-testid="section-no-score" aria-label="Sem nota no ciclo">
              <tr style={{ borderTop: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
                <th scope="rowgroup" colSpan={colCount} className="py-2.5 text-left">
                  {/* Preso à esquerda: no celular a tabela rola na horizontal e o texto ficava cortado. */}
                  <div className="sticky left-0 px-5 max-w-[calc(100vw-3rem)] md:max-w-none">
                    <span className="text-[11px] font-black uppercase tracking-widest" style={{ fontFamily: CONDENSED }}>Sem nota no ciclo <span className="tabular-nums" style={{ color: "var(--muted-foreground)" }}>({noScore.length})</span></span>
                    <span className="block md:inline md:ml-2 text-xs font-normal normal-case" style={{ color: "var(--muted-foreground)" }}>Achados pela busca. Entram em “No ciclo” quando tiverem nota em algum evento.</span>
                  </div>
                </th>
              </tr>
              {noScore.map(renderRow)}
            </tbody>
          )}
        </table>
      </div>
      <div className="px-5 py-3.5" style={{ borderTop: "1px solid var(--border)" }}>
        <span className="text-xs font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>
          Mostrando {filtered.length} de {total} colaboradores{noScore.length > 0 ? ` · + ${noScore.length} sem nota no ciclo` : ""}
        </span>
      </div>
    </PremiumCard>
  );
}

/** Coluna "No ciclo": eventos com nota, "Fora do ciclo" com o motivo, ou "Sem nota". */
function CycleCell({ emp }: { emp: EmployeeWithCycle }) {
  const status = cycleStatus(emp);
  if (status === "out") {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="px-2.5 py-1 rounded-full font-bold text-[11px] uppercase" style={{ backgroundColor: "var(--status-danger-bg)", color: "var(--status-danger-text)" }}>Fora do ciclo</span>
        {emp.cycleExcludedReason && <span className="text-[11px] max-w-[180px] truncate" title={emp.cycleExcludedReason} style={{ color: "var(--muted-foreground)" }}>{emp.cycleExcludedReason}</span>}
      </div>
    );
  }
  if (status === "none") {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="px-2.5 py-1 rounded-full font-bold text-[11px] uppercase whitespace-nowrap" style={{ border: "1px dashed var(--border)", color: "var(--muted-foreground)" }}>Sem nota</span>
        {!emp.active && <span className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Cadastro inativo</span>}
      </div>
    );
  }
  // Na aba "No ciclo" todos têm nota: o selo "Com nota" repetido não dizia nada.
  const n = emp.cycleEventsCount ?? 0;
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-sm font-bold tabular-nums whitespace-nowrap">{n} {n === 1 ? "evento" : "eventos"}</span>
      <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>com nota</span>
      {!emp.active && <span className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Cadastro inativo</span>}
    </div>
  );
}

/** Coluna "Elegibilidade": status do ciclo atual + contagem de eventos quando houver. */
function EligibilityCell({ emp }: { emp: EmployeeWithCycle }) {
  const count = emp.participatedEventsCount;
  const events = count !== null && (
    <span className="text-[11px] font-normal normal-case opacity-60" style={{ color: "var(--muted-foreground)" }}>{count} {count === 1 ? "evento" : "eventos"}</span>
  );
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
            {events}
          </>
        );
        if (status === "not_eligible") return (
          <>
            <span className="flex items-center gap-1.5 opacity-70" style={{ color: "var(--muted-foreground)" }}><XCircle size={16} /> Não Elegível</span>
            {events}
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
