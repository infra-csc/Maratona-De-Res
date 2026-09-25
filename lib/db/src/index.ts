import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Sob autoscale cada instância tem o próprio pool; o total contra o Postgres
// é N × max. Ajuste PG_POOL_MAX conforme o número de instâncias.
const poolMax = Number(process.env.PG_POOL_MAX ?? 10);
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 10,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  statement_timeout: 60000,
});
// As colunas `timestamp` (sem fuso) guardam hora UTC: o Drizzle grava
// `toISOString()` e lê acrescentando +0000. O que depende do fuso da SESSÃO
// (now() gravado por defaultNow, `::date`, date_trunc) também precisa ser UTC,
// qualquer que seja o padrão do servidor ou quem conecta (script local em
// horário de Brasília). Fixar aqui torna isso uma garantia, não um acaso do
// Neon. A consulta entra na fila do cliente antes de qualquer outra.
pool.on("connect", (client) => {
  client.query("SET TIME ZONE 'UTC'").catch((err: Error) => {
    console.error("[db] não foi possível fixar o fuso UTC na conexão:", err.message);
  });
});
pool.on("error", (err) => {
  console.error("[db] erro em conexão ociosa do pool:", err.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
