/**
 * Preparação da trilha de auditoria para leitura humana: tira segredos do que
 * foi gravado e descobre quais IDs citados (evento, pessoa, critério…) precisam
 * virar nome na tela. Funções puras — testadas em audit-view.test.ts.
 */

/** Campos que nunca saem da API, mesmo para admin (hash de senha, PIN, tokens). */
const SECRET_KEY = /pass(word)?|hash|^pin$|pinCode|token|secret/i;
export const REDACTED = "(oculto)";

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEY.test(k) && v != null && v !== "" ? REDACTED : redact(v);
    }
    return out;
  }
  return value;
}

export function parseAuditJson(raw: string | null): unknown {
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

export type RefKind = "users" | "events" | "employees" | "criteria" | "cycles" | "areas";

/**
 * Tipo de registro que um campo aponta, pelo nome: `conformityEvaluatorUserId`
 * → users, `eventId` → events. `from`/`to` são os redirecionamentos de avaliador.
 */
export function refKindForKey(key: string): RefKind | null {
  if (/(^|[a-z])(userId|UserId|evaluatorId|EvaluatorId|assignedToId|redirectedFromId|impersonatedUserId|realAdminId)$/.test(key) || key === "from" || key === "to" || key === "userId") return "users";
  if (/(^e|E)ventId$|^keepId$|^previousCurrentEventId$/.test(key)) return "events";
  if (/(^e|E)mployeeId$|^canonicalId$/.test(key)) return "employees";
  if (/(^c|C)riterionId$/.test(key)) return "criteria";
  if (/(^c|C)ycleId$|^previousCurrentId$/.test(key)) return "cycles";
  if (/(^a|A)reaId$/.test(key)) return "areas";
  return null;
}

/** Tipo de registro da própria linha (`entity` + `entityId`), quando tem nome. */
export function refKindForEntity(entity: string): RefKind | null {
  switch (entity) {
    case "users": return "users";
    case "events": return "events";
    case "employees": return "employees";
    case "criteria": return "criteria";
    case "cycles": return "cycles";
    case "areas": return "areas";
    default: return null;
  }
}

/** Junta os IDs citados em before/after (até 2 níveis) por tipo de registro. */
export function collectRefs(values: unknown[], into: Record<RefKind, Set<number>>): void {
  const visit = (v: unknown, depth: number) => {
    if (depth > 3 || v == null) return;
    if (Array.isArray(v)) { for (const x of v) visit(x, depth + 1); return; }
    if (typeof v !== "object") return;
    for (const [k, x] of Object.entries(v)) {
      const kind = refKindForKey(k);
      if (kind) {
        for (const id of Array.isArray(x) ? x : [x]) {
          const n = typeof id === "number" ? id : typeof id === "string" && /^\d+$/.test(id) ? Number(id) : NaN;
          if (Number.isInteger(n) && n > 0) into[kind].add(n);
        }
      } else if (typeof x === "object") visit(x, depth + 1);
    }
  };
  for (const v of values) visit(v, 0);
}

export function emptyRefSets(): Record<RefKind, Set<number>> {
  return { users: new Set(), events: new Set(), employees: new Set(), criteria: new Set(), cycles: new Set(), areas: new Set() };
}
