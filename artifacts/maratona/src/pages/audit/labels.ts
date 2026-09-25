import type { StatusVariant } from "@/components/shared/status-badge";

/**
 * Dicionário da trilha de auditoria: os códigos gravados pela API (`action`,
 * `entity`, nomes de campo) viram português. Código desconhecido cai num
 * rótulo derivado do próprio código — nunca some da tela.
 */

// ── Grupos (filtro "O quê") ─────────────────────────────────────────────────
export const CATEGORIES = [
  { key: "resultados", label: "Resultados e bônus", entities: ["quarterly_results", "cycles", "employee_cycle_eligibility", "rules", "platoon_rules", "penalty_types"] },
  { key: "eventos", label: "Eventos", entities: ["events", "event_criteria", "event_criterion_assignments", "public_eval_tokens"] },
  { key: "avaliacoes", label: "Avaliações e calibração", entities: ["evaluations", "calibrations", "calibration_comments"] },
  { key: "pessoas", label: "Pessoas e acessos", entities: ["users", "employees", "absences"] },
  { key: "config", label: "Configuração e sistema", entities: ["criteria", "criterion_routing", "areas", "integration", "system"] },
] as const;
export type CategoryKey = (typeof CATEGORIES)[number]["key"];

// ── Tipo de registro ────────────────────────────────────────────────────────
export const ENTITY_LABELS: Record<string, string> = {
  events: "Evento",
  event_criteria: "Critério do evento",
  event_criterion_assignments: "Atribuição de critério",
  public_eval_tokens: "Link público de avaliação",
  evaluations: "Avaliação",
  calibrations: "Calibração",
  calibration_comments: "Comentário de calibração",
  users: "Usuário",
  employees: "Colaborador",
  absences: "Falta",
  criteria: "Critério",
  criterion_routing: "Roteamento de critério",
  areas: "Área",
  cycles: "Ciclo",
  quarterly_results: "Resultado do ciclo",
  employee_cycle_eligibility: "Elegibilidade no ciclo",
  rules: "Regras do bônus",
  platoon_rules: "Faixas de bônus",
  penalty_types: "Tipos de penalidade",
  integration: "Integração",
  system: "Sistema",
};

