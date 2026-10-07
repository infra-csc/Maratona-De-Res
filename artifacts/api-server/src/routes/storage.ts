import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { requireAuth, requireRole, isRole } from "../lib/auth";
import { audit } from "../lib/audit.js";
import { evaluatorCanHearAudio } from "../lib/evaluator-visibility.js";

// Os objetos privados hoje são só áudios de justificativa de avaliação. Quem
// grava: os papéis que podem lançar avaliação (POST /evaluations). Quem ouve:
// os papéis que recebem audioUrl em GET /evaluations (operador recebe null e
// visualizador recebe lista vazia). Os caminhos são /objects/uploads/<UUID v4>
// (randomUUID), portanto imprevisíveis; o papel é a segunda barreira.
const AUDIO_UPLOAD_ROLES = ["admin", "rh", "avaliador"] as const;
const AUDIO_READ_ROLES = ["admin", "rh", "diretoria", "avaliador"] as const;

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", requireAuth, requireRole(...AUDIO_UPLOAD_ROLES), async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados do arquivo inválidos ou incompletos." });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    // B2: quem gravou pode ouvir o próprio áudio antes de salvá-lo na avaliação.
    await audit(req.user!.userId, "upload_audio", "storage_audio", objectPath, null, { name, size, contentType });

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Não foi possível preparar o envio do arquivo. Tente de novo." });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "Arquivo não encontrado." });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Não foi possível abrir o arquivo. Tente de novo." });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR. These hold sensitive content
 * (evaluation audio justifications), so the route requires authentication.
 * The browser can't send an Authorization header on an <audio src>, so the
 * frontend fetches the bytes with its Bearer token and plays them via a blob URL
 * (see fetchAudioObjectUrl in the web app). Leitura restrita a AUDIO_READ_ROLES;
 * o avaliador ainda passa pela ACL por objeto (lib/evaluator-visibility.ts, B2).
 */
router.get("/storage/objects/*path", requireAuth, requireRole(...AUDIO_READ_ROLES), async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    // B2: o avaliador só ouve o áudio de uma avaliação que ele enxerga (a
    // mesma regra de GET /evaluations) ou o que ele mesmo acabou de gravar.
    if (isRole(req.user!.role, "avaliador") && !(await evaluatorCanHearAudio(req.user!.userId, objectPath))) {
      res.status(403).json({ error: "Acesso negado: este áudio não é de uma avaliação que você pode ver." });
      return;
    }
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    // --- Protected route example (uncomment when using replit-auth) ---
    // if (!req.isAuthenticated()) {
    //   res.status(401).json({ error: "Unauthorized" });
    //   return;
    // }
    // const canAccess = await objectStorageService.canAccessObjectEntity({
    //   userId: req.user.id,
    //   objectFile,
    //   requestedPermission: ObjectPermission.READ,
    // });
    // if (!canAccess) {
    //   res.status(403).json({ error: "Forbidden" });
    //   return;
    // }

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Arquivo não encontrado." });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Não foi possível abrir o arquivo. Tente de novo." });
  }
});

export default router;
