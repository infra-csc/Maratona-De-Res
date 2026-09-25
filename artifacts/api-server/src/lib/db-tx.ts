import { db } from "@workspace/db";

/**
 * Transação do Drizzle (o `tx` de `db.transaction(async (tx) => ...)`).
 * Funções auxiliares que escrevem em mais de uma tabela recebem um executor
 * `DbOrTx` para poderem rodar DENTRO da transação de quem as chama.
 *
 * Regra de ouro: dentro do callback de uma transação, toda consulta usa o
 * `tx` — nunca `db` nem `audit()` (que grava via `db`). Com o pool pequeno
 * (PG_POOL_MAX=1 nos testes) isso travaria esperando conexão; em produção a
 * escrita ficaria fora da transação. Auditoria e recompute do ciclo vão
 * DEPOIS do commit.
 */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbOrTx = typeof db | Tx;
