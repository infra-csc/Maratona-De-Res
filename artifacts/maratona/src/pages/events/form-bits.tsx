// Peça pequena reaproveitada pelos formulários e diálogos da tela de eventos.
import { ApiError } from "@workspace/api-client-react";

/** Mensagem do servidor (`{ error }`) sem o prefixo "HTTP 400 ..." do ApiError. */
export function serverErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const data = e.data as { error?: unknown } | null;
    if (typeof data?.error === "string" && data.error.trim()) return data.error;
    return `HTTP ${e.status}`;
  }
  return e instanceof Error ? e.message : "Tente novamente.";
}
