import type { Request, Response, NextFunction } from "express";
import { verifyToken, isRole } from "./auth.js";

/**
 * Regra do dono (10/2026): o papel AVALIADOR só avalia e vê o que foi
 * avaliado — nada mais do app. Em vez de conferir rota por rota (e esquecer
 * uma), a API recusa para o avaliador tudo o que não está nesta lista: as
 * chamadas da tela /evaluations (lista da área, critérios do evento, avaliações,
 * matriz de conformidade quando é dele, links de freela, áudio) e a sessão.
 *
 * Fica de fora, entre outros: lista e detalhe de eventos, participantes,
 * colaboradores, resultados, ranking, calibrações, análises, painel, regras,
 * penalidades, exportações e "Meu desempenho".
 */
const ALLOW: { methods: string[] | "*"; path: RegExp }[] = [
  { methods: "*", path: /^\/auth\// },
  { methods: "*", path: /^\/healthz$/ },
  { methods: "*", path: /^\/public-eval\// },
  { methods: ["GET"], path: /^\/cycles\/current$/ },
  // Avaliações: listar, criar rascunho, editar, enviar (reabrir é só admin/RH).
  { methods: ["GET", "POST"], path: /^\/evaluations$/ },
  { methods: ["GET"], path: /^\/evaluations\/my-area$/ },
  { methods: ["PATCH", "DELETE"], path: /^\/evaluations\/\d+$/ },
  { methods: ["POST"], path: /^\/evaluations\/\d+\/submit$/ },
  // O que a tela do evento usa.
  { methods: ["GET"], path: /^\/events\/\d+\/criteria$/ },
  { methods: ["GET", "PUT", "POST", "PATCH"], path: /^\/events\/\d+\/conformity$/ },
  { methods: ["PUT", "POST", "PATCH"], path: /^\/events\/\d+\/conformity-evaluator(-ferramentas)?$/ },
  { methods: ["GET"], path: /^\/events\/\d+\/criterion-assignments$/ },
  { methods: ["PATCH", "PUT", "POST"], path: /^\/events\/\d+\/criterion-assignments\/\d+$/ },
  { methods: ["GET"], path: /^\/events\/\d+\/criterion-assignments\/redirect-options\/\d+$/ },
  { methods: ["GET"], path: /^\/events\/\d+\/public-link-eligible-criteria$/ },
  { methods: ["POST"], path: /^\/events\/\d+\/public-token(\/conformity(-ferramentas)?)?$/ },
  { methods: ["GET"], path: /^\/events\/\d+\/public-tokens(\/conformity(-ferramentas)?)?$/ },
  { methods: ["DELETE"], path: /^\/public-eval-tokens\/[^/]+$/ },
  { methods: ["GET"], path: /^\/users\/my-principal-areas$/ },
  { methods: ["GET"], path: /^\/users\/by-area\/\d+$/ },
  // Áudio da avaliação (gravar e ouvir).
  { methods: "*", path: /^\/storage\// },
];

// Casa o caminho CRU, exato e em minúsculas, e nega o resto: um caminho
// "disfarçado" (/EVALUATIONS, /events/%33/criteria) não está na lista e é
// recusado (403) — o erro é sempre para o lado de negar, nunca de liberar
// (M1, 4ª revisão: diferente da trava de ciclo fechado, que precisa normalizar).
export function isAllowedForEvaluator(method: string, path: string): boolean {
  const m = method.toUpperCase();
  const p = path.replace(/\/+$/, "") || "/";
  return ALLOW.some(a => (a.methods === "*" || a.methods.includes(m)) && a.path.test(p));
}

/**
 * Montado antes das rotas: só age quando o token é válido e o papel é
 * avaliador. Token ausente/inválido segue adiante (o requireAuth da rota
 * responde 401, como antes).
 */
export function evaluatorScope(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) { next(); return; }
  let role: string;
  try {
    role = verifyToken(auth.slice(7)).role;
  } catch {
    next();
    return;
  }
  if (!isRole(role, "avaliador") || req.method === "OPTIONS" || isAllowedForEvaluator(req.method, req.path)) { next(); return; }
  res.status(403).json({ error: "Acesso negado: o perfil avaliador só acessa a tela de avaliação.", code: "EVALUATOR_SCOPE" });
}