// ── Ações ───────────────────────────────────────────────────────────────────
// `label` completa a frase "<pessoa> <label>"; `tone` pinta o chip:
// danger = apaga ou desfaz, warn = mexe em nota/resultado, ok = conclui,
// info = acesso, neutral = cadastro comum.
// `generic`: verbo de cadastro; a frase ganha o tipo ("alterou o usuário Fred").
// `direct`: o nome vem colado no verbo ("entrou em Modo Dev como Sandro").
type ActionDef = { label: string; tone: StatusVariant; generic?: true; direct?: true };
export const ACTIONS: Record<string, ActionDef> = {
  // cadastro genérico
  create: { label: "criou", tone: "neutral", generic: true },
  update: { label: "alterou", tone: "neutral", generic: true },
  delete: { label: "excluiu", tone: "danger", generic: true },
  merge: { label: "mesclou duplicados em", tone: "warn", direct: true },
  duplicate: { label: "duplicou o quesito", tone: "neutral" },
  upsert: { label: "salvou", tone: "neutral", generic: true },
  // acesso
  login: { label: "entrou com e-mail e senha", tone: "info" },
  login_pin: { label: "entrou com PIN", tone: "info" },
  portal_sso_login: { label: "entrou pelo portal", tone: "info" },
  change_password: { label: "trocou a própria senha", tone: "info" },
  reset_password: { label: "redefiniu a senha de", tone: "warn", direct: true },
  generate_pin: { label: "gerou um PIN de acesso para", tone: "info", direct: true },
  impersonate: { label: "entrou em Modo Dev como", tone: "warn", direct: true },
  auto_provision_access: { label: "criou o acesso por CPF", tone: "info" },
  bulk_generate_access: { label: "gerou acessos em lote", tone: "info" },
  bulk_generate_senhas_cpf: { label: "gerou senhas por CPF em lote", tone: "warn" },
  bulk_update_email: { label: "atualizou e-mails em lote", tone: "neutral" },
  // eventos e resultados
  "confirm-results": { label: "confirmou os resultados", tone: "ok" },
  "unconfirm-results": { label: "desfez a confirmação dos resultados", tone: "danger" },
  close: { label: "encerrou", tone: "ok", generic: true },
  reopen: { label: "reabriu", tone: "warn", generic: true },
  "update-historical-result": { label: "alterou a nota importada", tone: "warn" },
  update_weights_after_evaluations: { label: "mudou pesos depois das avaliações", tone: "warn" },
  resync_criteria: { label: "ressincronizou os critérios", tone: "neutral" },
  set_assignments: { label: "definiu os avaliadores por área", tone: "neutral" },
  release_feedback: { label: "liberou o feedback", tone: "ok" },
  unrelease_feedback: { label: "recolheu o feedback", tone: "warn" },
  publish_partial_feedback: { label: "publicou a nota parcial do quesito", tone: "ok" },
  publish_partial_all_feedback: { label: "publicou as notas parciais", tone: "ok" },
  publish_final_feedback: { label: "publicou a nota final do quesito", tone: "ok" },
  publish_final_all_feedback: { label: "publicou as notas finais", tone: "ok" },
  create_conformity: { label: "preencheu a matriz de conformidade", tone: "neutral" },
  update_conformity: { label: "alterou a matriz de conformidade", tone: "warn" },
  set_conformity_evaluator: { label: "trocou o avaliador de Cenografia", tone: "neutral" },
  set_conformity_evaluator_ferramentas: { label: "trocou o avaliador de Ferramentas", tone: "neutral" },
  redirect_conformity_evaluator: { label: "repassou a matriz de Cenografia", tone: "neutral" },
  redirect_conformity_evaluator_ferramentas: { label: "repassou a matriz de Ferramentas", tone: "neutral" },
  normalize_event_dates: { label: "corrigiu datas de eventos", tone: "neutral" },
  bulk_date_sync: { label: "sincronizou datas por planilha", tone: "warn" },
  import_survey: { label: "importou a pesquisa de avaliação", tone: "warn" },
  import_historical_results: { label: "importou notas históricas", tone: "warn" },
  create_admin_link: { label: "criou link de avaliação", tone: "neutral" },
  // avaliações
  submit: { label: "enviou a avaliação", tone: "ok" },
  calibrate: { label: "calibrou a nota", tone: "warn" },
  recalibrate_released: { label: "recalibrou nota já liberada", tone: "danger" },
  calibration_comment_add: { label: "comentou na calibração", tone: "neutral" },
  calibration_comment_delete: { label: "apagou comentário da calibração", tone: "danger" },
  dedupe_evaluations: { label: "removeu avaliações duplicadas", tone: "warn" },
  fix_orphaned_evaluations: { label: "corrigiu avaliações órfãs", tone: "warn" },
  fix_calibration_criteria: { label: "corrigiu critérios das calibrações", tone: "warn" },
  assign: { label: "atribuiu o quesito", tone: "neutral" },
  redirect: { label: "repassou o quesito", tone: "neutral" },
  confirm: { label: "aceitou o quesito", tone: "ok" },
  // ciclo, bônus e cadastros
  recompute_cycle: { label: "recalculou o ciclo", tone: "neutral" },
  set_current: { label: "definiu o ciclo atual", tone: "warn" },
  set_cycle_eligibility: { label: "mudou a elegibilidade ao bônus", tone: "warn" },
  update_bonus_payment: { label: "registrou pagamento de bônus", tone: "ok" },
  replace_all: { label: "substituiu todas as faixas", tone: "warn" },
  seed_defaults: { label: "restaurou os tipos padrão", tone: "neutral" },
  import_employees: { label: "importou colaboradores", tone: "neutral" },
  "bulk-set-cpf": { label: "preencheu CPFs em lote", tone: "neutral" },
  "bulk-employment-reset": { label: "redefiniu vínculos em lote", tone: "warn" },
  sync_area_labels: { label: "sincronizou nomes de área", tone: "neutral" },
  "swap-source": { label: "trocou o critério de origem", tone: "warn" },
  migrate_criteria_catalog: { label: "migrou o catálogo de critérios", tone: "warn" },
  set_conformity_routing: { label: "definiu quem avalia a conformidade", tone: "neutral" },
  sync_integration: { label: "sincronizou com o sistema de eventos", tone: "neutral" },
  reset_operational_data: { label: "apagou os dados operacionais", tone: "danger" },
};

