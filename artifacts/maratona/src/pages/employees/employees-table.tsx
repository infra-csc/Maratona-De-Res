// A lista de colaboradores: TABELA nas telas largas e CARTÕES no celular e no
// tablet (renderiza um dos dois, nunca os dois escondidos por CSS), a seção
// "Sem nota no ciclo" (achados pela busca) e os estados vazios.
import type { ReactNode } from "react";
import { Search, SearchX, UserMinus, Users } from "lucide-react";
import { cn, plural } from "@/lib/utils";
import { useWideScreen } from "../events/use-wide-screen";
import { EmptyBlock, Eyebrow, btnSecondary, surfaceCls } from "./ui";
import { AccessCell, CycleCell, EligibilityCell, NameBlock, RowActions, TypeChip } from "./employee-cells";
import { toTitleCase } from "./utils";
import type { AttentionFilter, EmployeeWithCycle } from "./types";

type EmployeesTableProps = {
  /** Lista já filtrada por situação no ciclo, busca e atalho do painel. */
  filtered: EmployeeWithCycle[];
  /** Quem bate com a busca e ainda não tem nota no ciclo (só com texto na busca). */
  noScore?: EmployeeWithCycle[];
  total: number;
  tab: "in" | "out";
  search: string;
  attention: AttentionFilter;
  onClearSearch: () => void;
  onClearAttention: () => void;
  /** Ids com nome repetido (selo "Nome repetido"). */
  duplicateIds: Set<number>;
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

const th = "font-condensed h-11 px-3 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground bg-card border-b border-border md:sticky md:top-16 z-10";

/** Lista vazia: o porquê e o próximo passo, conforme a aba, a busca e o filtro. */
function EmptyList({ tab, search, attention, onClearSearch, onClearAttention }: Pick<EmployeesTableProps, "tab" | "search" | "attention" | "onClearSearch" | "onClearAttention">) {
  if (search.trim()) {
    return (
      <EmptyBlock icon={SearchX} title="Nada encontrado" testId="employees-no-results"
        action={<button type="button" onClick={onClearSearch} className={btnSecondary}>Limpar busca</button>}>
        Ninguém com “{search.trim()}” no nome, no cargo ou no departamento{attention ? " dentro deste filtro" : ""}.
      </EmptyBlock>
    );
  }
  if (attention) {
    return (
      <EmptyBlock icon={Search} title="Ninguém neste filtro" testId="employees-empty-filter"
        action={<button type="button" onClick={onClearAttention} className={btnSecondary}>Limpar filtro</button>}>
        {attention === "noAccess" ? "Todo colaborador casa desta aba já entra no app." : attention === "dup" ? "Nenhum nome repetido nesta aba." : "Ninguém elegível ao bônus nesta aba ainda."}
      </EmptyBlock>
    );
  }
  if (tab === "out") {
    return (
      <EmptyBlock icon={UserMinus} title="Ninguém fora do ciclo" testId="employees-empty-out">
        Quando o admin tirar alguém do ciclo, a pessoa aparece aqui para poder ser devolvida.
      </EmptyBlock>
    );
  }
  return (
    <EmptyBlock icon={Users} title="Ninguém com nota neste ciclo ainda" testId="employees-empty-in">
      Quem tiver nota em algum evento entra aqui sozinho. Para achar qualquer cadastro, use a busca.
    </EmptyBlock>
  );
}

/** Cabeçalho da seção "Sem nota no ciclo" (mesmo texto na tabela e nos cartões). */
function NoScoreHeading({ count }: { count: number }) {
  return (
    <div className="flex flex-col md:flex-row md:items-baseline gap-x-3 gap-y-1">
      <Eyebrow as="span" className="text-foreground">Sem nota no ciclo <span className="tabular-nums text-muted-foreground">{count}</span></Eyebrow>
      <span className="text-[13px] text-muted-foreground">Achados pela busca. Entram em “No ciclo” quando tiverem nota em algum evento.</span>
    </div>
  );
}

export function EmployeesTable(props: EmployeesTableProps) {
  const wide = useWideScreen();
  const { filtered, noScore = [], total, mergeMode, selectedIds, canonicalId, duplicateIds, canBulk, canEdit } = props;
  const showAccess = canBulk && !mergeMode;
  const showActions = canEdit && !mergeMode;
  const footer = (
    <p className="text-[13px] text-muted-foreground tabular-nums" data-testid="employees-count">
      Mostrando {filtered.length} de {plural(total, "colaborador", "colaboradores")}{noScore.length > 0 ? ` · + ${noScore.length} sem nota no ciclo` : ""}
    </p>
  );
  const emptyTop = filtered.length === 0 && (noScore.length > 0
    ? <p className="px-5 py-6 text-center text-[14px] text-muted-foreground">Ninguém nesta aba com essa busca — veja abaixo quem ainda não tem nota.</p>
    : <EmptyList {...props} />);

  const cellProps = (emp: EmployeeWithCycle) => ({
    emp, canBulk, previewingId: props.previewingId, generatingPinId: props.generatingPinId, onGeneratePin: props.onGeneratePin,
  });
  const actions = (emp: EmployeeWithCycle, variant: "row" | "card") => (
    <RowActions {...cellProps(emp)} variant={variant} canEdit={canEdit} isAdmin={props.isAdmin}
      onEdit={props.onEdit} onPreviewAs={props.onPreviewAs} onToggleCycle={props.onToggleCycle} />
  );
  const mergeCheckbox = (emp: EmployeeWithCycle) => (
    <input
      type="checkbox"
      className="w-[18px] h-[18px] cursor-pointer align-middle accent-[var(--foreground)]"
      aria-label={`Selecionar ${toTitleCase(emp.name)} para mesclagem`}
      checked={selectedIds.has(emp.id)}
      onClick={e => e.stopPropagation()}
      onChange={() => props.onToggleMergeSelection(emp.id)}
    />
  );

  // ── Celular e tablet: cartões ────────────────────────────────────────────
  if (!wide) {
    const card = (emp: EmployeeWithCycle) => {
      const selected = mergeMode && selectedIds.has(emp.id);
      return (
        <li key={emp.id} data-testid={`row-employee-${emp.id}`}
          onClick={mergeMode ? () => props.onToggleMergeSelection(emp.id) : undefined}
          className={cn(surfaceCls, "p-4 flex flex-col gap-3.5 transition-[background-color,box-shadow] duration-150",
            mergeMode && "cursor-pointer", selected && "bg-secondary/70 shadow-[inset_0_0_0_2px_var(--foreground)]")}>
          <div className="flex items-start gap-3">
            {mergeMode && <span className="pt-2.5">{mergeCheckbox(emp)}</span>}
            <div className="min-w-0 flex-1"><NameBlock emp={emp} canonical={canonicalId === emp.id} duplicate={duplicateIds.has(emp.id)} /></div>
            <TypeChip type={emp.employmentType} />
          </div>
          <p className="text-[13px] text-muted-foreground -mt-1.5">
            <span className="font-condensed font-bold uppercase tracking-[0.04em] text-foreground">{emp.department}</span> · {emp.functionName}
          </p>
          <dl className={cn("grid gap-3 border-t border-border pt-3", showAccess ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2")}>
            <div className="min-w-0"><dt><Eyebrow as="span">No ciclo</Eyebrow></dt><dd className="mt-1.5"><CycleCell emp={emp} /></dd></div>
            <div className="min-w-0"><dt><Eyebrow as="span">Elegibilidade</Eyebrow></dt><dd className="mt-1.5"><EligibilityCell emp={emp} /></dd></div>
            {showAccess && <div className="min-w-0"><dt><Eyebrow as="span">Acesso</Eyebrow></dt><dd className="mt-1.5"><AccessCell {...cellProps(emp)} /></dd></div>}
          </dl>
          {showActions && <div className="border-t border-border pt-3">{actions(emp, "card")}</div>}
        </li>
      );
    };
    const grid = "grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))]";
    return (
      <div className="space-y-4" data-testid="employees-cards">
        {filtered.length > 0 ? <ul className={grid} aria-label="Colaboradores">{filtered.map(card)}</ul> : <div className={surfaceCls}>{emptyTop}</div>}
        {noScore.length > 0 && (
          <section data-testid="section-no-score" aria-label="Sem nota no ciclo" className="space-y-2.5 pt-1">
            <NoScoreHeading count={noScore.length} />
            <ul className={grid} aria-label="Sem nota no ciclo">{noScore.map(card)}</ul>
          </section>
        )}
        {footer}
      </div>
    );
  }

  // ── Telas largas: tabela ─────────────────────────────────────────────────
  const colCount = 5 + (mergeMode ? 1 : 0) + (showAccess ? 1 : 0) + (showActions ? 1 : 0);
  const row = (emp: EmployeeWithCycle) => {
    const selected = mergeMode && selectedIds.has(emp.id);
    return (
      <tr key={emp.id} data-testid={`row-employee-${emp.id}`}
        onClick={mergeMode ? () => props.onToggleMergeSelection(emp.id) : undefined}
        className={cn("border-t border-border first:border-t-0 align-top transition-colors duration-150",
          mergeMode ? "cursor-pointer hover:bg-secondary/50" : "hover:bg-secondary/35",
          selected && "bg-secondary/70 hover:bg-secondary/70 shadow-[inset_3px_0_0_var(--foreground)]")}>
        {mergeMode && <td className="pl-5 pr-1 py-4 w-10">{mergeCheckbox(emp)}</td>}
        <td className={cn("py-3.5 pr-3", mergeMode ? "pl-2" : "pl-5")}><NameBlock emp={emp} canonical={canonicalId === emp.id} duplicate={duplicateIds.has(emp.id)} /></td>
        <td className="px-3 py-3.5">
          <p className="font-condensed text-[14px] font-bold uppercase tracking-[0.04em] leading-tight break-words">{emp.department}</p>
          <p className="text-[13px] text-muted-foreground mt-1 break-words">{emp.functionName}</p>
        </td>
        <td className="px-3 py-3.5"><TypeChip type={emp.employmentType} /></td>
        <td className="px-3 py-3.5"><CycleCell emp={emp} /></td>
        <td className="px-3 py-3.5"><EligibilityCell emp={emp} /></td>
        {showAccess && <td className="px-3 py-3.5"><AccessCell {...cellProps(emp)} /></td>}
        {showActions && <td className="pl-3 pr-5 py-3">{actions(emp, "row")}</td>}
      </tr>
    );
  };
  const head: ReactNode = (
    <tr>
      {mergeMode && <th className={cn(th, "pl-5 pr-1 w-10 rounded-tl-2xl")}><span className="sr-only">Selecionar</span></th>}
      <th className={cn(th, "w-[28%] min-w-[220px]", mergeMode ? "pl-2" : "pl-5 rounded-tl-2xl")}>Colaborador</th>
      <th className={cn(th, "w-[17%]")}>Departamento · Cargo</th>
      <th className={cn(th, "w-[88px]")}>Tipo</th>
      <th className={cn(th, "w-[150px]")}>No ciclo</th>
      <th className={cn(th, "w-[160px]")}>Elegibilidade</th>
      {showAccess && <th className={cn(th, "w-[140px]")}>Acesso</th>}
      {showActions && <th className={cn(th, "pr-5 w-[120px] rounded-tr-2xl")}><span className="sr-only">Ações</span></th>}
    </tr>
  );
  return (
    <div className="space-y-3">
      <div className={cn(surfaceCls, "overflow-clip")}>
        <table className="w-full border-collapse text-[14px]" aria-label="Colaboradores">
          <thead>{head}</thead>
          <tbody>
            {filtered.map(row)}
            {emptyTop && <tr><td colSpan={colCount}>{emptyTop}</td></tr>}
          </tbody>
          {noScore.length > 0 && (
            <tbody data-testid="section-no-score" aria-label="Sem nota no ciclo">
              <tr className="border-t border-border bg-secondary/45">
                <th scope="rowgroup" colSpan={colCount} className="pl-5 pr-4 py-2.5 text-left font-normal"><NoScoreHeading count={noScore.length} /></th>
              </tr>
              {noScore.map(row)}
            </tbody>
          )}
        </table>
      </div>
      {footer}
    </div>
  );
}
