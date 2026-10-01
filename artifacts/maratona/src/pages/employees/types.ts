import type { Employee } from "@workspace/api-client-react";
import type { useToast } from "@/hooks/use-toast";

export type EmploymentType = "casa" | "freela";

// Extra fields injected by GET /employees from quarterly_results for current cycle
export type EmployeeWithCycle = Employee & {
  cycleEligible: boolean | null;
  participatedEventsCount: number | null;
  /** Eventos COM NOTA no ciclo atual (null = sem resultado no ciclo). */
  cycleEventsCount: number | null;
  /** O admin tirou o colaborador do ciclo atual. */
  cycleExcluded: boolean;
  cycleExcludedReason: string | null;
  linkedUserId: number | null;
  hasAccess: boolean;
};

/** Situação no ciclo atual: com nota, fora do ciclo (admin) ou sem nota (não aparece na tela). */
export type CycleStatus = "in" | "out" | "none";

export type EligibilityStatus = "eligible" | "not_eligible" | "freela" | "pending";

/** Filtro de tipo do diálogo "Gerar Acessos em Massa". */
export type BulkTypeFilter = "casa" | "freela" | "all";

/** Dados do diálogo "PIN gerado" (acesso individual). */
export type PinDialogData = { empName: string; pin: string; cpfLogin: string; created: boolean };

/** Função `toast` devolvida por useToast — repassada aos diálogos para não criar outra assinatura do store. */
export type ToastFn = ReturnType<typeof useToast>["toast"];
