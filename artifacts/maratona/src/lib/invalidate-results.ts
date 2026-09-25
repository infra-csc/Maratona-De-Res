import type { QueryClient } from "@tanstack/react-query";

/**
 * Tudo que sai do recálculo do ciclo: ranking e detalhe, resultados e
 * pagamentos, Meu Desempenho, Análises (e relatório por evento), dashboard e
 * histórico dos ciclos. Use depois de qualquer escrita que o servidor recalcula
 * (falta, mérito, tipo de lançamento, elegibilidade, confirmação de evento…).
 *
 * Sem isso, Resultados continuava mostrando a nota antiga por até 30 s depois
 * de lançar uma falta (achado pelo teste de navegador em 25/09).
 */
const RESULT_PREFIXES = ["/ranking", "/results", "/my-performance", "/analytics", "/dashboard", "/cycles"];

export function invalidateCycleResults(qc: QueryClient): void {
  void qc.invalidateQueries({
    predicate: q => {
      const head = q.queryKey[0];
      return typeof head === "string" && RESULT_PREFIXES.some(p => head === p || head.startsWith(`${p}/`) || head.startsWith(`${p}?`));
    },
  });
}
