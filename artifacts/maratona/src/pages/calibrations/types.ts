// Tipos compartilhados pelos módulos da página de Calibrações.
import type {
  Event as ApiEvent,
  EventCriterion,
  Evaluation,
  Calibration,
} from "@workspace/api-client-react";
import type { useQueryClient } from "@tanstack/react-query";
import type { useToast } from "@/hooks/use-toast";
import type {
  useCalibrationComments,
  useCalibrationAudit,
  useAddCalibrationComment,
  useDeleteCalibrationComment,
} from "@/lib/calibration-api";
import type { getCycleWeekends } from "@/lib/utils";

export type { ApiEvent, EventCriterion, Evaluation, Calibration };

export type EventStatusFilter = "all" | "pending" | "inProgress" | "done";
export type CriterionFilter = "all" | "uncalibrated" | "calibrated";
export type PublishIntent = "partial" | "final";

export type QueryClientLike = ReturnType<typeof useQueryClient>;
export type ToastFn = ReturnType<typeof useToast>["toast"];

// Derivados dos hooks de @/lib/calibration-api para não depender de nomes de interface.
export type CalibrationCommentItem = NonNullable<ReturnType<typeof useCalibrationComments>["data"]>[number];
export type CalibrationAuditItem = NonNullable<ReturnType<typeof useCalibrationAudit>["data"]>[number];
export type AddCommentMutation = ReturnType<typeof useAddCalibrationComment>;
export type DeleteCommentMutation = ReturnType<typeof useDeleteCalibrationComment>;

export type CycleWeekend = ReturnType<typeof getCycleWeekends>[number];

export type ConformityForm = {
  epi: boolean | null; estaiamentos: boolean | null; guardaEquipamentos: boolean | null; conduta: boolean | null;
  epiComment: string; estaiamentosComment: string; guardaEquipamentosComment: string; condutaComment: string;
  absencesReport: string; standoutResponse: boolean | null; standoutJustification: string;
};

// Paleta do seletor de eventos (claro/escuro).
export type PickerPalette = {
  bg: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  activeBg: string;
  activeFg: string;
  itemSel: string;
  itemBorder: string;
  shadow: string;
  chipBorder: string;
  chipText: string;
  searchBorder: string;
};
