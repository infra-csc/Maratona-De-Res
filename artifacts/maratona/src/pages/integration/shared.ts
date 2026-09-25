import { ApiError } from "@workspace/api-client-react";
import { AMBER, INFO } from "@/lib/premium-theme";

// AMBER (atenção) e INFO (informativo) não têm classe de token no index.css;
// entram como CSS vars locais para as classes `text-[var(--amber)]` etc.
// Dialogs renderizam em portal (fora da raiz da página), então recebem as
// mesmas vars via DIALOG_STYLE.
export const THEME_VARS = { ["--amber" as string]: AMBER, ["--info" as string]: INFO } as React.CSSProperties;
export const DIALOG_STYLE: React.CSSProperties = { ...THEME_VARS, backgroundColor: "var(--card)", color: "var(--foreground)" };

/** Mensagem do servidor (`{ error }`), o texto padrão quando o corpo não traz um, ou a falha de rede. */
export function serverErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    const data = e.data as { error?: unknown } | null;
    return typeof data?.error === "string" && data.error.trim() ? data.error : fallback;
  }
  return e instanceof Error ? e.message : "Tente novamente.";
}
