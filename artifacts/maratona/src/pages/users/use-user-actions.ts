import { useState } from "react";
import { useUpdateUser, useDeleteUser, useResetUserPassword, useImpersonate } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { serverMessage } from "./users-ui";

/**
 * Ações por linha: editar, redefinir senha, remover e entrar como o usuário
 * ("modo dev", indo para a home ou direto para "Meu Desempenho"). Os erros do
 * servidor ficam dentro do diálogo que os causou (não somem num aviso).
 */
export function useUserActions(qKey: QueryKey) {
  const { impersonate } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [editUser, setEditUserState] = useState<User | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTargetState] = useState<User | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [impersonateTarget, setImpersonateTarget] = useState<string>("/");

  const deleteMutation = useDeleteUser({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Acesso removido", description: deleteTarget ? `${deleteTarget.name} não entra mais no sistema.` : undefined });
        setDeleteTargetState(null);
      },
      onError: (e: unknown) => setDeleteError(serverMessage(e, "Não foi possível remover.")),
    },
  });

  const impersonateMutation = useImpersonate({
    mutation: {
      onSuccess: (res) => {
        impersonate(res.token, res.user);
        const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
        window.location.assign(`${base}${impersonateTarget}`);
      },
      onError: (e: unknown) => toast({ title: "Não foi possível entrar como o usuário", description: serverMessage(e), variant: "destructive" }),
    },
  });

  const updateUserMutation = useUpdateUser({
    mutation: {
      onSuccess: (u: User, vars) => {
        qc.invalidateQueries({ queryKey: qKey });
        const deactivated = vars.data.active === false;
        toast({ title: deactivated ? "Acesso desativado" : "Usuário atualizado", description: u?.name ? (deactivated ? `${u.name} não entra mais; o histórico fica.` : `${u.name} foi salvo.`) : undefined });
        setEditUserState(null);
        setDeleteTargetState(null);
      },
      onError: (e: unknown) => {
        const msg = serverMessage(e, "Não foi possível salvar.");
        if (editUser) setEditError(msg);
        else if (deleteTarget) setDeleteError(msg);
        else toast({ title: "Não foi possível salvar", description: msg, variant: "destructive" });
      },
    },
  });

  const resetPwMutation = useResetUserPassword({
    mutation: {
      onSuccess: () => {
        toast({ title: "Senha redefinida", description: resetUser ? `${resetUser.name} vai trocar a senha no próximo acesso.` : undefined });
        setResetUser(null);
        setNewPassword("");
      },
      onError: (e: unknown) => setResetError(serverMessage(e, "Não foi possível redefinir a senha.")),
    },
  });

  /** Entra como o usuário e, ao voltar do servidor, navega para `target`. */
  function impersonateUser(userId: number, target: string) {
    setImpersonateTarget(target);
    impersonateMutation.mutate({ data: { userId } });
  }

  function openResetPassword(u: User) {
    setNewPassword("");
    setResetError(null);
    setResetUser(u);
  }
  function closeResetPassword() {
    setResetUser(null);
    setNewPassword("");
    setResetError(null);
  }
  function setEditUser(u: User | null) {
    setEditError(null);
    setEditUserState(u);
  }
  function setDeleteTarget(u: User | null) {
    setDeleteError(null);
    setDeleteTargetState(u);
  }

  return {
    deleteMutation, impersonateMutation, impersonateUser,
    editUser, setEditUser, editError, updateUserMutation,
    deleteTarget, setDeleteTarget, deleteError,
    resetUser, newPassword, setNewPassword, resetError, openResetPassword, closeResetPassword, resetPwMutation,
  };
}

export type UserActions = ReturnType<typeof useUserActions>;
