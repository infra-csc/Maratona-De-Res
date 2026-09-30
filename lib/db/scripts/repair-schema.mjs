// Confere e repara a ESTRUTURA do banco em DATABASE_URL contra o que as
// migrações definem — mesmo quando a tabela de migrações diz que está tudo
// aplicado.
//
// Por que existe: ao publicar, o Replit copia para a produção a estrutura do
// banco de DESENVOLVIMENTO (o do Shell). Se o banco do Shell não recebeu as
// migrações, a publicação desfaz o que foi aplicado em produção (incidentes de
// 25/09 — login — e 30/09 — índices únicos e datas sumiram; salvar calibração
// dava 500). O histórico em drizzle.__drizzle_migrations continua dizendo
// "aplicada", então o migrate:deploy sozinho não conserta.
//
// Uso:
//   pnpm --filter @workspace/db run schema:check    (só relata)
//   pnpm --filter @workspace/db run schema:repair   (relata, conserta e relata de novo)
//
// Conserta só o que é seguro e idempotente: reaplica as migrações 0001+ (todas
// escritas para rodar mais de uma vez) e recria índices que faltam — índice
// único só se não houver duplicatas (senão avisa e não cria). Não apaga nada.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { PGlite } from "@electric-sql/pglite";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(here, "..", "migrations");
const repair = process.argv.includes("--repair");

const url = process.env.DATABASE_URL;
if (!url) { console.error("[schema] DATABASE_URL não definido"); process.exit(1); }

const journal = JSON.parse(fs.readFileSync(path.join(migrationsFolder, "meta", "_journal.json"), "utf8"));
const sqlOf = (tag) => fs.readFileSync(path.join(migrationsFolder, `${tag}.sql`), "utf8");
const statements = (sql) => sql.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean);

const COLUMNS_SQL = `select table_name, column_name, data_type from information_schema.columns
  where table_schema = 'public' order by 1, 2`;
const INDEXES_SQL = `select indexname, indexdef from pg_indexes where schemaname = 'public' order by 1`;

async function snapshot(query) {
  const cols = await query(COLUMNS_SQL);
  const idx = await query(INDEXES_SQL);
  return {
    columns: new Map(cols.map(r => [`${r.table_name}.${r.column_name}`, r.data_type])),
    indexes: new Map(idx.map(r => [r.indexname, r.indexdef])),
  };
}

function diff(expected, actual) {
  const out = { missingColumns: [], wrongTypes: [], missingIndexes: [] };
  for (const [col, type] of expected.columns) {
    if (!actual.columns.has(col)) out.missingColumns.push(col);
    else if (actual.columns.get(col) !== type) out.wrongTypes.push(`${col}: ${actual.columns.get(col)} (esperado ${type})`);
  }
  for (const [name, def] of expected.indexes) if (!actual.indexes.has(name)) out.missingIndexes.push({ name, def });
  return out;
}

function report(title, d) {
  const n = d.missingColumns.length + d.wrongTypes.length + d.missingIndexes.length;
  console.log(`\n[schema] ${title}: ${n === 0 ? "igual ao esperado ✔" : `${n} diferença(s)`}`);
  if (d.missingColumns.length) console.log("  colunas faltando:", d.missingColumns.join(", "));
  if (d.wrongTypes.length) console.log(`  tipos diferentes (${d.wrongTypes.length}):`, d.wrongTypes.slice(0, 8).join("; "), d.wrongTypes.length > 8 ? "…" : "");
  if (d.missingIndexes.length) console.log("  índices faltando:", d.missingIndexes.map(i => i.name).join(", "));
  return n;
}

// 1. Referência: banco em memória com TODAS as migrações.
const ref = new PGlite();
for (const e of journal.entries) for (const s of statements(sqlOf(e.tag))) await ref.exec(s);
const expected = await snapshot(async (q) => (await ref.query(q)).rows);
await ref.close();

// 2. Alvo.
const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query("SET TIME ZONE 'UTC'");
const query = async (q, p) => (await client.query(q, p)).rows;

try {
  const before = diff(expected, await snapshot(query));
  const problems = report("antes", before);
  if (!repair || problems === 0) {
    if (!repair && problems > 0) console.log("\n[schema] rode com --repair (pnpm --filter @workspace/db run schema:repair) para consertar.");
    process.exitCode = problems > 0 && !repair ? 2 : 0;
  } else {
    // 3a. Migrações 0001+ de novo (idempotentes); a baseline não — ela cria tabelas.
    for (const e of journal.entries.slice(1)) {
      await client.query("BEGIN");
      try {
        for (const s of statements(sqlOf(e.tag))) await client.query(s);
        await client.query("COMMIT");
        console.log(`[schema] reaplicada: ${e.tag}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`[schema] falhou ao reaplicar ${e.tag}: ${err.message}`);
      }
    }
    // 3b. Índices que ainda faltam, com a definição da referência.
    const mid = diff(expected, await snapshot(query));
    for (const { name, def } of mid.missingIndexes) {
      const unique = /CREATE UNIQUE INDEX/i.test(def);
      const m = /ON (?:public\.)?(\S+) USING \w+ \((.+)\)$/i.exec(def);
      if (unique && m) {
        const [{ n }] = await query(`select count(*)::int n from (select 1 from ${m[1]} group by ${m[2]} having count(*) > 1) x`);
        if (n > 0) { console.error(`[schema] NÃO criei ${name}: ${n} grupo(s) duplicado(s) em ${m[1]} (${m[2]}). Resolva as duplicatas e rode de novo.`); continue; }
      }
      await client.query(def.replace(/CREATE (UNIQUE )?INDEX /i, (x) => `${x}IF NOT EXISTS `));
      console.log(`[schema] índice criado: ${name}`);
    }
    const left = report("depois", diff(expected, await snapshot(query)));
    process.exitCode = left > 0 ? 3 : 0;
  }
} finally {
  await client.end();
}
