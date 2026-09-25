// Tipos compartilhados pelos módulos da página de Detalhe do Evento.
import type React from "react";
import type {
  EventDetail,
  EventTeamResult,
  EventTeamCriterion,
  EventTeamParticipant,
  EventConformity,
  EventParticipant,
  Evaluation,
  Employee,
  User,
} from "@workspace/api-client-react";

export type {
  EventDetail,
  EventTeamResult,
  EventTeamCriterion,
  EventTeamParticipant,
  EventConformity,
  EventParticipant,
  Evaluation,
  Employee,
  User,
};

export type ConformityKey = "epi" | "estaiamentos" | "guardaEquipamentos" | "conduta";
export type ConformityCommentKey = "epiComment" | "estaiamentosComment" | "guardaEquipamentosComment" | "condutaComment";

export type ConformityForm = {
  epi: boolean | null; estaiamentos: boolean | null; guardaEquipamentos: boolean | null; conduta: boolean | null;
  epiComment: string; estaiamentosComment: string; guardaEquipamentosComment: string; condutaComment: string;
  absencesResponse: boolean | null; absencesReport: string;
  standoutResponse: boolean | null; standoutJustification: string;
};

export type ConformityItem = { key: ConformityKey; label: string; commentKey: ConformityCommentKey; group: "cenografia" | "ferramentas" };

/** Nota de critério extraída das observações importadas (eventos históricos). */
export type ImportedCriterionScore = { rawName: string; score: number; scale: number; excluded: boolean; comment?: string };

/** Razão "Conformidade: X/Y itens" extraída das observações importadas. */
export type ImportedConformityRatio = { sim: number; total: number };

/** Justificativa de um avaliador para um critério (avaliações enviadas). */
export type CriterionJustification = { name: string; score: number; comment: string; audioUrl: string | null };

export type ResultsDialogMode = "confirm" | "unconfirm" | null;

export type SetState<T> = React.Dispatch<React.SetStateAction<T>>;
