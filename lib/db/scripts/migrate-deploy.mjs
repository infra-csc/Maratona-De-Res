// Aplica as migrações versionadas (lib/db/migrations) no DATABASE_URL.
//
// Roda no pós-merge do Replit (scripts/post-merge.sh) e pode rodar à mão:
//   pnpm --filter @workspace/db run migrate:deploy
//
// Banco que JÁ existe mas nunca usou migrações (produção criada por
// `drizzle-kit push` até 09/2026): o baseline 0000 recriaria tabelas que já
// existem. Nesse caso o script "adota" o baseline — grava a entrada dele em
// drizzle.__drizzle_migrations, exatamente como o migrador do Drizzle faria —
// e só então aplica as migrações seguintes. O migrador do Drizzle decide o que
// falta pela data (created_at) da última entrada, então basta registrar o
// baseline com o `when` do _journal.json.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(here, "..", "migrations");
const MIGRATIONS_SCHEMA = "drizzle";
const MIGRATIONS_TABLE = "__drizzle_migrations";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL não definido");
  process.exit(1);
}

const journal = JSON.parse(fs.readFileSync(path.join(migrationsFolder, "meta", "_journal.json"), "utf8"));
const baseline = journal.entries[0];
if (!baseline || !baseline.tag.startsWith("0000_")) {
  console.error("[migrate] _journal.json sem o baseline 0000");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, max: 1 });

async function appliedCount(client) {
  const { rows } = await client.query(
    `select to_regclass($1) is not null as present`, [`${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE}`],
  );
  if (!rows[0].present) return 0;
  const r = await client.query(`select count(*)::int as n from ${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE}`);
  return r.rows[0].n;
}

try {
  const client = await pool.connect();
  let before;
  try {
    before = await appliedCount(client);
    const { rows } = await client.query(`select to_regclass('public.users') is not null as present`);
    const schemaExists = rows[0].present;

    if (before === 0 && schemaExists) {
      // Mesmo hash que o migrador do Drizzle calcula: sha256 do arquivo inteiro.
      const sql = fs.readFileSync(path.join(migrationsFolder, `${baseline.tag}.sql`)).toString();
      const hash = crypto.createHash("sha256").update(sql).digest("hex");
      await client.query("begin");
      await client.query(`create schema if not exists ${MIGRATIONS_SCHEMA}`);
      await client.query(
        `create table if not exists ${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE} (id serial primary key, hash text not null, created_at bigint)`,
      );
      await client.query(
        `insert into ${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE} (hash, created_at) values ($1, $2)`,
        [hash, baseline.when],
      );
      await client.query("commit");
      before = 1;
      console.log(`[migrate] banco existente sem histórico: baseline ${baseline.tag} marcado como aplicado`);
    }
  } finally {
    client.release();
  }

  await migrate(drizzle(pool), { migrationsFolder, migrationsSchema: MIGRATIONS_SCHEMA, migrationsTable: MIGRATIONS_TABLE });

  const check = await pool.connect();
  try {
    const after = await appliedCount(check);
    const applied = journal.entries.slice(before, after).map((e) => e.tag);
    console.log(applied.length
      ? `[migrate] aplicadas: ${applied.join(", ")}`
      : "[migrate] nenhuma migração pendente");
  } finally {
    check.release();
  }
} catch (err) {
  console.error("[migrate] falhou:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
