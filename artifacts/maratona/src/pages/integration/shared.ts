import { ApiError } from "@workspace/api-client-react";

/** Mensagem do servidor (`{ error }`), o texto padrão quando o corpo não traz um, ou a falha de rede. */
export function serverErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    const data = e.data as { error?: unknown } | null;
    return typeof data?.error === "string" && data.error.trim() ? data.error : fallback;
  }
  return e instanceof Error ? e.message : "Tente novamente.";
}
