import { useState } from "react";
import { useUpdateUser, useDeleteUser, useResetUserPassword, useImpersonate } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

/**
 * Ações por linha da grade: editar, redefinir senha, remover e entrar como o
 * usuário ("modo dev", indo para a home ou direto para "Meu Desempenho").
 */
export function useUserActions(qKey: QueryKey) {
  const { impersonate } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [resetOpen, setResetOpen] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [editUser, setEditUser] = useState<User | null>(null);
  const [impersonateTarget, setImpersonateTarget] = useState<string>("/");

  const deleteMutation = useDeleteUser({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Usuário removido" });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
    },
  });

  const impersonateMutation = useImpersonate({
    mutation: {
      onSuccess: (res) => {
        impersonate(res.token, res.user);
        const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
        window.location.assign(`${base}${impersonateTarget}`);
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao entrar no modo dev", description: e.message, variant: "destructive" }),
    },
  });

  const updateUserMutation = useUpdateUser({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Usuário atualizado com sucesso" });
        setEditUser(null);
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
    },
  });

  const resetPwMutation = useResetUserPassword({
    mutation: {
      onSuccess: () => {
        setResetOpen(null);
        setNewPassword("");
        toast({ title: "Senha redefinida com sucesso" });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  /** Entra como o usuário e, ao voltar do servidor, navega para `target`. */
  function impersonateUser(userId: number, target: string) {
    setImpersonateTarget(target);
    impersonateMutation.mutate({ data: { userId } });
  }

  function openResetPassword(userId: number) {
    setNewPassword("");
    setResetOpen(userId);
  }

  function closeResetPassword() {
    setResetOpen(null);
    setNewPassword("");
  }

  return {
    deleteMutation, impersonateMutation, impersonateUser,
    editUser, setEditUser, updateUserMutation,
    resetOpen, newPassword, setNewPassword, openResetPassword, closeResetPassword, resetPwMutation,
  };
}

export type UserActions = ReturnType<typeof useUserActions>;
