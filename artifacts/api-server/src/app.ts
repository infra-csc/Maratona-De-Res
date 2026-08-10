import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { apiLimiter } from "./lib/rate-limit.js";

const app: Express = express();

// ---------------------------------------------------------------------------
// CORS — permitir apenas origens conhecidas.
// ALLOWED_ORIGINS: lista separada por vírgula de origens adicionais (ex: deploy).
// REPLIT_DEV_DOMAIN / REPLIT_DOMAINS: injetados automaticamente pelo Replit.
// ---------------------------------------------------------------------------
const allowedOriginSet = new Set<string>([
  ...(process.env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean),
  ...(process.env.REPLIT_DEV_DOMAIN ? [`https://${process.env.REPLIT_DEV_DOMAIN}`] : []),
  ...(process.env.REPLIT_DOMAINS ? process.env.REPLIT_DOMAINS.split(",").map((d) => `https://${d.trim()}`) : []),
]);

app.use(
  cors({
    origin: (origin, callback) => {
      // Sem Origin → mesmo domínio, curl, Replit preview iframe → permitir
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

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Erro interno do servidor" });
});

export default app;
