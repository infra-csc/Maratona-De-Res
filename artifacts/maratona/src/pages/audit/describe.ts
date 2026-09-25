import type { AuditLog, AuditRefs } from "@workspace/api-client-react";
import { fmtDate, fmtDateTime, fmtNum } from "@/lib/utils";
import { NOISE_FIELDS, fieldLabel } from "./labels";

/**
 * Transforma o antes/depois gravado na auditoria em linhas legíveis
 * ("Avaliador de Cenografia: Sandro → Fred"). IDs citados viram nome pelo
 * `refs` que a API manda junto com a página.
 */

type RefKind = keyof AuditRefs;

/** Mesma regra da API (lib/audit-view.ts): o nome do campo diz para onde o ID aponta. */
function refKindForKey(key: string): RefKind | null {
  if (/(userId|UserId|evaluatorId|EvaluatorId|assignedToId|redirectedFromId|realAdminId)$/.test(key) || key === "from" || key === "to") return "users";
  if (/(^e|E)ventId$|^keepId$/.test(key)) return "events";
  if (/(^e|E)mployeeId$|^canonicalId$/.test(key)) return "employees";
  if (/(^c|C)riterionId$/.test(key)) return "criteria";
  if (/(^c|C)ycleId$|^previousCurrentId$/.test(key)) return "cycles";
  if (/(^a|A)reaId$/.test(key)) return "areas";
  return null;
}

// Valores de domínio gravados em código ("draft", "avaliador") → português.
const VALUE_LABELS: Record<string, Record<string, string>> = {
  role: { admin: "Admin", rh: "RH", diretoria: "Diretoria", operador: "Operador", avaliador: "Avaliador", visualizador: "Colaborador" },
  status: {
    draft: "Rascunho", submitted: "Enviada", open: "Aberto", closed: "Encerrado", pending: "Pendente",
    suggested: "Sugerida", confirmed: "Confirmada", redirected: "Repassada", planned: "Planejado",
  },
  employmentType: { casa: "Casa", freela: "Freela" },
  kind: { penalty: "Penalidade", merit: "Mérito" },
};

const ISO_DAY =/^\d{4}-\d{2}-\d{2}$/;
const ISO_TS = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

export function formatValue(key: string, value: unknown, refs: AuditRefs | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const kind = refKindForKey(key);
  if (kind && (typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value)))) {
    return refs?.[kind]?.[String(value)] ?? `#${value}`;
  }
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : fmtNum(value, 2);
  if (typeof value === "string") {
    const mapped = VALUE_LABELS[key]?.[value];
    if (mapped) return mapped;
    if (ISO_DAY.test(value)) return fmtDate(value, { day: "2-digit", month: "2-digit", year: "numeric" });
    if (ISO_TS.test(value)) return fmtDateTime(value);
    // Decimais que o Postgres devolve como texto ("8.50").
    if (/^-?\d+\.\d+$/.test(value)) return fmtNum(Number(value), 2);
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "nenhum";
    if (value.every(v => typeof v !== "object")) return value.map(v => formatValue(key, v, refs)).join(", ");
    return `${value.length} ${value.length === 1 ? "item" : "itens"}`;
  }
  return "…";
}

export interface ChangeLine {
  key: string;
  label: string;
  before: string | null;
  after: string | null;
  /** true quando a linha é um valor que mudou (antes ≠ depois). */
  changed: boolean;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function parseJson(raw: string | null | undefined): unknown {
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

/**
 * Linhas do bloco "O que mudou". Com antes E depois: só os campos que mudaram
 * (ou todos, com `all`). Só depois = o que foi registrado; só antes = o que foi
 * apagado. Carimbos (createdAt, updatedAt, id) ficam de fora.
 */
export function changeLines(log: Pick<AuditLog, "beforeJson" | "afterJson">, refs: AuditRefs | undefined, all = false): ChangeLine[] {
  const before = asRecord(parseJson(log.beforeJson));
  const after = asRecord(parseJson(log.afterJson));
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].filter(k => !NOISE_FIELDS.has(k));
  const lines: ChangeLine[] = [];
  for (const key of keys) {
    const b = before ? formatValue(key, before[key], refs) : null;
    const a = after ? formatValue(key, after[key], refs) : null;
    // Campo gravado só de um lado (ex.: evento e critério no "depois" de uma
    // calibração) é contexto, não mudança.
    const onBothSides = before != null && after != null && key in before && key in after;
    const changed = onBothSides && JSON.stringify(before[key]) !== JSON.stringify(after[key]);
    if (before && after && !changed && !all) continue;
    // Campo ausente dos dois lados do mesmo jeito ("—" → "—") não diz nada.
    if (b === "—" && a === "—") continue;
    lines.push({ key, label: fieldLabel(key), before: before ? b : null, after: after ? a : null, changed });
  }
  return lines;
}

/** Quantos campos mudaram de fato (para o resumo "3 campos alterados"). */
export function countChanged(log: Pick<AuditLog, "beforeJson" | "afterJson">): number {
  const before = asRecord(parseJson(log.beforeJson));
  const after = asRecord(parseJson(log.afterJson));
  if (!before || !after) return 0;
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter(k => !NOISE_FIELDS.has(k) && k in before && k in after && JSON.stringify(before[k]) !== JSON.stringify(after[k])).length;
}

/**
 * Nome do que foi afetado, na melhor fonte disponível: o nome resolvido pela
 * API; senão um `name` gravado no antes/depois; senão o contexto (evento e
 * critério citados, como numa calibração); senão "nº 123".
 */
export function subjectOf(log: AuditLog, refs: AuditRefs | undefined): string | null {
  if (log.entityLabel) return log.entityLabel;
  const before = asRecord(parseJson(log.beforeJson));
  const after = asRecord(parseJson(log.afterJson));
  const named = (after?.name ?? before?.name ?? after?.eventName ?? before?.eventName) as unknown;
  if (typeof named === "string" && named) return named;
  const src = after ?? before;
  if (src) {
    const parts: string[] = [];
    if (src.criterionId != null) parts.push(formatValue("criterionId", src.criterionId, refs));
    if (src.eventId != null) parts.push(formatValue("eventId", src.eventId, refs));
    if (src.employeeId != null) parts.push(formatValue("employeeId", src.employeeId, refs));
    if (parts.length) return parts.join(" · ");
  }
  return log.entityId ? `nº ${log.entityId}` : null;
}
