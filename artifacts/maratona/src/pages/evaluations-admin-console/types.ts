// Tipos compartilhados da Central de Avaliações (console admin).

export type CritState = "unassigned" | "pending" | "partial" | "done";

export type ConsoleView = "assign" | "table" | "people" | "criterios";
export type QueueTab = "todo" | "done";
export type QueueSort = "name" | "pct" | "pending" | "data" | "urgencia";
export type ConformityFilter = "all" | "pending" | "done";
export type CritFilter = "all" | "unassigned" | "pending" | "partial" | "done";
export type ConformityKey = "cenografia" | "ferramentas";
export type EvaluatorsScope = "all" | "event";

export interface CritRow {
  criterionId: number;
  criterionName: string;
  areaId: number | null;
  areaName: string;
  assignedToId: number | null;
  assignedToName: string | null;
  /** Nome que a pessoa digitou no formulário — pode diferir do atribuído (ex: freelancer via link) */
  formSubmitterName: string | null;
  state: CritState;
  submittedAt: string | null;
  score: number | null;
  comments: string | null;
  audioUrl: string | null;
}

export interface EnrichedEvent {
  id: number;
  name: string;
  clientName: string | null;
  city: string | null;
  state: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  criteria: CritRow[];
  total: number;
  done: number;
  unassigned: number;
  pct: number;
  areaNames: string[];
  evaluatorNames: string[];
  /** Concluído = TODOS os critérios ativos completos. Publicação (parcial ou
   *  final) NÃO conclui o evento — vira apenas um badge informativo. */
  isDone: boolean;
  partialPublishedCount: number;
  finalCalibratedCriteria: number;
  conformityNeeded: boolean;
  conformityComplete: boolean;
  /** Cada lado da matriz respondido por quem foi atribuído (vem da lista de eventos). */
  conformityCenografiaDone: boolean;
  conformityFerramentasDone: boolean;
  // Avaliadores da Matriz de Conformidade (incluídos na vista global de avaliadores)
  conformityEvaluatorUserId?: number | null;
  conformityEvaluatorName?: string | null;
  conformityEvaluatorFerramentasUserId?: number | null;
  conformityEvaluatorFerramentasName?: string | null;
}

/** "Gerar todos os links" (um por avaliador/área, Cenografia já combina critério + matriz) */
export interface BatchLink {
  key: string;
  evaluatorName: string;
  areaName: string;
  criterionNames: string[];
  includeConformity: boolean;
  url: string | null;
  error: string | null;
  /** true = link PENDENTE já existente, reaproveitado em vez de criar outro */
  reused: boolean;
}

/** Link Freelancer dialog (critério) */
export interface LinkDialogState {
  criterionIds: number[];
  criterionNames: string[];
  assignedToId: number;
  assignedToName: string;
  includeConformity: boolean;
}

/** Link dialog para Matriz de Conformidade */
export interface ConformityLinkDialogState {
  key: ConformityKey;
  label: string;
  evaluatorId: number | null;
  evaluatorName: string | null;
}

/** Linha da Matriz de conformidade (Cenografia + Ferramentas) do evento selecionado. */
export interface ConformityRow {
  key: ConformityKey;
  name: string;
  scope: string;
  evaluatorId: number | null;
  evaluatorName: string | null;
  filled: number;
  total: number;
  areaId: number;
}

/** Configuração local (editável) de um critério do evento na aba Critérios. */
export interface CriterionConfigItem {
  id: number;
  criterionId: number;
  active: boolean;
  weight: number;
  name: string;
  eventScoped: boolean;
}

export type CritPillCounts = Record<CritFilter, number>;

export interface QueueFilters {
  q: string;
  areaFilter: string;
  evaluatorFilter: string;
  filterDateFrom: string;
  filterDateTo: string;
  sort: QueueSort;
  conformityFilter: ConformityFilter;
  noEvaluatorFilter: boolean;
}

export interface PendingEvaluatorStats {
  name: string;
  assigned: number;
  submitted: number;
  pendingEvents: { id: number; name: string }[];
}

interface CardStyle {
  label: string;
  bg: string;
  color: string;
  accent: string;
}

/** Card da aba Avaliadores — visão por evento. */
export interface EventEvaluatorCard extends CardStyle {
  id: number;
  name: string;
  area: string;
  assigned: number;
  submitted: number;
  pct: number;
}

/** Card da aba Avaliadores — visão global (todos os eventos do ciclo). */
export interface GlobalEvaluatorCard extends CardStyle {
  id: number;
  name: string;
  assigned: number;
  submitted: number;
  pendingEvents: { id: number; name: string }[];
  pct: number;
}
