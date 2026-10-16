// Barra de ferramentas (busca, área que avalia, inativos) e a lista do
// catálogo: TABELA nas telas largas e CARTÕES no celular e no tablet
// (renderiza um dos dois). Ativos e inativos ficam em grupos separados.
import type { ReactNode } from "react";
import { Archive, ChevronDown, ListChecks, SearchX } from "lucide-react";
import { cn, plural } from "@/lib/utils";
import { useWideScreen } from "../events/use-wide-screen";
import { EmptyBlock, Eyebrow, SearchField, btnSecondary, btnSmall, selectCls, surfaceCls } from "./criteria-ui";
import { CriterionCard, CriterionRow, type CriterionRowProps } from "./criterion-row";
import type { AreaOption } from "./types";

export type CriterionGroup = { key: "active" | "inactive"; items: CriterionRowProps[] };

/** Busca, "área que avalia" (com contagem) e a alternância dos inativos. */
export function CriteriaToolbar({ search, onSearchChange, areaId, onAreaChange, areaOptions, inactiveCount, showInactive, onToggleInactive }: {
  search: string;
  onSearchChange: (v: string) => void;
  areaId: string;
  onAreaChange: (v: string) => void;
  areaOptions: (AreaOption & { count: number })[];
  inactiveCount: number;
  showInactive: boolean;
  onToggleInactive: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap sm:items-center gap-2.5">
      <SearchField value={search} onChange={onSearchChange} label="Buscar critério ou descrição" placeholder="Buscar critério ou descrição"
        testId="input-search-criteria" className="flex-1 sm:min-w-[260px] lg:max-w-[400px]" />
      <div className="relative">
        <label htmlFor="filter-criteria-area" className="sr-only">Área que avalia</label>
        <select id="filter-criteria-area" data-testid="select-filter-area" value={areaId} onChange={e => onAreaChange(e.target.value)}
          className={cn(selectCls, "w-full sm:w-[240px] appearance-none cursor-pointer")}>
          <option value="__all">Todas as áreas</option>
          {areaOptions.map(a => <option key={a.id} value={String(a.id)}>{a.name} · {a.count}</option>)}
          <option value="__none">Sem área responsável</option>
        </select>
        <ChevronDown size={14} aria-hidden className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      </div>
      {inactiveCount > 0 && (
        <button type="button" data-testid="button-toggle-inactive" aria-pressed={showInactive} onClick={onToggleInactive}
          className={cn(btnSmall, "sm:ml-auto", showInactive && "bg-secondary border-foreground/30")}>
          <Archive size={14} aria-hidden /> {showInactive ? "Esconder inativos" : "Mostrar inativos"}
          <span className="tabular-nums font-semibold opacity-70">{inactiveCount}</span>
        </button>
      )}
    </div>
  );
}

const th = "font-condensed h-11 px-3 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground bg-card border-b border-border md:sticky md:top-16 z-10";

function GroupHeading({ group, count }: { group: CriterionGroup["key"]; count: number }) {
  return (
    <div className="flex flex-col md:flex-row md:items-baseline gap-x-3 gap-y-1">
      <Eyebrow as="span" className="text-foreground">{group === "active" ? "Ativos" : "Inativos"} <span className="tabular-nums text-muted-foreground">{count}</span></Eyebrow>
      <span className="text-[13px] text-muted-foreground">
        {group === "active"
          ? "Entram nos eventos novos e nos ainda não confirmados."
          : "Fora dos eventos novos. Eventos confirmados guardam o critério como histórico."}
      </span>
    </div>
  );
}

export function CriteriaList({ groups, filtering, onClearFilters, totalActive }: {
  groups: CriterionGroup[];
  /** Busca ou filtro de área ligados (muda o texto do vazio). */
  filtering: boolean;
  onClearFilters: () => void;
  totalActive: number;
}) {
  const wide = useWideScreen();
  const visible = groups.filter(g => g.items.length > 0);
  const shown = groups.find(g => g.key === "active")?.items.length ?? 0;

  if (visible.length === 0) {
    return (
      <div className={surfaceCls}>
        {filtering ? (
          <EmptyBlock icon={SearchX} title="Nenhum critério encontrado" testId="criteria-no-results"
            action={<button type="button" onClick={onClearFilters} className={btnSecondary}>Limpar filtros</button>}>
            Nada com essa busca ou essa área. Tente outro termo ou veja todas as áreas.
          </EmptyBlock>
        ) : (
          <EmptyBlock icon={ListChecks} title="Nenhum critério ativo" testId="criteria-empty-active">
            Todos os critérios estão desativados. Mostre os inativos para reativar algum.
          </EmptyBlock>
        )}
      </div>
    );
  }

  const footer = (
    <p className="text-[13px] text-muted-foreground tabular-nums" data-testid="criteria-count">
      {filtering ? `Mostrando ${shown} de ${plural(totalActive, "critério ativo", "critérios ativos")}` : plural(totalActive, "critério ativo", "critérios ativos")}
    </p>
  );

  if (!wide) {
    return (
      <div className="space-y-5" data-testid="criteria-cards">
        {visible.map(g => (
          <section key={g.key} aria-label={g.key === "active" ? "Critérios ativos" : "Critérios inativos"} data-testid={`criteria-group-${g.key}`} className="space-y-2.5">
            {(g.key === "inactive" || visible.length > 1) && <GroupHeading group={g.key} count={g.items.length} />}
            <ul className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))]">
              {g.items.map(p => <CriterionCard key={p.criterion.id} {...p} />)}
            </ul>
          </section>
        ))}
        {footer}
      </div>
    );
  }

  const head: ReactNode = (
    <tr>
      <th className={cn(th, "pl-5 w-[27%] min-w-[220px] rounded-tl-2xl")}>Critério</th>
      <th className={cn(th, "w-[29%]")}>Quem avalia</th>
      <th className={cn(th, "w-[112px]")}>Peso</th>
      <th className={cn(th, "w-[20%]")}>Avaliador padrão</th>
      <th className={cn(th, "w-[136px] text-right")}>Situação</th>
      <th className={cn(th, "pr-4 w-14 rounded-tr-2xl")}><span className="sr-only">Ações</span></th>
    </tr>
  );
  return (
    <div className="space-y-3">
      <div className={cn(surfaceCls, "overflow-clip")}>
        <table className="w-full border-collapse text-[14px]" aria-label="Critérios de avaliação">
          <thead>{head}</thead>
          {visible.map(g => (
            <tbody key={g.key} data-testid={`criteria-group-${g.key}`} aria-label={g.key === "active" ? "Critérios ativos" : "Critérios inativos"}>
              {(g.key === "inactive" || visible.length > 1) && (
                <tr className="border-t border-border bg-secondary/45">
                  <th scope="rowgroup" colSpan={6} className="pl-5 pr-4 py-2.5 text-left font-normal"><GroupHeading group={g.key} count={g.items.length} /></th>
                </tr>
              )}
              {g.items.map(p => <CriterionRow key={p.criterion.id} {...p} />)}
            </tbody>
          ))}
        </table>
      </div>
      {footer}
    </div>
  );
}
