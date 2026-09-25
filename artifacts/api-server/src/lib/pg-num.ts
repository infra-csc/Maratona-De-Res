/**
 * Colunas `numeric` do Postgres chegam do Drizzle como texto ("82.50").
 * Conversão única para número, com o mesmo resultado de `parseFloat`
 * (inclusive NaN para null/texto vazio) — substitui os
 * `parseFloat(x as unknown as string)` espalhados pelas rotas.
 */
export function pgNum(value: string | number | null | undefined): number {
  return typeof value === "number" ? value : parseFloat(value as string);
}

/**
 * Quantas linhas um UPDATE/DELETE do Drizzle (node-postgres) afetou. O tipo de
 * retorno do Drizzle não expõe `rowCount`; esta é a única leitura dele.
 */
export function affectedRows(result: unknown): number {
  const n = (result as { rowCount?: number | null } | null | undefined)?.rowCount;
  return typeof n === "number" ? n : 0;
}
