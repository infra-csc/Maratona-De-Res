import { ApiError } from "@workspace/api-client-react";

/** Regra de campo obrigatório que rejeita espaços em branco (o `required` nativo aceita "   "). */
export const requiredText = (message: string) => ({
  validate: (v: unknown) => (typeof v === "string" && v.trim().length > 0) || message,
});

/** Mensagem para o toast: `{ error }` do servidor, o texto padrão quando o corpo não traz um, ou a falha de rede. */
export function serverErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    const data = e.data as { error?: unknown } | null;
    return typeof data?.error === "string" && data.error.trim() ? data.error : fallback;
  }
  return e instanceof Error ? e.message : "Tente novamente.";
}
