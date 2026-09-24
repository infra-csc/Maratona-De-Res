import type { Event, EventCriterion, EventConformityInput } from "@workspace/api-client-react";
import type { useToast } from "@/hooks/use-toast";
import type { useEventCriterionAssignments, usePublicLinkEligibleCriteria, useMyPrincipalAreas } from "@/lib/routing-api";

// Formulário local da Matriz de Conformidade do avaliador (Cenografia +
// Ferramentas e Case). Espelha o que está salvo no servidor e é editado na tela.
export interface ConformityEvalForm {
  epi: boolean | null; estaiamentos: boolean | null; guardaEquipamentos: boolean | null; conduta: boolean | null;
  epiComment: string; estaiamentosComment: string; guardaEquipamentosComment: string; condutaComment: string;
  absencesResponse: boolean | null; absencesReport: string; standoutResponse: boolean | null; standoutJustification: string;
}

export type ToastFn = ReturnType<typeof useToast>["toast"];

export type EvalTab = "todo" | "done";

export type ConformityLinkType = "cenografia" | "ferramentas";

// Salva um pedaço da matriz no servidor e mostra `successTitle` no toast.
export type SaveConformityFn = (data: EventConformityInput, successTitle: string) => void;

export type CriterionAssignmentRow = NonNullable<ReturnType<typeof useEventCriterionAssignments>["data"]>[number];
export type PublicLinkEligibleCriterion = NonNullable<ReturnType<typeof usePublicLinkEligibleCriteria>["data"]>[number];
export type PrincipalAreaRow = NonNullable<ReturnType<typeof useMyPrincipalAreas>["data"]>[number];

export interface EvaluatorEventStat {
  event: Event;
  total: number;
  submitted: number;
  done: boolean;
  relevant: boolean;
}

export interface AreaGroup {
  areaId: number;
  areaName: string;
  criteria: EventCriterion[];
}

export interface AreaAssignTarget {
  criterionId: number;
  criterionName: string;
  areaId: number;
}

export interface RedirectDialogArea {
  areaId: number;
  areaName: string;
  criteriaIds: number[];
  firstCriterionId: number;
}

export interface RedirectOption {
  id: number;
  name: string;
}
