/** Opção de avaliador nos seletores (usuário ativo, fora de "visualizador"). */
export type EvaluatorOption = { id: number; name: string };

/** Opção de área nos seletores. */
export type AreaOption = { id: number; name: string };

/** Área da matriz de conformidade com o resumo das perguntas. */
export type ConformityArea = AreaOption & { description: string };

/** Resultado de "Corrigir Calibrações" (POST /events/admin/fix-calibration-criteria). */
export type FixCalibrationResult = { totalUpdated: number; results: { from: string; to: string; updated: number }[] };

/** Resumo exibido depois de "Sync. Todos os Eventos". */
export type ResyncSummary = {
  processed: number;
  skipped: number;
  totalAdded: number;
  totalDeactivated: number;
  totalActivated: number;
  events: { id: number; name: string; added: number; deactivated: number; activated: number }[];
};
