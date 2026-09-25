import type { Absence } from "@workspace/api-client-react";

export type EntryKind = "penalty" | "merit";

/** Filtro "Tipo" da grade. */
export type FilterKind = "all" | "penalty" | "merit";

/** Valores do formulário "Registrar/Editar Lançamento". */
export interface AbsenceFormData {
  penaltyType: string;
  employeeId: number | null;
  eventId: number | null;
  date: string;
  date2: string;
  quantity: number;
  reason: string;
}

/** Lançamento com o autor, que o servidor manda mas o contrato ainda não declara. */
export type AbsenceWithAuthor = Absence & { registeredByUserName?: string | null };
