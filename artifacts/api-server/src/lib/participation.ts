/**
 * Regras de participação "conta para nota" (scoring) de um colaborador em um
 * evento. Centralizado aqui para ser usado tanto na sincronização externa
 * (integration.ts, decide o que é importado como participante) quanto no
 * cálculo de resultados (results.ts, decide o que entra na nota/elegibilidade)
 * e nas leituras que espelham a mesma regra (ranking.ts, my-performance.ts,
 * events.ts).
 *
 * Duas categorias de participante NÃO contam para nota, mas continuam
 * aparecendo na Equipe Alocada como registro histórico/informativo:
 *  - Freelancers (employees.employmentType === "freela").
 *  - Funções de supervisão "Sup Ceno *" (Sup Ceno, Sup Ceno Local, Sup Ceno
 *    Sp1, e futuras variantes) — presença informativa, nunca avaliada.
 *
 * IMPORTANTE: a exclusão é por PREFIXO/lista negativa, não por lista branca.
 * A base já tem participantes com funções diversas (Montador, Motorista,
 * Assistente de Produção etc.) que sempre contaram para nota — não podemos
 * exigir um match exato com "Cenotécnica"/"Cenotécnica Local" sem quebrar
 * esses casos existentes.
 */

export function normalizeFunction(s?: string | null): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const SCORED_FUNCTION_PREFIXES = ["cenotecnica", "cenotecnico"];
const INFORMATIONAL_FUNCTION_PREFIX = "sup ceno";

/**
 * Funções explicitamente destinadas a serem avaliadas (usado na sincronização).
 * Prefixo, não match exato: a Logística Interna usa variantes como "Cenotécnica
 * Local", "Cenotécnica SP", "Cenotécnica SP1/SP2" (times/squads) e a grafia
 * masculina "Cenotécnico - Casa/Freela" — um match exato só em
 * "cenotecnica"/"cenotecnica local" descartava silenciosamente essas
 * participações (e os dados de diária junto) na sincronização externa.
 */
export function isScoredFunction(functionName?: string | null): boolean {
  const n = normalizeFunction(functionName);
  return SCORED_FUNCTION_PREFIXES.some(p => n.startsWith(p));
}

/**
 * Funções de participação apenas informativa (nunca contam para nota),
 * como a família "Sup Ceno *". Prefixo cobre variantes atuais e futuras
 * (Local, Sp1, Sp2...) sem precisar alterar código a cada nova função.
 */
export function isInformationalFunction(functionName?: string | null): boolean {
  return normalizeFunction(functionName).startsWith(INFORMATIONAL_FUNCTION_PREFIX);
}

/** Funções que a sincronização externa deve trazer como participantes. */
export function isSyncableFunction(functionName?: string | null): boolean {
  return isScoredFunction(functionName) || isInformationalFunction(functionName);
}

/**
 * Regra única: essa participação (evento + colaborador) conta para a nota do
 * colaborador? Freelancers e funções informativas ("Sup Ceno *") nunca
 * contam, independente de qual for a outra condição. Qualquer outra função
 * (inclusive em branco, para participantes adicionados manualmente) conta
 * normalmente — preserva o comportamento pré-existente.
 *
 * `employeeFunction` é o CARGO GLOBAL do colaborador (employees.functionName,
 * exibido em Colaboradores). Se o cargo global for "Sup Ceno *", o
 * colaborador nunca conta para nota em NENHUM evento, mesmo que uma
 * participação específica tenha sido sincronizada com outra função — o cargo
 * cadastral é a fonte da verdade, não o valor pontual do evento.
 */
export function participantCountsForScore(params: {
  employmentType?: string | null;
  functionName?: string | null;
  employeeFunction?: string | null;
}): boolean {
  if (params.employmentType === "freela") return false;
  if (isInformationalFunction(params.functionName)) return false;
  if (isInformationalFunction(params.employeeFunction)) return false;
  return true;
}
