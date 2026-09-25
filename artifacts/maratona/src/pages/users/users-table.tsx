import type { User } from "@workspace/api-client-react";
import { Users, Filter, X } from "lucide-react";
import { CONDENSED, PremiumCard } from "@/lib/premium-theme";
import { fieldStyle } from "./helpers";
import { UserRow } from "./user-row";
import type { UserMergeState } from "./use-user-merge";
import type { UserActions } from "./use-user-actions";

/** "Grade de Acessos": aviso do modo mescla, busca e a tabela de usuários. */
export function UsersTable({
  sortedUsers, total, userSearch, onSearchChange, isAdmin, currentUserId, merge, actions,
}: {
  sortedUsers: User[];
  total: number;
  userSearch: string;
  onSearchChange: (v: string) => void;
  isAdmin: boolean;
  currentUserId: number | undefined;
  merge: UserMergeState;
  actions: UserActions;
}) {
  const { mergeMode } = merge;
  return (
    <PremiumCard className="overflow-hidden">
      <div className="px-5 py-3 flex justify-between items-center" style={{ borderBottom: "1px solid var(--border)" }}>
        <h3 className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>Grade de Acessos</h3>
        {mergeMode ? (
          <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--accent-text)" }}>
            Modo Mescla — selecione avaliadores duplicados
          </span>
        ) : <Filter size={16} style={{ color: "var(--muted-foreground)" }} />}
      </div>
      {mergeMode && (
        <div className="px-5 py-3 text-xs font-semibold" style={{ backgroundColor: "rgba(232,162,61,0.10)", borderBottom: "1px solid var(--border)" }}>
          Selecione todos os usuários duplicados e o <strong>canônico</strong> (conta que será mantida). Avaliações e calibrações serão transferidas para o canônico e os duplicados serão desativados.
        </div>
      )}
      <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="relative max-w-sm">
          <Users size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
          <input
            type="text"
            data-testid="input-search-users"
            aria-label="Buscar usuário por nome, CPF ou e-mail"
            value={userSearch}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Buscar por nome, CPF ou e-mail..."
            className="w-full pl-8 pr-8 py-2 rounded-lg text-sm outline-none"
            style={fieldStyle}
          />
          {userSearch && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 transition-colors hover:opacity-70"
              style={{ color: "var(--muted-foreground)" }}
              aria-label="Limpar busca"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {userSearch && (
          <p className="text-[11px] mt-1" style={{ color: "var(--muted-foreground)" }}>{sortedUsers.length} resultado(s)</p>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={{ backgroundColor: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
              {mergeMode && <th className="px-4 py-3 w-10" />}
              <th className="px-5 py-3 text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Usuário</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Perfil</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Área</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase text-center" style={{ color: "var(--muted-foreground)" }}>Status</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase text-right" style={{ color: "var(--muted-foreground)" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((u, i) => (
              <UserRow
                key={u.id}
                user={u}
                index={i}
                isAdmin={isAdmin}
                currentUserId={currentUserId}
                merge={merge}
                actions={actions}
              />
            ))}
            {sortedUsers.length === 0 && (
              <tr><td colSpan={mergeMode ? 6 : 5} className="text-center py-16 font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>{userSearch ? "Nenhum usuário encontrado." : "Nenhum usuário cadastrado."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3.5" style={{ borderTop: "1px solid var(--border)" }}>
        <span className="text-xs font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Mostrando {sortedUsers.length} de {total} usuários</span>
      </div>
    </PremiumCard>
  );
}
