// Armazenamento de objetos em disco local (substitui o Object Storage do
// Replit, que dependia do sidecar em 127.0.0.1:1106 e de um bucket GCS).
//
// Layout em STORAGE_DIR (padrão ./data/storage, relativo ao diretório em que a
// API sobe):
//   private/uploads/<uuid>            bytes do objeto privado (áudio)
//   private/uploads/<uuid>.meta.json  { contentType, size, createdAt }
//   public/<caminho>                  arquivos públicos (GET /storage/public-objects/*)
//
// O caminho lógico que vai para o banco continua igual ao do Replit:
// /objects/uploads/<uuid>. Para migrar, basta copiar os arquivos do bucket
// antigo para STORAGE_DIR/private/uploads/ (ver scripts/replit-export-audios.mjs).
//
// Upload: a API devolve uma URL própria assinada com HMAC (PUT
// /api/storage/uploads/<uuid>?expires=...&sig=...), válida por 15 min e de uso
// único (não sobrescreve um objeto que já existe). O navegador continua
// fazendo o mesmo PUT direto que fazia para o GCS.

import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { createReadStream, createWriteStream } from "fs";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

const UPLOAD_TTL_SEC = 900;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class InvalidUploadError extends Error {
  constructor(message: string, public readonly status: number = 400) {
    super(message);
    this.name = "InvalidUploadError";
    Object.setPrototypeOf(this, InvalidUploadError.prototype);
  }
}

/** Arquivo resolvido em disco, pronto para ser servido. */
export interface StoredObject {
  filePath: string;
  contentType: string;
  size: number;
  isPublic: boolean;
}

function storageRoot(): string {
  return path.resolve(process.env.STORAGE_DIR || "./data/storage");
}

function signingSecret(): string {
  const secret = process.env.STORAGE_SIGNING_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("STORAGE_SIGNING_SECRET (ou JWT_SECRET) não configurado.");
  }
  return secret;
}

function sign(objectId: string, expires: number): string {
  return createHmac("sha256", signingSecret())
    .update(`PUT\n${objectId}\n${expires}`)
    .digest("hex");
}

/** Junta `rel` a `base` e garante que o resultado não escapa de `base`. */
function safeJoin(base: string, rel: string): string | null {
  const full = path.resolve(base, rel);
  if (full !== base && !full.startsWith(base + path.sep)) return null;
  return full;
}

async function readMeta(filePath: string): Promise<{ contentType?: string }> {
  try {
    return JSON.parse(await readFile(`${filePath}.meta.json`, "utf8"));
  } catch {
    return {};
  }
}

function guessContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".webm": "audio/webm",
    ".ogg": "audio/ogg",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".wav": "audio/wav",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
  };
  // Os áudios do Replit não têm extensão; o app só grava audio/webm.
  return map[ext] ?? "audio/webm";
}

async function toStoredObject(filePath: string, isPublic: boolean): Promise<StoredObject | null> {
  try {
    const st = await stat(filePath);
    if (!st.isFile()) return null;
    const meta = await readMeta(filePath);
    return {
      filePath,
      size: st.size,
      contentType: meta.contentType || guessContentType(filePath),
      isPublic,
    };
  } catch {
    return null;
  }
}

export class ObjectStorageService {
  privateDir(): string {
    return path.join(storageRoot(), "private");
  }

  publicDir(): string {
    return path.join(storageRoot(), "public");
  }

  /**
   * Gera um id novo e a URL assinada para o navegador enviar os bytes.
   * `apiBase` é o prefixo público da API (padrão "/api").
   */
  createUpload(apiBase = process.env.API_PUBLIC_BASE || "/api"): { uploadURL: string; objectPath: string } {
    const objectId = randomUUID();
    const expires = Math.floor(Date.now() / 1000) + UPLOAD_TTL_SEC;
    const sig = sign(objectId, expires);
    const base = apiBase.replace(/\/+$/, "");
    return {
      uploadURL: `${base}/storage/uploads/${objectId}?expires=${expires}&sig=${sig}`,
      objectPath: `/objects/uploads/${objectId}`,
    };
  }

  /** Confere a assinatura de um PUT de upload. Lança InvalidUploadError. */
  verifyUpload(objectId: string, expiresRaw: unknown, sigRaw: unknown): void {
    if (!UUID_RE.test(objectId)) throw new InvalidUploadError("Identificador de upload inválido.");
    const expires = Number(expiresRaw);
    if (!Number.isInteger(expires) || typeof sigRaw !== "string") {
      throw new InvalidUploadError("Assinatura de upload ausente.", 403);
    }
    if (expires < Math.floor(Date.now() / 1000)) {
      throw new InvalidUploadError("Link de upload expirado. Grave de novo.", 403);
    }
    const expected = Buffer.from(sign(objectId, expires), "hex");
    const given = Buffer.from(sigRaw, "hex");
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      throw new InvalidUploadError("Assinatura de upload inválida.", 403);
    }
  }

  /**
   * Grava o corpo do PUT em disco. Uso único: se o objeto já existe, recusa.
   * Grava num arquivo temporário e renomeia, para não deixar arquivo pela metade.
   */
  async saveUpload(objectId: string, body: Readable, contentType: string, maxBytes: number): Promise<number> {
    const dir = path.join(this.privateDir(), "uploads");
    await mkdir(dir, { recursive: true });
    const finalPath = path.join(dir, objectId);
    if (await toStoredObject(finalPath, false)) {
      throw new InvalidUploadError("Este link de upload já foi usado.", 409);
    }
    const tmpPath = `${finalPath}.${process.pid}.${Date.now()}.tmp`;
    let size = 0;
    body.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) body.destroy(new InvalidUploadError("Arquivo grande demais.", 413));
    });
    try {
      await pipeline(body, createWriteStream(tmpPath, { flags: "wx" }));
      await writeFile(
        `${finalPath}.meta.json`,
        JSON.stringify({ contentType, size, createdAt: new Date().toISOString() }),
      );
      await rename(tmpPath, finalPath);
    } catch (err) {
      await unlink(tmpPath).catch(() => {});
      throw err;
    }
    return size;
  }

  async searchPublicObject(filePath: string): Promise<StoredObject | null> {
    const full = safeJoin(this.publicDir(), filePath);
    if (!full) return null;
    return toStoredObject(full, true);
  }

  /** Resolve "/objects/<id...>" para o arquivo privado em disco. */
  async getObjectEntityFile(objectPath: string): Promise<StoredObject> {
    if (!objectPath.startsWith("/objects/")) throw new ObjectNotFoundError();
    const entityId = objectPath.slice("/objects/".length);
    if (!entityId || entityId.endsWith(".meta.json")) throw new ObjectNotFoundError();
    const full = safeJoin(this.privateDir(), entityId);
    if (!full) throw new ObjectNotFoundError();
    const obj = await toStoredObject(full, false);
    if (!obj) throw new ObjectNotFoundError();
    return obj;
  }

  /** Stream + cabeçalhos para responder um GET. */
  openObject(obj: StoredObject, cacheTtlSec = 3600): { stream: Readable; headers: Record<string, string> } {
    return {
      stream: createReadStream(obj.filePath),
      headers: {
        "Content-Type": obj.contentType,
        "Content-Length": String(obj.size),
        "Cache-Control": `${obj.isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
      },
    };
  }
}
