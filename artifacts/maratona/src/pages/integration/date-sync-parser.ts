/** Uma linha válida da planilha de datas: ID externo, nome e data ISO (AAAA-MM-DD). */
export type DateSyncEntry = { externalId: string; name: string; date: string };

/**
 * Converte as linhas brutas da planilha de eventos (colunas: SKU, ID Evento,
 * Evento, Data Evento; a primeira linha é o cabeçalho) em entradas com data ISO.
 * Linhas sem ID/data ou com data inválida são descartadas.
 */
export function parseDateSyncRows(rows: string[][]): DateSyncEntry[] {
  return rows.slice(1)
    .filter(r => r[1] && r[3])
    .map(r => {
      const parts = String(r[3]).trim().split(/[\/.-]/);
      if (parts.length !== 3) return null;
      // Planilha brasileira: DD/MM/AAAA. Se o primeiro campo passar de 12
      // não há ambiguidade; se o segundo passar de 12 é MM/DD (americano).
      let [a, b, y] = parts.map(p => parseInt(p, 10));
      if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(y)) return null;
      let d = a, m = b;
      if (a <= 12 && b > 12) { d = b; m = a; }
      if (m < 1 || m > 12 || d < 1 || d > 31) return null;
      const year = y < 100 ? 2000 + y : y;
      const date = `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      return { externalId: String(r[1]).trim(), name: String(r[2]).trim(), date };
    })
    .filter((x): x is DateSyncEntry => x !== null);
}
