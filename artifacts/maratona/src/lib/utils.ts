import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatEventSubtitle(e: { clientName?: string | null; city?: string | null; state?: string | null }): string {
  const place = [e.city, e.state].filter(Boolean).join("/");
  return [e.clientName, place].filter(Boolean).join(" · ");
}

/**
 * Formata uma string de data "YYYY-MM-DD" vinda do backend como UTC.
 * Usar new Date("YYYY-MM-DD") interpreta como meia-noite UTC e converte para
 * o fuso local (UTC-3 no Brasil), mostrando o dia anterior. Resolver
 * anexando T12:00:00Z (meio-dia UTC = 9h Brasília) evita a travessia de meia-noite.
 */
export function fmtDate(
  dateStr: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit" },
  locale = "pt-BR",
): string {
  if (!dateStr) return "—";
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString(locale, opts);
}
