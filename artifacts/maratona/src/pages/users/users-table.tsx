// Barra de ferramentas (busca, papel, situação) e a lista de usuários:
// TABELA nas telas largas e CARTÕES no celular/tablet (renderiza um dos dois).
import type { ReactNode } from "react";
import type { User } from "@workspace/api-client-react";
import { ChevronDown, GitMerge, SearchX, Users } from "lucide-react";
import { cn, plural } from "@/lib/utils";
import { useWideScreen } from "../events/use-wide-screen";
import { EmptyBlock, Notice, ROLE_META, SearchField, Segmented, btnSecondary, selectCls, surfaceCls } from "./users-ui";
import { UserCard, UserRow, type UserRowProps } from "./user-row";
import type { UserMergeState } from "./use-user-merge";
import type { UserActions } from "./use-user-actions";

export type StatusFilter = "all" | "active" | "inactive";

export function UsersToolbar({ search, onSearch, role, onRole, roleCounts, status, onStatus, statusCounts }: {
  search: string; onSearch: (v: string) => void;
  role: string; onRole: (v: string) => void; roleCounts: Record<string, number>;
  status: StatusFilter; onStatus: (v: StatusFilter) => void; statusCounts: Record<StatusFilter, number>;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap sm:items-center gap-2.5">
      <SearchField value={search} onChange={onSearch} label="Buscar usuário por nome, CPF ou e-mail" placeholder="Buscar nome, CPF, e-mail ou colaborador"
        testId="input-search-users" className="flex-1 sm:min-w-[260px] lg:max-w-[400px]" />
      <div className="relative">
        <label htmlFor="filter-users-role" className="sr-only">Papel</label>
        <select id="filter-users-role" data-testid="select-filter-role" value={role} onChange={e => onRole(e.target.value)}
          className={cn(selectCls, "w-full sm:w-[220px] appearance-none cursor-pointer")}>
          <option value="__all">Todos os papéis</option>
          {ROLE_META.map(r => <option key={r.value} value={r.value}>{r.label} · {roleCounts[r.value] ?? 0}</option>)}
        </select>
        <ChevronDown size={14} aria-hidden className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      </div>
      <Segmented<StatusFilter> label="Filtrar por situação" value={status} onChange={onStatus} className="sm:ml-auto"
        options={([["all", "Todos"], ["active", "Ativos"], ["inactive", "Inativos"]] as const).map(([v, l]) => ({
          value: v, testId: `filter-users-${v}`,
          label: <>{l} <span className="tabular-nums font-semibold opacity-70">{statusCounts[v]}</span></>,
        }))} />
    </div>
  );
}

const th = "font-condensed h-11 px-3 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground bg-card border-b border-border md:sticky md:top-16 z-10";

export function UsersList({ users, total, filtering, onClearFilters, isAdmin, currentUserId, merge, actions }: {
  users: User[];
  total: number;
  filtering: boolean;
  onClearFilters: () => void;
  isAdmin: boolean;
  currentUserId: number | undefined;
  merge: UserMergeState;
  actions: UserActions;
}) {
  const wide = useWideScreen();
  const mm = merge.mergeMode;
  const props = (u: User): UserRowProps => ({ user: u, isAdmin, currentUserId, merge, actions });

  const banner: ReactNode = mm && (
    <Notice icon={GitMerge} tone="warn" testId="merge-mode-notice">
      <span className="font-semibold text-foreground">Mesclar duplicados: marque as contas repetidas do mesmo avaliador e escolha a que fica (“Manter esta”).</span>{" "}
      Só avaliadores aparecem neste modo.
      Avaliações, calibrações, matrizes e designações das outras vão para ela, e as outras são desativadas. Dados de ciclo fechado não mudam de avaliador — nesse caso o sistema recusa.
    </Notice>
  );

  if (users.length === 0) {
    return (
      <div className="space-y-3">
        {banner}
        <div className={surfaceCls}>
          {filtering ? (
            <EmptyBlock icon={SearchX} title="Nenhum usuário encontrado" testId="users-no-results"
              action={<button type="button" onClick={onClearFilters} className={btnSecondary}>Limpar filtros</button>}>
              Nada com essa busca ou esses filtros.
            </EmptyBlock>
          ) : (
            <EmptyBlock icon={Users} title="Nenhum usuário cadastrado" testId="users-empty">
              Crie o primeiro acesso em “Novo usuário”.
            </EmptyBlock>
          )}
        </div>
      </div>
    );
  }

  const footer = (
    <p className="text-[13px] text-muted-foreground tabular-nums" data-testid="users-count">
      {filtering ? `Mostrando ${users.length} de ${plural(total, "usuário", "usuários")}` : plural(total, "usuário", "usuários")}
    </p>
  );

  if (!wide) {
    return (
      <div className="space-y-3">
        {banner}
        <ul className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))]" aria-label="Usuários">
          {users.map(u => <UserCard key={u.id} {...props(u)} />)}
        </ul>
        {footer}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {banner}
      <div className={cn(surfaceCls, "overflow-clip")}>
        <table className="w-full border-collapse text-[14px]" aria-label="Usuários">
          <thead>
            <tr>
              {mm && <th className={cn(th, "pl-5 w-10 rounded-tl-2xl")}><span className="sr-only">Selecionar</span></th>}
              <th className={cn(th, mm ? "pl-2" : "pl-5 rounded-tl-2xl", "w-[31%]")}>Usuário</th>
              <th className={th}>Papel</th>
              <th className={th}>Área</th>
              <th className={th}>Colaborador</th>
              <th className={th}>Situação</th>
              <th className={cn(th, "pr-4 w-[110px] rounded-tr-2xl")}><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>{users.map(u => <UserRow key={u.id} {...props(u)} />)}</tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}
