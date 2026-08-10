/**
 * Rate limiters compartilhados.
 * Cada limiter é criado uma vez e reutilizado nos handlers.
 *
 * Limites escolhidos conservadoramente para uma operação interna corporativa
 * (não SaaS de alta escala), focando em proteger endpoints sensíveis sem
 * impactar usuários legítimos.
 */
import rateLimit from "express-rate-limit";

/** Login: 10 tentativas por IP por janela de 15 minutos. */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de login. Tente novamente em 15 minutos." },
  skipSuccessfulRequests: true, // conta apenas falhas
});

/**
 * Submissão de avaliação pública (links de freelancer).
 * Rota não autenticada, portanto mais restrita: 30 por IP por 5 minutos.
 */
export const publicEvalLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em alguns minutos." },
});

/**
 * Limiter geral para toda a API: 300 req/min por IP.
 * Proteção contra flood sem impactar uso normal.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Limite de requisições atingido. Tente novamente em instantes." },
  skip: (req) => {
    // Health check nunca é limitado
    return req.path === "/healthz" || req.path === "/health";
  },
});
