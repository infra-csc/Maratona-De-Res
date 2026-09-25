import { ApiError } from "@workspace/api-client-react";

/** Mensagem do servidor (`{ error }`) sem o prefixo "HTTP 4xx ..." do ApiError. */
export function serverErrorMessage(e: unknown, fallback: (status: number) => string): string {
  if (e instanceof ApiError) {
    const data = e.data as { error?: unknown } | null;
    return typeof data?.error === "string" && data.error.trim() ? data.error : fallback(e.status);
  }
  return e instanceof Error ? e.message : fallback(0);
}

// Rótulo apenas nas extremidades (0 e 10), conforme formulário oficial
export const scoreLabels: Record<number, string> = {
  0: "Crítico, não atendeu ao básico",
  10: "Perfeição, atendeu completamente e sem erros",
};

// Itens Sim/Não da Matriz de Conformidade de Cenografia e o comentário de cada um
export const cenoItems = ["epi", "estaiamentos", "conduta"] as const;
export const cenoCommentKeyOf = { epi: "epiComment", estaiamentos: "estaiamentosComment", conduta: "condutaComment" } as const;
export const cenoLabels = { epi: "EPI", estaiamentos: "Estaiamento e aterramento", conduta: "Conduta" } as const;

/** Rola até o campo pendente e foca o primeiro controle dele. */
export function focusPending(targetId: string) {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const focusable = el.matches("input, textarea, button") ? el : el.querySelector<HTMLElement>("input, textarea, button");
  focusable?.focus({ preventScroll: true });
}
