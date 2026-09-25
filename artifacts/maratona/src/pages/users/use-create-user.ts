import { useState } from "react";
import { useCreateUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import type { CreateUserFormValues } from "./types";

/** Estado do diálogo "Adicionar Acesso": formulário + mutação de criação. */
export function useCreateUserForm(qKey: QueryKey) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const form = useForm<CreateUserFormValues>({
    defaultValues: { role: "avaliador" },
  });
  const { reset } = form;
  // Fechar o diálogo (X, Esc, Cancelar) descarta o rascunho e os erros — não só no sucesso.
  function setCreateOpen(o: boolean) {
    setOpen(o);
    if (!o) reset();
  }

  const createMutation = useCreateUser({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Usuário criado com sucesso" });
        setOpen(false);
        reset();
      },
      onError: (e: { message?: string }) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  return { open, setCreateOpen, form, createMutation };
}

export type CreateUserFormState = ReturnType<typeof useCreateUserForm>;
