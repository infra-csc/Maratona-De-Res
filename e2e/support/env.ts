// Portas, caminhos e credenciais compartilhados entre o global-setup e os specs.
// Portas fixas (sobrescrevíveis por env) para não colidir com o ambiente de
// desenvolvimento local, que costuma ocupar 8080 / 5180 / 55440.
import path from "node:path";

export const REPO_ROOT = path.resolve(__dirname, "..", "..");

export const DB_PORT = Number(process.env.E2E_DB_PORT ?? 55441);
export const API_PORT = Number(process.env.E2E_API_PORT ?? 8091);
export const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 5191);

export const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
export const API_URL = `http://127.0.0.1:${API_PORT}`;

/** Build da API (esbuild) e do front (vite build) usados pelo teste. */
export const API_DIST = process.env.E2E_API_DIST ?? path.join(REPO_ROOT, "artifacts", "api-server", "dist");
export const WEB_DIST = process.env.E2E_WEB_DIST ?? path.join(REPO_ROOT, "artifacts", "maratona", "dist", "public");

/** Onde o global-setup grava o log da API (vai junto no artefato do CI em falha). */
export const LOG_DIR = path.join(REPO_ROOT, "test-results");

export const JWT_SECRET = "segredo-dos-testes-e2e";

// O login da tela é por CPF e a senha é o próprio CPF (ver pages/login.tsx).
export const ADMIN = { id: 1, name: "Admin E2E", cpf: "11144477735" } as const;
export const AVALIADOR = { id: 2, name: "Avaliador E2E", cpf: "22255588846" } as const;

/** Evento que o fluxo avalia, calibra e confirma. */
export const TARGET_EVENT = { id: 8, name: "Maratona E2E Principal" } as const;

/** Colaboradora que chega aos 8 eventos (mínimo de elegibilidade) com o evento alvo. */
export const ANA = { id: 1, name: "Ana Pereira E2E" } as const;

export const CRITERIA = [
  { id: 1, name: "Qualidade da entrega" },
  { id: 2, name: "Pontualidade" },
] as const;
