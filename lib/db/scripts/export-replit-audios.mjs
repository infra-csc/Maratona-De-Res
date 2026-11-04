// Exporta os áudios das avaliações do Object Storage do Replit para uma pasta
// local, no layout que a API usa na VPS (STORAGE_DIR/private/uploads/<id>).
//
// RODA NO SHELL DO REPLIT (precisa do sidecar 127.0.0.1:1106 e das variáveis
// DATABASE_URL e PRIVATE_OBJECT_DIR de lá). Não depende de nenhum pacote além
// do `pg`, que já está em lib/db.
//
// Uso no Replit:
//   cd lib/db && node scripts/export-replit-audios.mjs /tmp/maratona-storage
//   tar czf /tmp/maratona-storage.tgz -C /tmp maratona-storage
// Baixe o .tgz e, na VPS, extraia de forma que fique:
//   $STORAGE_DIR/private/uploads/<id>
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const SIDECAR = "http://127.0.0.1:1106";
const outDir = path.resolve(process.argv[2] || "./maratona-storage");
const privateDir = process.env.PRIVATE_OBJECT_DIR;
if (!process.env.DATABASE_URL || !privateDir) {
  console.error("Precisa de DATABASE_URL e PRIVATE_OBJECT_DIR (rode no Shell do Replit).");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const { rows } = await pool.query(
  "select distinct audio_url from evaluations where audio_url like '/objects/%'",
);
await pool.end();
console.log(`${rows.length} áudio(s) referenciados no banco.`);

let ok = 0, missing = 0;
for (const { audio_url } of rows) {
  const entityId = audio_url.slice("/objects/".length);
  const full = `${privateDir.replace(/\/+$/, "")}/${entityId}`.replace(/^\/+/, "");
  const [bucket, ...rest] = full.split("/");
  const signRes = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucket,
      object_name: rest.join("/"),
      method: "GET",
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    }),
  });
  if (!signRes.ok) { console.error(`falha ao assinar ${audio_url}: ${signRes.status}`); missing++; continue; }
  const { signed_url } = await signRes.json();
  const res = await fetch(signed_url);
  if (!res.ok) { console.error(`não encontrado: ${audio_url} (${res.status})`); missing++; continue; }
  const dest = path.join(outDir, "private", entityId);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  fs.writeFileSync(`${dest}.meta.json`, JSON.stringify({
    contentType: res.headers.get("content-type") || "audio/webm",
    size: buf.length,
    createdAt: new Date().toISOString(),
  }));
  ok++;
}
console.log(`Exportados: ${ok}. Com erro/ausentes: ${missing}. Pasta: ${outDir}`);
