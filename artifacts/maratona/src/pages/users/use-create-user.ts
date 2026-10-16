import { useState } from "react";
import { useCreateUser } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import type { CreateUserFormValues } from "./types";
import { serverMessage } from "./users-ui";

/** Estado do diálogo "Novo usuário": formulário + mutação de criação (erro do servidor fica no diálogo). */
export function useCreateUserForm(qKey: QueryKey) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<CreateUserFormValues>({
    defaultValues: { role: "avaliador" },
  });
  const { reset } = form;
  // Fechar o diálogo (X, Esc, Cancelar) descarta o rascunho e os erros — não só no sucesso.
  function setCreateOpen(o: boolean) {
    setOpen(o);
    setServerError(null);
    if (!o) reset();
  }

  const createMutation = useCreateUser({
    mutation: {
      onSuccess: (u: User) => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Usuário criado", description: u?.name ? `${u.name} já pode entrar com a senha inicial.` : undefined });
        setOpen(false);
        reset();
      },
      onError: (e: unknown) => setServerError(serverMessage(e, "Não foi possível criar o usuário.")),
    },
  });

  return { open, setCreateOpen, form, createMutation, serverError, setServerError };
}

export type CreateUserFormState = ReturnType<typeof useCreateUserForm>;
