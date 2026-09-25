// E2E de navegador (Playwright). Rodar da raiz: `pnpm run test:e2e`.
// Pré-requisito: builds da API e do front (o global-setup avisa se faltarem):
//   pnpm --filter @workspace/api-server run build
//   PORT=5191 BASE_PATH=/ pnpm --filter @workspace/maratona run build
// Navegador: chromium do Playwright (CI: `pnpm exec playwright install --with-deps chromium`).
// Localmente dá para usar um navegador já instalado: E2E_CHANNEL=msedge (ou chrome).
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { WEB_URL } from "./support/env";

const ROOT = path.resolve(__dirname, "..");
const channel = process.env.E2E_CHANNEL || undefined;

export default defineConfig({
  testDir: __dirname,
  testMatch: "**/*.spec.ts",
  globalSetup: "./global-setup.ts",
  outputDir: path.join(ROOT, "test-results", "e2e"),
  // O fluxo muda o banco (avaliação enviada, evento confirmado): um worker só,
  // sem retry — repetir em cima do mesmo banco não é uma nova tentativa limpa.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    // No CI, cada falha também vira anotação no commit (visível sem login).
    ...(process.env.CI ? [["github"] as ["github"]] : []),
    ["html", { outputFolder: path.join(ROOT, "playwright-report"), open: "never" }],
  ],
  use: {
    baseURL: WEB_URL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, ...(channel ? { channel } : {}) },
    },
  ],
});
