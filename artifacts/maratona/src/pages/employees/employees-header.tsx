// Topo fixo (o único h1 e as ações), o panorama do ciclo (quem está no ciclo,
// quem está elegível, quem precisa de atenção) e a barra de ferramentas da
// lista (abas, busca e o filtro ativo).
import { Fragment, type ReactNode } from "react";
import { ChevronDown, CreditCard, Eye, GitMerge, Hash, KeyRound, MoreHorizontal, RefreshCw, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn, plural } from "@/lib/utils";
import { Chip, FOCUS_RING, SearchField, Segmented, StatCell, btnGhost, btnSecondary, menuItemCls, surfaceCls, triggerMemo } from "./ui";
import type { AttentionFilter } from "./types";

/** Topo fixo, como em Eventos, Resultados e Ciclos: título, frase e as ações da tela. */
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
  const actions = [
    { key: "merge", label: mergeMode ? "Sair da mesclagem" : "Mesclar duplicatas", hint: mergeMode ? "Volta à lista normal, sem juntar nada." : "Junta cadastros da mesma pessoa em um só.", Icon: mergeMode ? X : GitMerge, on: onToggleMergeMode },
    { key: "access", label: "Gerar acessos em massa", hint: "Login por CPF para quem ainda não tem.", Icon: KeyRound, on: onOpenBulkAccess, testId: "button-bulk-generate-access" },
    { key: "pins", label: "Gerar senhas (casa)", hint: "Senha = CPF de todos os colaboradores casa.", Icon: Hash, on: onOpenBulkPin },
    { key: "types", label: "Redefinir tipos", hint: "Quem é casa (conta no ranking) e quem é freela.", Icon: RefreshCw, on: onOpenResetTypes },
    { key: "cpf", label: "Importar CPFs", hint: "Cola uma lista NOME;CPF e preenche os cadastros.", Icon: CreditCard, on: onOpenBulkCpf },
  ];
  return (
    <div className="md:sticky md:top-0 z-30 bg-card border-b border-border px-4 md:px-6 py-3 lg:py-0 lg:h-16 flex items-center gap-3 lg:gap-5">
      <h1 data-testid="text-page-title" className="min-w-0 font-condensed text-[24px] sm:text-[26px] uppercase tracking-[-0.01em] font-black leading-none text-foreground truncate">Colaboradores</h1>
      <p className="hidden xl:block min-w-0 truncate text-[13px] text-muted-foreground">Quem está no ciclo, quem está elegível e quem precisa de atenção.</p>
      <div className="ml-auto flex items-center gap-2 shrink-0">
        {canBulk && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-testid="button-employees-more-actions"
                aria-label="Mais ações"
                {...triggerMemo}
                className={cn(btnGhost, "px-2.5 lg:px-3 data-[state=open]:bg-secondary data-[state=open]:text-foreground", mergeMode && "text-foreground")}
              >
                <MoreHorizontal size={16} aria-hidden />
                <span className="hidden lg:inline">Mais ações</span>
                <ChevronDown size={14} aria-hidden className="hidden lg:block opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} className="font-body w-[min(320px,calc(100vw-24px))] rounded-xl border-border bg-popover text-popover-foreground p-1.5 shadow-lg">
              <DropdownMenuLabel className="font-condensed px-2.5 pt-1.5 pb-1 text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Ações em massa</DropdownMenuLabel>
              {actions.map((a, i) => (
                <Fragment key={a.key}>
                  {i === 1 && <DropdownMenuSeparator className="my-1 bg-border" />}
                  <DropdownMenuItem data-testid={a.testId} onClick={a.on} className={cn(menuItemCls, "items-start py-2 h-auto")}>
                    <a.Icon size={15} aria-hidden className="mt-0.5 shrink-0" />
                    <span className="min-w-0">
                      <span className="block">{a.label}</span>
                      <span className="font-body block mt-0.5 text-[12.5px] font-normal normal-case tracking-normal text-muted-foreground leading-snug">{a.hint}</span>
                    </span>
                  </DropdownMenuItem>
                </Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {canEdit ? createDialog : <Chip icon={Eye} title="Seu perfil só consulta a lista de colaboradores">Só consulta</Chip>}
      </div>
    </div>
  );
}

export type EmployeeStats = { noCiclo: number; listaNoCiclo: number; elegiveis: number; foraDoCiclo: number; semAcesso: number; repetidos: number };

/**
 * Panorama do ciclo atual: com nota, elegíveis, quem precisa de atenção (sem
 * acesso, nome repetido) e fora do ciclo. Cada célula é atalho para a lista.
 */
export function EmployeesPanel({ stats, canBulk, tab, attention, onTab, onAttention }: {
  stats: EmployeeStats;
  canBulk: boolean;
  tab: "in" | "out";
  attention: AttentionFilter;
  onTab: (t: "in" | "out") => void;
  onAttention: (a: AttentionFilter) => void;
}) {
  const pct = stats.noCiclo > 0 ? Math.round((stats.elegiveis / stats.noCiclo) * 100) : 0;
  const fromPrevious = stats.listaNoCiclo - stats.noCiclo;
  const toggle = (a: Exclude<AttentionFilter, null>) => onAttention(attention === a ? null : a);
  return (
    <section aria-label="Panorama do ciclo" className={cn(surfaceCls, "overflow-hidden grid grid-cols-2 gap-px bg-border", canBulk ? "lg:grid-cols-5" : "lg:grid-cols-3")}>
      <StatCell
        className={cn(CELL, "col-span-2 lg:col-span-1")}
        testId="stat-total"
        label="Com nota no ciclo"
        value={stats.noCiclo}
        sub={fromPrevious > 0
          ? <span data-testid="stat-lista-no-ciclo">+ {fromPrevious} do ciclo anterior, ainda sem nota ({stats.listaNoCiclo} na lista).</span>
          : "Com nota em ao menos um evento."}
        onClick={() => { onTab("in"); onAttention(null); }}
        pressed={tab === "in" && attention === null}
        action="Ver a lista"
      />
      <StatCell
        className={CELL}
        testId="stat-elegiveis"
        label="Elegíveis ao bônus"
        value={stats.elegiveis}
        tone={stats.elegiveis > 0 ? "ok" : "neutral"}
        sub={m(stats.noCiclo > 0 ? `${pct}% de quem tem nota.` : "Sem notas no ciclo ainda.")}
        onClick={() => toggle("eligible")}
        pressed={attention === "eligible"}
        action={attention === "eligible" ? "Filtro ativo · limpar" : "Filtrar"}
      >
        <span aria-hidden className="mt-2.5 block h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-secondary">
          <span className="block h-full rounded-full bg-[var(--status-ok)] transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
        </span>
      </StatCell>
      {canBulk && (
        <StatCell
          className={CELL}
          testId="stat-sem-acesso"
          title="Colaboradores casa da lista No ciclo que ainda não têm login no app"
          label="Sem acesso"
          value={stats.semAcesso}
          tone={stats.semAcesso > 0 ? "warn" : "neutral"}
          sub={m(stats.semAcesso > 0 ? "Casa no ciclo sem login no app." : "Todo casa no ciclo entra no app.")}
          onClick={() => toggle("noAccess")}
          pressed={attention === "noAccess"}
          action={attention === "noAccess" ? "Filtro ativo · limpar" : "Filtrar"}
        />
      )}
      {canBulk && (
        <StatCell
          className={CELL}
          testId="stat-repetidos"
          title="Mesmo nome (sem acento e sem caixa) em mais de um cadastro: pode ser a mesma pessoa"
          label="Nome repetido"
          value={stats.repetidos}
          tone={stats.repetidos > 0 ? "warn" : "neutral"}
          sub={m(stats.repetidos > 0 ? "Cadastros com o mesmo nome." : "Nenhum nome aparece duas vezes.")}
          onClick={() => toggle("dup")}
          pressed={attention === "dup"}
          action={attention === "dup" ? "Filtro ativo · limpar" : "Revisar"}
        />
      )}
      <StatCell
        className={CELL}
        testId="stat-fora-do-ciclo"
        label="Fora do ciclo"
        value={stats.foraDoCiclo}
        sub={m("Tirados pelo admin: sem nota, ranking e bônus neste ciclo.")}
        onClick={() => { onTab("out"); onAttention(null); }}
        pressed={tab === "out" && attention === null}
        action="Ver a lista"
      />
    </section>
  );
}

/** Conteúdo do topo para baixo (o <button> centraliza por padrão). */
const CELL = "flex flex-col";
/** Frase da célula: some no celular para a lista aparecer antes. */
const m = (t: ReactNode) => <span className="hidden sm:inline">{t}</span>;

const ATTENTION_LABEL: Record<Exclude<AttentionFilter, null>, string> = {
  eligible: "Elegíveis ao bônus",
  noAccess: "Casa sem acesso",
  dup: "Nome repetido",
};

/** Abas "No ciclo" × "Fora do ciclo", a busca (também acha quem está sem nota) e o filtro ativo. */
export function EmployeesToolbar({
  search,
  onSearchChange,
  filterCycle,
  onFilterCycleChange,
  counts,
  attention,
  onClearAttention,
  extra,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  filterCycle: "in" | "out";
  onFilterCycleChange: (v: "in" | "out") => void;
  counts: { in: number; out: number };
  attention: AttentionFilter;
  onClearAttention: () => void;
  /** Ação ao lado do filtro ativo (ex.: entrar na mesclagem). */
  extra?: ReactNode;
}) {
  const opt = (v: "in" | "out", label: string) => ({
    value: v,
    testId: `filter-cycle-${v}`,
    label: <>{label} <span className="tabular-nums font-semibold opacity-70">{counts[v]}</span></>,
  });
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
        <Segmented<"in" | "out">
          label="Situação no ciclo"
          value={filterCycle}
          onChange={onFilterCycleChange}
          className="lg:w-[300px] shrink-0"
          options={[opt("in", "No ciclo"), opt("out", "Fora do ciclo")]}
        />
        <SearchField
          value={search}
          onChange={onSearchChange}
          label="Buscar colaborador por nome, função ou departamento"
          placeholder="Buscar por nome, cargo ou departamento"
          testId="input-search-employees"
          className="flex-1 lg:max-w-[440px]"
        />
        {search.trim() && (
          <p className="hidden xl:block text-[12.5px] text-muted-foreground">A busca também acha quem ainda não tem nota.</p>
        )}
      </div>
      {attention && (
        <div className="flex flex-wrap items-center gap-2" data-testid="active-attention-filter">
          <span className="text-[13px] text-muted-foreground">Mostrando só:</span>
          <button type="button" onClick={onClearAttention} aria-label={`Limpar o filtro ${ATTENTION_LABEL[attention]}`}
            className={cn("font-condensed inline-flex items-center gap-1.5 min-h-11 lg:min-h-7 pl-2.5 pr-1.5 rounded-md bg-foreground text-background text-[12.5px] font-bold uppercase tracking-[0.05em] transition-opacity duration-150 hover:opacity-85", FOCUS_RING)}>
            {ATTENTION_LABEL[attention]} <X size={13} aria-hidden />
          </button>
          {extra}
        </div>
      )}
    </div>
  );
}

/** Faixa do modo mesclagem (em cima da lista): o que fazer e como sair. */
export function MergeModeBanner({ selected, onExit }: { selected: number; onExit: () => void }) {
  return (
    <div role="status" data-testid="merge-mode-banner" className="rounded-2xl border border-foreground/25 bg-secondary/60 px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2.5">
      <span className="w-9 h-9 shrink-0 rounded-lg bg-primary text-primary-foreground flex items-center justify-center"><GitMerge size={16} aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="font-condensed text-[16px] font-black uppercase leading-tight">Mesclando duplicatas</p>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {selected < 2 ? "Marque 2 ou mais cadastros da mesma pessoa. Depois escolha qual fica." : `${plural(selected, "cadastro marcado", "cadastros marcados")} — escolha qual fica na barra de baixo.`}
        </p>
      </div>
      <button type="button" onClick={onExit} className={cn(btnSecondary, "w-full sm:w-auto min-h-11 lg:min-h-9 text-[13px]")}><X size={15} aria-hidden /> Sair da mesclagem</button>
    </div>
  );
}
