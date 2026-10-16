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
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  const focusable = el.matches("input, textarea, button") ? el : el.querySelector<HTMLElement>("input, textarea, button");
  focusable?.focus({ preventScroll: true });
  // Destaque curto para o olho achar o campo (mesma animação da tela do avaliador).
  const box = el.closest<HTMLElement>("[data-pending-box]") ?? el;
  box.classList.add("eval-flash");
  window.setTimeout(() => box.classList.remove("eval-flash"), 1200);
}

/** Rola até uma seção (índice / barra de progresso), respeitando "reduzir movimento". */
export function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}
