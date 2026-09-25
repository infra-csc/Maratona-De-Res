import { useMemo } from "react";
import { fmtNum } from "@/lib/utils";
import { GOOD_TEXT, AMBER_TEXT, DANGER_TEXT } from "@/lib/premium-theme";

export const BONUS_STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  projected: { label: "Projetado", bg: "var(--secondary)", color: "var(--muted-foreground)" },
  approved: { label: "Aprovado", bg: "rgba(154,176,0,0.14)", color: GOOD_TEXT },
  scheduled: { label: "Agendado", bg: "rgba(232,162,61,0.14)", color: AMBER_TEXT },
  paid: { label: "Pago", bg: "var(--primary)", color: "var(--primary-foreground)" },
  blocked: { label: "Bloqueado", bg: "rgba(229,72,77,0.12)", color: DANGER_TEXT },
  not_eligible: { label: "Não elegível", bg: "var(--secondary)", color: "var(--muted-foreground)" },
};
export const BONUS_STATUS_OPTIONS = ["projected", "approved", "scheduled", "paid", "blocked", "not_eligible"];

export type SortDir = "asc" | "desc";

/** Ordena `items` por `key` (strings e números; outros tipos mantêm a ordem). Hook: memoriza entre renders. */
export function useSort<T extends object>(items: T[], key: keyof T | null, dir: SortDir): T[] {
  return useMemo(() => {
    if (!key) return items;
    return [...items].sort((a, b) => {
      const av: unknown = a[key];
      const bv: unknown = b[key];
      if (typeof av === "string" && typeof bv === "string") return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
      return 0;
    });
  }, [items, key, dir]);
}

/** Enter/Espaço acionam elementos com role="button" (linhas clicáveis das tabelas). */
export function onKeyActivate(fn: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };
}

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

export const fmtScore = (v: number) => fmtNum(v, 1);
export const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const fmtBRLShort = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const fieldStyle: React.CSSProperties = { backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" };

/** Preto ou branco conforme a luminância do fundo — faixas são cores livres cadastradas em Regras do Sistema, muitas claras/pastel. */
export function contrastingTextColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#fff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111111" : "#ffffff";
}
