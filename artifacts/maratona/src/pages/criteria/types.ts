/** Opção de avaliador nos seletores (usuário ativo, fora de "visualizador"). */
export type EvaluatorOption = { id: number; name: string };

/** Opção de área nos seletores. */
export type AreaOption = { id: number; name: string; active?: boolean };

/** Área da matriz de conformidade com o resumo das perguntas. */
export type ConformityArea = AreaOption & { questions: string[]; extra: string | null; note: string | null };

/** Resultado de "Corrigir Calibrações" (POST /events/admin/fix-calibration-criteria). */
export type FixCalibrationResult = {
  totalUpdated: number;
  results: { from: string; to: string; updated: number }[];
  /** Eventos de ciclo fechado que ficaram como estavam (só consulta). */
  skippedClosedCycle?: { eventId: number; eventName: string }[];
};

/** Resumo exibido depois de "Sync. Todos os Eventos". */
export type ResyncSummary = {
  processed: number;
  skipped: number;
  /** Dos pulados, os de ciclo fechado (só consulta). */
  skippedClosedCycle: number;
  /** Eventos que deram erro ao sincronizar (os outros seguiram). */
  failures: { id: number; name: string; error: string }[];
  totalAdded: number;
  totalDeactivated: number;
  totalActivated: number;
  events: { id: number; name: string; added: number; deactivated: number; activated: number }[];
};
