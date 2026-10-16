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

/** Nota do colaborador no ciclo atual (de /results/quarterly): base do "efeito na nota". */
export interface EmployeeScore {
  eventsCount: number;
  grossAverage: number | null;
  finalResult: number;
}

/** Como a lista está organizada. */
export type ListView = "entries" | "people";
