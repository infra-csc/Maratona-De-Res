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

/**
 * Formata um timestamp ISO completo (ex.: "2026-09-23T14:05:00.000Z") com data e
 * hora no fuso local. Diferente de `fmtDate`, que recebe só "YYYY-MM-DD".
 */
export function fmtDateTime(
  value: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" },
  locale = "pt-BR",
): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(locale, opts);
}

export interface CycleWeekend {
  /** Sábado, "YYYY-MM-DD". */
  sat: string;
  /** Domingo, "YYYY-MM-DD". */
  sun: string;
  /** Rótulo curto "DD–DD/MM". */
  label: string;
}

/**
 * Lista os fins de semana (sáb–dom) dentro do período do ciclo.
 * Usado pela lista de eventos (chips de fim de semana) e pelo dashboard.
 */
export function getCycleWeekends(startDate?: string | null, endDate?: string | null): CycleWeekend[] {
  if (!startDate || !endDate) return [];
  const result: CycleWeekend[] = [];
  const end = new Date(endDate + "T12:00:00");
  const d = new Date(startDate + "T12:00:00");
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  while (d <= end) {
    const sat = d.toISOString().split("T")[0];
    const sunD = new Date(d); sunD.setDate(sunD.getDate() + 1);
    const sun = sunD.toISOString().split("T")[0];
    const label = `${String(d.getDate()).padStart(2, "0")}–${String(sunD.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    result.push({ sat, sun, label });
    d.setDate(d.getDate() + 7);
  }
  return result;
}

/**
 * Número para exibição no padrão brasileiro (vírgula decimal), com casas fixas.
 * Use no lugar de `.toFixed()` em qualquer valor mostrado na tela.
 */
export function fmtNum(value: number, digits = 1): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
