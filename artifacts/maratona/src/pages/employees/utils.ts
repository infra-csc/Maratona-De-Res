import { ApiError } from "@workspace/api-client-react";
import type { GeneratedCredential } from "@workspace/api-client-react";
import type { EligibilityStatus, EmployeeWithCycle } from "./types";

export const fieldStyle: React.CSSProperties = { backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" };

/** Campo obrigatório que rejeita espaços em branco (o `required` nativo aceita "   "). */
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

/** Enter/Espaço acionam linhas com role="checkbox". */
export function onKeyToggle(fn: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };
}

export function downloadCredentialsCsv(created: GeneratedCredential[]) {
  const header = "Nome,CPF (login),Senha";
  const rows = created.map(c => `"${c.name.replace(/"/g, '""')}",${c.cpfLogin},${c.password}`);
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `credenciais-colaboradores-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const employmentTypeLabel = (t?: string) => (t === "freela" ? "Freela" : "Casa");

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

const LOWER_WORDS = new Set(["da","de","do","das","dos","dos","e","em","na","no","nas","nos","a","o","as","os"]);
export function toTitleCase(str: string) {
  return str.toLowerCase().split(/\s+/).map((w, i) => i === 0 || !LOWER_WORDS.has(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(" ");
}

// cycleEligible = computed quarterly eligibility (8-event rule); null = no cycle data yet
// Freelas never have quarterly_results entries, so cycleEligible is always null for them
export const getEligibilityStatus = (e: EmployeeWithCycle): EligibilityStatus => {
  if (e.employmentType === "freela") return "freela";
  if (e.cycleEligible === true) return "eligible";
  if (e.cycleEligible === false) return "not_eligible";
  // No cycle data yet: fall back to admin flag
  return e.eligibleForBonus === false ? "not_eligible" : "pending";
};

/** Lista "Nome;CPF" colada pelo admin → linhas válidas (nome em maiúsculas, CPF com 11 dígitos). */
export function parseCpfRows(text: string) {
  return text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      const [name, doc] = l.split(/[;,\t]/).map(x => (x ?? "").trim());
      return { name: (name ?? "").toUpperCase(), document: (doc ?? "").replace(/\D/g, "") };
    })
    .filter(r => r.name && r.document.length === 11);
}
