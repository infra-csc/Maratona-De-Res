import type { User } from "@workspace/api-client-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, KeyRound, Building2, Eye, Pencil, LineChart } from "lucide-react";
import { CONDENSED, WARNING, DANGER_TEXT } from "@/lib/premium-theme";
import { getRoleInfo, initials } from "./helpers";
import type { UserMergeState } from "./use-user-merge";
import type { UserActions } from "./use-user-actions";

/**
 * Uma linha da "Grade de Acessos". No modo mescla só avaliadores são
 * selecionáveis (clique na linha ou no checkbox) e as ações normais somem.
 */
export function UserRow({
  user: u, index: i, isAdmin, currentUserId, merge, actions,
}: {
  user: User;
  index: number;
  isAdmin: boolean;
  currentUserId: number | undefined;
  merge: UserMergeState;
  actions: UserActions;
}) {
  const { mergeMode, selectedIds, canonicalId, setCanonicalId, toggleSelected } = merge;
  const { impersonateMutation, impersonateUser, setEditUser, openResetPassword, deleteMutation } = actions;
  const roleInfo = getRoleInfo(u.role);
  const isAvaliador = u.role === "avaliador";
  const isSelected = selectedIds.has(u.id);
  const isCanonical = canonicalId === u.id;
  return (
    <tr
      data-testid={`row-user-${u.id}`}
      className="transition-colors group"
      style={{
        borderTop: i > 0 ? "1px solid var(--border)" : "none",
        cursor: mergeMode && isAvaliador ? "pointer" : "default",
        backgroundColor: isCanonical ? "rgba(154,176,0,0.12)" : isSelected ? "rgba(232,162,61,0.10)" : "transparent",
      }}
      onClick={mergeMode && isAvaliador ? () => toggleSelected(u.id) : undefined}
    >
      {mergeMode && (
        <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
          {isAvaliador ? (
            <input
              type="checkbox"
              className="w-4 h-4 cursor-pointer"
              aria-label={`Selecionar ${u.name} para mescla`}
              checked={isSelected}
              onChange={() => toggleSelected(u.id)}
            />
          ) : <span style={{ color: "var(--muted-foreground)" }}>—</span>}
        </td>
      )}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          {isCanonical && <span className="text-[11px] rounded px-1.5 py-0.5 font-black uppercase shrink-0" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>Canônico</span>}
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--secondary)" }}>
            <span className="text-sm font-black">{initials(u.name)}</span>
          </div>
          <div>
            <p className="font-bold">{u.name}</p>
            {u.email && <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{u.email}</p>}
            {u.cpfLogin && (
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>CPF: {u.cpfLogin}</p>
            )}
            {u.employeeName && (
              <p className="text-[11px] font-bold uppercase mt-0.5" style={{ color: "var(--accent-text)" }}>↳ {u.employeeName}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <span className="px-2.5 py-1 rounded-full font-bold text-[11px] uppercase inline-block" style={{ backgroundColor: roleInfo.bg, color: roleInfo.fg }}>
          {roleInfo.label}
        </span>
      </td>
      <td className="px-5 py-3.5">
        {u.areaName ? (
          <span className="flex items-center gap-2 font-bold uppercase text-xs rounded-lg px-2 py-1 w-max" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}>
            <Building2 size={12} /> {u.areaName}
          </span>
        ) : <span style={{ color: "var(--muted-foreground)" }}>—</span>}
      </td>
      <td className="px-5 py-3.5 text-center">
        <div className="flex flex-col items-center gap-1">
          {u.active ? (
            <span className="px-2.5 py-1 rounded-full font-bold text-[11px] uppercase" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>Ativo</span>
          ) : (
            <span className="px-2.5 py-1 rounded-full font-bold text-[11px] uppercase" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}>Inativo</span>
          )}
          {u.mustChangePassword && (
            <span className="text-[11px] font-bold uppercase" style={{ color: DANGER_TEXT }}>Troca de senha pendente</span>
          )}
        </div>
      </td>
      <td className="px-5 py-3.5 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {mergeMode && isAvaliador && isSelected && (
            <button
              onClick={e => { e.stopPropagation(); setCanonicalId(u.id); }}
              title={isCanonical ? "Conta canônica selecionada" : "Definir como conta canônica (mantida)"}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-colors hover:opacity-85"
              style={isCanonical ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" } : { border: "1px solid var(--border)" }}
            >
              {isCanonical ? "✓ Canônico" : "Definir Canônico"}
            </button>
          )}
          {!mergeMode && isAdmin && u.employeeId != null && u.active && (
            <button
              data-testid={`button-view-performance-${u.id}`}
              onClick={() => impersonateUser(u.id, "/meu-desempenho")}
              disabled={impersonateMutation.isPending}
              title={`Ver perfil de desempenho de ${u.employeeName}`}
              className="p-2 rounded-lg transition-colors disabled:opacity-50 hover:opacity-80"
              style={{ border: "1px solid var(--border)" }}
            >
              <LineChart size={14} />
            </button>
          )}
          {!mergeMode && isAdmin && u.id !== currentUserId && u.active && (
            <button
              data-testid={`button-impersonate-${u.id}`}
              onClick={() => impersonateUser(u.id, "/")}
              disabled={impersonateMutation.isPending}
              title="Visualizar como este usuário (modo dev)"
              className="p-2 rounded-lg transition-colors disabled:opacity-50 hover:opacity-80"
              style={{ border: "1px solid var(--border)" }}
            >
              <Eye size={14} />
            </button>
          )}
          {!mergeMode && <button
            data-testid={`button-edit-user-${u.id}`}
            onClick={() => setEditUser(u)}
            title="Editar usuário"
            className="p-2 rounded-lg transition-colors hover:opacity-80"
            style={{ border: "1px solid var(--border)" }}
          >
            <Pencil size={14} />
          </button>}
          {!mergeMode && <button
            data-testid={`button-reset-pw-${u.id}`}
            onClick={() => openResetPassword(u.id)}
            title="Redefinir senha"
            className="p-2 rounded-lg transition-colors hover:opacity-80"
            style={{ border: "1px solid var(--border)" }}
          >
            <KeyRound size={14} />
          </button>}
          {!mergeMode && isAdmin && u.id !== currentUserId && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  data-testid={`button-delete-user-${u.id}`}
                  title="Remover acesso"
                  className="p-2 rounded-lg transition-colors hover:opacity-80"
                  style={{ border: "1px solid var(--border)", color: DANGER_TEXT }}
                >
                  <Trash2 size={14} />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Remover acesso?</AlertDialogTitle>
                  <AlertDialogDescription style={{ color: "var(--muted-foreground)" }}>
                    O usuário <strong style={{ color: "var(--foreground)" }}>{u.name}</strong> perderá o acesso imediatamente. Esta ação não afeta o histórico de avaliações já feitas.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)" }}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="rounded-lg font-bold uppercase text-xs disabled:opacity-50"
                    style={{ backgroundColor: WARNING, color: "#fff" }}
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate({ id: u.id })}
                  >
                    {deleteMutation.isPending ? "Removendo..." : "Remover Acesso"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </td>
    </tr>
  );
}
