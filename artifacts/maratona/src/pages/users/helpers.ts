import type { CSSProperties } from "react";
import { ApiError } from "@workspace/api-client-react";
import { GOOD_TEXT, DANGER_TEXT, AMBER_TEXT, INFO_TEXT } from "@/lib/premium-theme";

export const fieldStyle: CSSProperties = { backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" };

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

export const ROLES: { value: string; label: string; bg: string; fg: string }[] = [
  { value: "admin", label: "Administrador", bg: "var(--primary)", fg: "var(--primary-foreground)" },
  { value: "rh", label: "RH", bg: "rgba(154,176,0,0.14)", fg: GOOD_TEXT },
  { value: "avaliador", label: "Avaliador", bg: "var(--secondary)", fg: "var(--muted-foreground)" },
  { value: "diretoria", label: "Diretoria", bg: "rgba(229,72,77,0.12)", fg: DANGER_TEXT },
  { value: "visualizador", label: "Visualizador", bg: "rgba(232,162,61,0.14)", fg: AMBER_TEXT },
  // Confirma equipes por evento e envia avaliação (qualquer área), cadastra/edita
  // colaboradores — mas nunca vê nota, resposta enviada ou matriz de conformidade.
  { value: "operador", label: "Operador", bg: "rgba(91,141,239,0.14)", fg: INFO_TEXT },
];

export function getRoleInfo(role: string) {
  return ROLES.find(r => r.value === role) ?? { label: role, bg: "var(--secondary)", fg: "var(--muted-foreground)" };
}

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}
