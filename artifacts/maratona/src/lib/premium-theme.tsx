import { createContext, useContext, useEffect, useState } from "react";

/**
 * Sistema de tema "premium" (dark/light, Barlow, cards arredondados) — a nova
 * identidade visual do app, aplicada página por página. Onde ainda não foi
 * convertida, a página segue no brutalismo antigo (Plus Jakarta Sans, bordas
 * retas) porque define sua própria fontFamily/cores inline, independente
 * destas CSS custom properties.
 */

export const CONDENSED = "'Barlow Condensed', sans-serif";
export const BODY = "'Barlow', sans-serif";
// Cor de alerta fixa (não faz parte do tema claro/escuro) — usada para
// sinalizar penalidades e erros, igual nos dois modos.
export const WARNING = "#e5484d";

export const darkTokens: React.CSSProperties = {
  ["--background" as string]: "#0c0c0c",
  ["--foreground" as string]: "#f0ede8",
  ["--card" as string]: "#141414",
  ["--card-foreground" as string]: "#f0ede8",
  ["--primary" as string]: "#d4ff00",
  ["--primary-foreground" as string]: "#0c0c0c",
  ["--secondary" as string]: "#1e1e1e",
  ["--muted-foreground" as string]: "#7a7a7a",
  ["--accent" as string]: "#d4ff00",
  ["--accent-foreground" as string]: "#0c0c0c",
  ["--border" as string]: "rgba(255,255,255,0.08)",
  ["--ring" as string]: "#d4ff00",
};

export const lightTokens: React.CSSProperties = {
  ["--background" as string]: "#f2f1ec",
  ["--foreground" as string]: "#111111",
  ["--card" as string]: "#ffffff",
  ["--card-foreground" as string]: "#111111",
  ["--primary" as string]: "#111111",
  ["--primary-foreground" as string]: "#ffffff",
  ["--secondary" as string]: "#e8e6e0",
  ["--muted-foreground" as string]: "#888880",
  ["--accent" as string]: "#9ab000",
  ["--accent-foreground" as string]: "#111111",
  ["--border" as string]: "rgba(0,0,0,0.1)",
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