/** Objeto da frase nas ações genéricas ("alterou o usuário …"). */
const ENTITY_OBJECT: Record<string, string> = {
  events: "o evento", event_criteria: "o critério do evento", event_criterion_assignments: "a atribuição",
  public_eval_tokens: "o link de avaliação", evaluations: "a avaliação", calibrations: "a calibração",
  calibration_comments: "o comentário", users: "o usuário", employees: "o colaborador", absences: "o lançamento",
  criteria: "o critério", criterion_routing: "o roteamento do critério", areas: "a área", cycles: "o ciclo",
  quarterly_results: "o resultado de", employee_cycle_eligibility: "a elegibilidade de", rules: "as regras do bônus",
  platoon_rules: "a faixa de bônus", penalty_types: "o tipo de penalidade", integration: "a integração", system: "o sistema",
};
export function entityObject(entity: string): string {
  return ENTITY_OBJECT[entity] ?? `o registro (${entity})`;
}

/** "resync_criteria" → "resync criteria" (último recurso para código novo). */
const humanize = (code: string) => code.replace(/[-_]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();

export function actionDef(action: string): ActionDef {
  return ACTIONS[action] ?? { label: humanize(action), tone: "neutral" };
}
export function entityLabel(entity: string): string {
  return ENTITY_LABELS[entity] ?? humanize(entity);
}
export function categoryOf(entity: string): (typeof CATEGORIES)[number] | undefined {
  return CATEGORIES.find(c => (c.entities as readonly string[]).includes(entity));
}

// ── Campos (bloco "O que mudou") ───────────────────────────────────────────
export const FIELD_LABELS: Record<string, string> = {
  name: "Nome", status: "Situação", active: "Ativo", role: "Papel", email: "E-mail", phone: "Telefone",
  document: "CPF", cpfLogin: "Login por CPF", functionName: "Função", department: "Departamento",
  employmentType: "Vínculo", eligibleForBonus: "Elegível ao bônus", eligibilityStatus: "Elegibilidade", eligible: "Elegível",
  startDate: "Início", endDate: "Fim", date: "Data", city: "Cidade", state: "UF", clientName: "Cliente",
  cycleId: "Ciclo", eventId: "Evento", employeeId: "Colaborador", criterionId: "Critério", areaId: "Área",
  userId: "Usuário", responsibleAreaId: "Área responsável", sourceCriterionId: "Critério de origem",
  score: "Nota", calibratedScore: "Nota calibrada", originalAverageScore: "Média dos avaliadores",
  reason: "Justificativa", calibrationReason: "Justificativa", comments: "Comentário", text: "Texto", by: "Por",
  weight: "Peso", weightOverride: "Peso no evento", defaultWeight: "Peso padrão", description: "Descrição",
  resultsConfirmed: "Resultados confirmados", resultsConfirmedAt: "Confirmado em", feedbackReleased: "Feedback liberado",
  historicalFinalScore: "Nota importada", isHistorical: "Importado", finalScore: "Nota final",
  conformityEvaluatorUserId: "Avaliador de Cenografia", conformityEvaluatorFerramentasUserId: "Avaliador de Ferramentas",
  from: "De", to: "Para", impersonatedUserId: "Usuário assumido", realAdminId: "Admin",
  isCurrent: "Ciclo atual", minScore: "Nota mínima", maxScore: "Nota máxima", bonusValue: "Bônus base (R$)",
  bonusPerExtraEvent: "Por evento extra (R$)", points: "Pontos", occurrences: "Ocorrências",
  totalProcessed: "Pessoas recalculadas", updated: "Atualizados", count: "Quantidade", skipped: "Ignorados",
  notFound: "Não encontrados", unchanged: "Sem mudança", rows: "Linhas", changes: "Mudanças",
  duplicateIds: "Duplicados", previousCurrentId: "Ciclo atual anterior", bulk: "Em lote",
  paid: "Pago", paidAt: "Pago em", paymentStatus: "Pagamento", amount: "Valor (R$)",
  submittedAt: "Enviada em", evaluatorUserId: "Avaliador", assignedToId: "Atribuído a", redirectedFromId: "Repassado por",
  createdByUserId: "Criado por", calibratedByUserId: "Calibrado por",
};

/** Campos que só fazem barulho no "o que mudou" (carimbos e chaves internas). */
export const NOISE_FIELDS = new Set(["id", "createdAt", "updatedAt", "tokenVersion"]);

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? humanize(key).replace(/^./, c => c.toUpperCase());
}
