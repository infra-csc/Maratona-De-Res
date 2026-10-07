// Tipos compartilhados da Central de Avaliações (console admin).

export type CritState = "unassigned" | "pending" | "partial" | "done";

export type ConsoleView = "assign" | "table" | "people" | "criterios";
export type QueueTab = "todo" | "waiting" | "done";
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
  /** Usuário que enviou a resposta (aba Avaliadores no ciclo por área). */
  formSubmitterId: number | null;
  /** Evento de ciclo com avaliação por área: qualquer avaliador da área responde (sem designado não é falha). */
  areaMode: boolean;
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
  /** Avaliação por área (qualquer avaliador da área responde). */
  areaMode: boolean;
  /** Evento do PRÓXIMO ciclo (começa depois do fim do ciclo): não aceita avaliação até o ciclo novo ser criado. */
  nextCycle: boolean;
  /** Do período, mas a avaliação ainda não abriu (abre no dia seguinte ao fim do evento). */
  notOpenYet: boolean;
  /** "Abre em DD/MM" ou "Próximo ciclo" (events/rules → opensLabelFor); null = já abriu. */
  opensLabel: string | null;
  /** Aberto pela regra única do app (isOpenEvent) — o KPI "Eventos abertos". */
  isOpen: boolean;
  /** Evento histórico (importado): só consulta. */
  isHistorical: boolean;
  /** Aba da fila (events/rules.ts → queueTabFor): partição única A fazer / A abrir / Concluídos. */
  queueTab: QueueTab;
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
  /** Em nome de quem o link responde. No ciclo por área começa vazio: o admin escolhe um avaliador da área. */
  assignedToId: number | null;
  assignedToName: string | null;
  includeConformity: boolean;
  /** Ciclo por área: o link sai em nome de um avaliador ATIVO da área do critério (designação não vale). */
  areaMode: boolean;
  areaId: number | null;
  areaName: string;
}

/** "Gerar todos os links" no ciclo por área: um link por área, em nome do avaliador escolhido. */
export interface AreaBatchPlanRow {
  areaId: number;
  areaName: string;
  criterionIds: number[];
  criterionNames: string[];
  includeConformity: boolean;
  evaluatorId: number | null;
  evaluatorName: string | null;
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

/** Aba Avaliadores no ciclo por área: quem respondeu, em qual área e quantos critérios. */
export interface AreaResponderRow {
  key: string;
  name: string;
  area: string;
  /** Critérios respondidos (resposta enviada). */
  answered: number;
  /** Eventos em que respondeu. */
  events: { id: number; name: string }[];
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
