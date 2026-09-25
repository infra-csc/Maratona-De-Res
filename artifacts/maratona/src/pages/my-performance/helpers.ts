import { ApiError } from "@workspace/api-client-react";

/** Mensagem do servidor (`{ error }`) sem o prefixo "HTTP 404 ..." do ApiError. */
export function performanceErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const data = e.data as { error?: unknown } | null;
    return typeof data?.error === "string" && data.error.trim() ? data.error : "Erro ao carregar desempenho";
  }
  return e instanceof Error ? e.message : "Erro ao carregar desempenho";
}

export function contrastingTextColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#fff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111111" : "#ffffff";
}

/** Cor de TEXTO para uma nota 0–100 (tokens legíveis nos dois temas). */
export function scoreColor(score: number | null): string {
  if (score === null) return "var(--muted-foreground)";
  if (score >= 80) return "var(--status-ok-text)";
  if (score >= 60) return "var(--status-warn-text)";
  return "var(--status-danger-text)";
}

/** Cor de BARRA/preenchimento para uma nota 0–100 (a lima da marca só em fundo). */
export function scoreBarColor(score: number | null): string {
  if (score === null) return "var(--muted)";
  if (score >= 80) return "var(--accent)";
  if (score >= 60) return "var(--status-warn)";
  return "var(--status-danger)";
}

export function scoreLabel(score: number | null): string {
  if (score === null) return "";
  if (score >= 90) return "Excelente";
  if (score >= 80) return "Muito bom";
  if (score >= 60) return "Regular";
  return "Abaixo da meta";
}
