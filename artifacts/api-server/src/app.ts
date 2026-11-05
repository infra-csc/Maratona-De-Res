import express, { type Express } from "express";
import path from "path";
import { existsSync } from "fs";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { apiLimiter } from "./lib/rate-limit.js";

const app: Express = express();

// Atrás do Nginx, req.ip seria sempre 127.0.0.1 e os rate limits (login,
// links públicos) valeriam para todos juntos. "loopback" confia só no proxy
// local; TRUST_PROXY=false desliga, um número N confia em N saltos.
const trustProxy = process.env.TRUST_PROXY ?? "loopback";
app.set("trust proxy", trustProxy === "false" ? false : /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);

// ---------------------------------------------------------------------------
// CORS — permitir apenas origens conhecidas.
// ALLOWED_ORIGINS: lista separada por vírgula das origens permitidas
// (ex: https://maratona.suaempresa.com.br). Vazio = qualquer origem.
// ---------------------------------------------------------------------------
const allowedOriginSet = new Set<string>(
  (process.env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean),
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Sem Origin → mesmo domínio, curl → permitir
      if (!origin) return callback(null, true);
      if (allowedOriginSet.size === 0 || allowedOriginSet.has(origin)) {
        return callback(null, true);
      }
      logger.warn({ origin }, "CORS: origem bloqueada");
      return callback(new Error("CORS: origem não permitida"), false);
    },
    credentials: false,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Cabeçalhos de segurança básicos (sem dependência extra).
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), geolocation=(), payment=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

// Rate limit global — proteção contra flood; endpoints sensíveis têm limite próprio.
app.use("/api", apiLimiter);
// 2mb: acomoda a importação da planilha de pesquisa de avaliadores (239+ linhas
// em JSON), que ultrapassa o limite padrão de 100kb do express.json().
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Front-end estático (opcional). No Replit o build do web era servido pela
// plataforma; na VPS, defina STATIC_DIR (ex: artifacts/maratona/dist/public)
// para a própria API servir o SPA, ou deixe vazio e sirva pelo Nginx.
const staticDir = process.env.STATIC_DIR ? path.resolve(process.env.STATIC_DIR) : "";
if (staticDir) {
  if (!existsSync(path.join(staticDir, "index.html"))) {
    logger.warn({ staticDir }, "STATIC_DIR sem index.html: front-end não será servido");
  } else {
    app.use(express.static(staticDir, { index: false, maxAge: "1h" }));
    // Fallback do SPA: qualquer GET fora de /api devolve o index.html.
    app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Erro interno do servidor" });
});

export default app;
