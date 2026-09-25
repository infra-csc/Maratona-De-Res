import type { UserInput } from "@workspace/api-client-react";

/** Valores do formulário "Adicionar Acesso". */
export type CreateUserFormValues = UserInput & { role: string };

/** Valores do formulário "Editar Usuário". */
export interface EditUserFormValues {
  name: string;
  email: string;
  role: string;
  areaId: number | null;
  employeeId: number | null;
  active: boolean;
}

/** Opção simples (área ou colaborador) dos seletores. */
export type NamedOption = { id: number; name: string };
