import { createContext, useContext, useEffect, useState } from "react";

/**
 * Sistema de tema "premium" (dark/light, Barlow, cards arredondados) — a nova
 * identidade visual do app, aplicada página por página. Onde ainda não foi
 * convertida, a página segue no brutalismo antigo (Plus Jakarta Sans, bordas
 * retas) porque define sua própria fontFamily/cores inline, independente
 * destas CSS custom properties.
 *
 * Os TOKENS DE COR ficam em src/index.css (`:root` claro, `.dark` escuro).
 * Este arquivo só alterna a classe `dark` no <html> e exporta constantes.
 */

export const CONDENSED = "'Barlow Condensed', sans-serif";
export const BODY = "'Barlow', sans-serif";

// ---------------------------------------------------------------------------
// Cores semânticas FIXAS (iguais nos dois temas). Use estas constantes em vez
// de redeclarar hex nas páginas.
// ---------------------------------------------------------------------------
/** Erro / penalidade / bloqueio. */
export const WARNING = "#e5484d";
/** Positivo / concluído / dentro da meta (lima de marca). Só para fundos, barras e ícones. */
export const GOOD = "#9ab000";
/** Atenção / pendente / em andamento. */
export const AMBER = "#e8a23d";
/** Informativo / neutro-azul (links secundários, dicas). */
export const INFO = "#5b8def";
/**
 * Cor de marca legível como TEXTO. A lima `--accent` (#9ab000) tem só 2,45:1
 * sobre branco; `--accent-text` é #5c6b00 no claro (5,90:1 sobre card) e a
 * própria lima #d4ff00 no escuro (15,9:1). Resolve pelo tema automaticamente.
 */
export const ACCENT_TEXT = "var(--accent-text)";
/** Positivo como TEXTO (≥ 5,9:1 nos dois temas). GOOD fica para fundos, barras e ícones. */
export const GOOD_TEXT = "var(--status-ok-text)";
/** Atenção como TEXTO (≥ 5,9:1 nos dois temas). AMBER fica para fundos, barras e ícones. */
export const AMBER_TEXT = "var(--status-warn-text)";
/** Erro como TEXTO (≥ 4,5:1 nos dois temas). WARNING fica para fundos, bordas e ícones. */
export const DANGER_TEXT = "var(--status-danger-text)";
/** Informativo como TEXTO (≥ 4,5:1 nos dois temas). INFO fica para fundos, bordas e ícones. */
export const INFO_TEXT = "var(--status-info-text)";

// ---------------------------------------------------------------------------
// ESPELHOS dos tokens de tema. A FONTE DE VERDADE é src/index.css
// (`:root` = claro, `.dark` = escuro). O provider abaixo NÃO injeta estes
// valores: ele só alterna a classe `dark` no <html>. Mantidos exportados para
// quem precisa do hex em runtime (ex.: canvas/gráficos) — ao alterar o CSS,
// atualize aqui também.
// ---------------------------------------------------------------------------
export const darkTokens: React.CSSProperties = {
  ["--background" as string]: "#0c0c0c",
  ["--foreground" as string]: "#f0ede8",
  ["--card" as string]: "#141414",
  ["--card-foreground" as string]: "#f0ede8",
  ["--card-border" as string]: "#2a2a2a",
  ["--popover" as string]: "#1a1a1a",
  ["--popover-foreground" as string]: "#f0ede8",
  ["--primary" as string]: "#d4ff00",
  ["--primary-foreground" as string]: "#0c0c0c",
  ["--secondary" as string]: "#1e1e1e",
  ["--secondary-foreground" as string]: "#f0ede8",
  ["--muted" as string]: "#1e1e1e",
  ["--muted-foreground" as string]: "#9a9a90",
  ["--accent" as string]: "#d4ff00",
  ["--accent-foreground" as string]: "#0c0c0c",
  ["--accent-text" as string]: "#d4ff00",
  ["--destructive" as string]: "#cf3030",
  ["--destructive-foreground" as string]: "#ffffff",
  ["--border" as string]: "rgba(255,255,255,0.08)",
  ["--input" as string]: "#2a2a2a",
  ["--ring" as string]: "#d4ff00",
};

export const lightTokens: React.CSSProperties = {
  ["--background" as string]: "#f2f1ec",
  ["--foreground" as string]: "#111111",
  ["--card" as string]: "#ffffff",
  ["--card-foreground" as string]: "#111111",
  ["--card-border" as string]: "#e1e7ef",
  ["--popover" as string]: "#ffffff",
  ["--popover-foreground" as string]: "#111111",
  ["--primary" as string]: "#111111",
  ["--primary-foreground" as string]: "#ffffff",
  ["--secondary" as string]: "#e8e6e0",
  ["--secondary-foreground" as string]: "#111111",
  ["--muted" as string]: "#f0f2f5",
  ["--muted-foreground" as string]: "#5f5f57",
  ["--accent" as string]: "#9ab000",
  ["--accent-foreground" as string]: "#111111",
  ["--accent-text" as string]: "#5c6b00",
  ["--destructive" as string]: "#dc2626",
  ["--destructive-foreground" as string]: "#ffffff",
  ["--border" as string]: "rgba(0,0,0,0.1)",
  ["--input" as string]: "#e1e7ef",
  ["--ring" as string]: "#111111",
};

const STORAGE_KEY = "premium_theme_dark";

interface PremiumThemeCtx {
  isDark: boolean;
  toggle: () => void;
}

const Ctx = createContext<PremiumThemeCtx | null>(null);

export function PremiumThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(() => localStorage.getItem(STORAGE_KEY) === "1");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, isDark ? "1" : "0");
  }, [isDark]);

  // Só alterna a classe: os valores vivem em src/index.css (:root / .dark).
  // Assim `var(--card)` inline e `bg-card` do Tailwind apontam para a mesma cor,
  // e a variante `dark:` do Tailwind passa a funcionar.
  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("dark", isDark);
    return () => {
      // Ao sair do AppLayout (login, /eval), volta para o tema claro do :root.
      el.classList.remove("dark");
    };
  }, [isDark]);

  return (
    <Ctx.Provider value={{ isDark, toggle: () => setIsDark(v => !v) }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePremiumTheme(): PremiumThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePremiumTheme must be used within PremiumThemeProvider");
  return ctx;
}

/** Card base do sistema novo — cantos arredondados, sem sombra dura. */
export function PremiumCard({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-xl transition-colors duration-300 ${className}`}
      style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", ...style }}
    >
      {children}
    </div>
  );
}
