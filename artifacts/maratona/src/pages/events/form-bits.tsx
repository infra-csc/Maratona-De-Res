// Peças pequenas reaproveitadas pelos formulários e diálogos da tela de eventos.
import type { CSSProperties } from "react";
import { ApiError } from "@workspace/api-client-react";
import { DANGER_TEXT } from "@/lib/premium-theme";

export const inputStyle: CSSProperties = { backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" };

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="text-[11px] font-semibold" style={{ color: DANGER_TEXT }}>{message}</p>;
}

/** Mensagem do servidor (`{ error }`) sem o prefixo "HTTP 400 ..." do ApiError. */
export function serverErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const data = e.data as { error?: unknown } | null;
    if (typeof data?.error === "string" && data.error.trim()) return data.error;
    return `HTTP ${e.status}`;
  }
  return e instanceof Error ? e.message : "Tente novamente.";
}
