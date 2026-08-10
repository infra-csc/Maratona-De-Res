/**
 * Utilitários para parsing seguro de parâmetros de rota/query.
 *
 * O `parseInt` nativo retorna `NaN` para strings não numéricas. Usar `NaN`
 * diretamente em queries Drizzle/pg causa comportamento undefined. Use estas
 * funções em vez de `parseInt` bruto em handlers Express.
 */

/**
 * Parseia um parâmetro de rota ou query como inteiro positivo.
 * Retorna `null` se o valor for inválido, não numérico, ou menor que 1.
 */
export function parseId(val: string | undefined): number | null {
  if (!val) return null;
  const n = parseInt(val, 10);
  return isNaN(n) || n < 1 || !Number.isInteger(n) ? null : n;
}

/**
 * Parseia um inteiro genérico (sem restrição de positivo).
 * Retorna `null` se inválido.
 */
export function parseIntParam(val: string | undefined): number | null {
  if (!val) return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}
