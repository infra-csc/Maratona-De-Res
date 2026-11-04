// Armazenamento local (substituto do Object Storage do Replit): pedir a URL,
// enviar os bytes com PUT assinado e ler de volta com Bearer.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startApi } from "../../../../scripts/test/api-harness.mjs";

let h: Awaited<ReturnType<typeof startApi>>;
const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "maratona-storage-"));

before(async () => {
  process.env.STORAGE_DIR = storageDir;
  process.env.STORAGE_MAX_UPLOAD_MB = "1";
  h = await startApi();
});
after(async () => {
  await h.close();
  fs.rmSync(storageDir, { recursive: true, force: true });
});

const origin = () => h.baseUrl.replace(/\/api$/, "");
const put = (url: string, body: Uint8Array | string, type = "audio/webm") =>
  fetch(origin() + url, { method: "PUT", headers: { "content-type": type }, body });

async function requestUpload() {
  const r = await h.api("POST", "/storage/uploads/request-url", {
    role: "admin",
    body: { name: "a.webm", size: 4, contentType: "audio/webm" },
  });
  assert.equal(r.status, 200);
  return r.data as { uploadURL: string; objectPath: string };
}

test("upload: PUT assinado grava em disco e o GET autenticado devolve os bytes", async () => {
  const { uploadURL, objectPath } = await requestUpload();
  assert.match(uploadURL, /^\/api\/storage\/uploads\/[0-9a-f-]{36}\?expires=\d+&sig=[0-9a-f]{64}$/);
  assert.match(objectPath, /^\/objects\/uploads\/[0-9a-f-]{36}$/);

  const res = await put(uploadURL, new Uint8Array([1, 2, 3, 4]));
  assert.equal(res.status, 200);
  const id = objectPath.split("/").pop()!;
  assert.ok(fs.existsSync(path.join(storageDir, "private", "uploads", id)));

  const token = await h.tokenFor("admin");
  const get = await fetch(`${h.baseUrl}/storage${objectPath}`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(get.status, 200);
  assert.equal(get.headers.get("content-type"), "audio/webm");
  assert.deepEqual([...new Uint8Array(await get.arrayBuffer())], [1, 2, 3, 4]);

  // Uso único: o mesmo link não sobrescreve.
  assert.equal((await put(uploadURL, "outra coisa")).status, 409);
  // Sem Bearer não lê.
  assert.equal((await fetch(`${h.baseUrl}/storage${objectPath}`)).status, 401);
});

test("upload: assinatura adulterada, expirada ou id inválido é recusado", async () => {
  const { uploadURL } = await requestUpload();
  const tampered = uploadURL.replace(/sig=([0-9a-f])/, (_m, c) => `sig=${c === "0" ? "1" : "0"}`);
  assert.equal((await put(tampered, "x")).status, 403);
  const expired = uploadURL.replace(/expires=\d+/, "expires=1");
  assert.equal((await put(expired, "x")).status, 403);
  assert.equal((await put("/api/storage/uploads/..%2F..%2Fetc?expires=9999999999&sig=00", "x")).status, 400);
});

test("upload: acima de STORAGE_MAX_UPLOAD_MB é recusado e não deixa arquivo", async () => {
  const { uploadURL, objectPath } = await requestUpload();
  const res = await put(uploadURL, new Uint8Array(1024 * 1024 + 10));
  assert.equal(res.status, 413);
  const id = objectPath.split("/").pop()!;
  assert.equal(fs.existsSync(path.join(storageDir, "private", "uploads", id)), false);
});

test("leitura: caminho com .. não escapa de STORAGE_DIR", async () => {
  fs.writeFileSync(path.join(storageDir, "segredo.txt"), "nao");
  const r = await h.api("GET", "/storage/objects/..%2Fsegredo.txt", { role: "admin" });
  assert.equal(r.status, 404);
});
