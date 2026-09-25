// Migração 0002 (timestamp → timestamptz) e a leitura das datas pelo app.
// O app novo precisa ler certo ANTES da migração (colunas antigas, sem fuso)
// e DEPOIS (com fuso), porque em produção ele é publicado primeiro.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { parseDbTimestamp } from "@workspace/db/schema";

const MIGRATIONS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../lib/db/migrations");
const journal = JSON.parse(fs.readFileSync(path.join(MIGRATIONS, "meta/_journal.json"), "utf8")) as { entries: { tag: string }[] };
const sqlOf = (tag: string) => fs.readFileSync(path.join(MIGRATIONS, `${tag}.sql`), "utf8").replace(/--> statement-breakpoint/g, "");

test("parseDbTimestamp: sem fuso é UTC; com fuso é lido como veio", () => {
  const iso = "2026-09-25T10:00:00.000Z";
  assert.equal(parseDbTimestamp("2026-09-25 10:00:00").toISOString(), iso);
  assert.equal(parseDbTimestamp("2026-09-25 10:00:00.123456").toISOString(), "2026-09-25T10:00:00.123Z");
  assert.equal(parseDbTimestamp("2026-09-25 10:00:00+00").toISOString(), iso);
  assert.equal(parseDbTimestamp("2026-09-25 07:00:00-03").toISOString(), iso);
  assert.equal(parseDbTimestamp("2026-09-25 07:00:00-03:00").toISOString(), iso);
  const d = new Date(iso);
  assert.equal(parseDbTimestamp(d), d);
});

test("0002 converte os instantes antigos como UTC, mesmo com a sessão em Brasília, e é idempotente", async () => {
  const pg = new PGlite();
  try {
    const [baseline, ...rest] = journal.entries;
    const before = rest.filter(e => !e.tag.startsWith("0002_"));
    for (const e of [baseline, ...before]) await pg.exec(sqlOf(e.tag));

    // Dado gravado pelo app antigo: hora UTC numa coluna sem fuso.
    await pg.exec(`insert into users (id, name, password_hash, role) values (900, 'Fuso', 'x', 'admin')`);
    await pg.exec(`insert into audit_logs (user_id, action, entity, created_at) values (900, 'login', 'users', '2026-09-25 10:00:00')`);

    // Quem roda a migração pode estar em outro fuso: o resultado não muda.
    await pg.exec(`SET TIME ZONE 'America/Sao_Paulo'`);
    const m = sqlOf(journal.entries.find(e => e.tag.startsWith("0002_"))!.tag);
    await pg.exec(m);
    await pg.exec(m); // segunda vez: nada a converter, sem erro

    await pg.exec(`SET TIME ZONE 'UTC'`);
    const { rows } = await pg.query<{ created_at: string; data_type: string }>(
      `select a.created_at::text as created_at,
              (select data_type from information_schema.columns where table_name = 'audit_logs' and column_name = 'created_at') as data_type
         from audit_logs a where a.user_id = 900`);
    assert.equal(rows[0].data_type, "timestamp with time zone");
    assert.equal(parseDbTimestamp(rows[0].created_at).toISOString(), "2026-09-25T10:00:00.000Z");

    const left = await pg.query<{ n: number }>(
      `select count(*)::int as n from information_schema.columns
        where table_schema = 'public' and data_type = 'timestamp without time zone'`);
    assert.equal(left.rows[0].n, 0, "sobrou coluna de instante sem fuso");
  } finally {
    await pg.close();
  }
});
