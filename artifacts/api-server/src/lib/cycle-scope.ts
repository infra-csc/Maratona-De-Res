import type { Response } from "express";
import { db, cyclesTable, type Cycle } from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";
import { getCurrentCycle } from "./cycle.js";

/**
 * Recorte de ciclo das rotas de LEITURA (Resultados, Análises, Dashboard,
 * Eventos): `?cycleId=` vazio = ciclo atual (como sempre foi); um id = aquele
 * ciclo (atual ou anterior); `all` = todos os ciclos ("Total geral").
 *
 * Rotas de ESCRITA não usam isto: continuam sempre no ciclo atual.
 */
export type CycleScope =
  | { kind: "cycle"; cycle: Cycle; isCurrent: boolean; currentId: number | null }
  | { kind: "all"; cycles: Cycle[]; currentId: number | null };

export type CycleScopeResult =
  | { ok: true; scope: CycleScope | null }
  | { ok: false; status: 400 | 404; error: string };

const PG_INT_MAX = 2_147_483_647;

/** Lê o parâmetro bruto: vazio → atual; "all" → todos; inteiro > 0 → id; o resto é inválido. */
export function parseCycleParam(raw: unknown): { kind: "current" } | { kind: "all" } | { kind: "id"; id: number } | null {
  if (raw === undefined || raw === "") return { kind: "current" };
  if (typeof raw !== "string") return null; // ?cycleId=1&cycleId=2 chega como array
  const v = raw.trim().toLowerCase();
  if (v === "all") return { kind: "all" };
  if (!/^\d+$/.test(v)) return null;
  const id = Number(v);
  // cycles.id é integer do Postgres: acima de 2.147.483.647 a consulta
  // quebraria (500) — é id inválido (400), não "ciclo não encontrado".
  return Number.isSafeInteger(id) && id > 0 && id <= PG_INT_MAX ? { kind: "id", id } : null;
}

/**
 * Resolve o recorte. `scope: null` = não existe ciclo nenhum (banco vazio) —
 * as rotas respondem vazio, como antes. `allowAll: false` recusa "all" (400)
 * nas rotas em que o total não faz sentido (ex.: detalhe de um ciclo).
 */
export async function resolveCycleScope(raw: unknown, opts: { allowAll?: boolean } = {}): Promise<CycleScopeResult> {
  const parsed = parseCycleParam(raw);
  if (!parsed) return { ok: false, status: 400, error: "cycleId inválido: use o número do ciclo ou \"all\"" };
  const current = await getCurrentCycle();
  const currentId = current?.id ?? null;

  if (parsed.kind === "current") {
    return { ok: true, scope: current ? { kind: "cycle", cycle: current, isCurrent: true, currentId } : null };
  }
  if (parsed.kind === "all") {
    if (opts.allowAll === false) return { ok: false, status: 400, error: "cycleId=all não é aceito aqui: escolha um ciclo" };
    const cycles = await db.select().from(cyclesTable)
      .orderBy(desc(cyclesTable.isCurrent), sql`${cyclesTable.startDate} DESC NULLS LAST`, desc(cyclesTable.id));
    return { ok: true, scope: cycles.length > 0 ? { kind: "all", cycles, currentId } : null };
  }
  const [cycle] = await db.select().from(cyclesTable).where(eq(cyclesTable.id, parsed.id)).limit(1);
  if (!cycle) return { ok: false, status: 404, error: "Ciclo não encontrado" };
  return { ok: true, scope: { kind: "cycle", cycle, isCurrent: cycle.id === currentId, currentId } };
}

/** Responde o erro do recorte (400/404) e devolve true; false = siga em frente. */
export function sendScopeError(res: Response, r: CycleScopeResult): r is Extract<CycleScopeResult, { ok: false }> {
  if (r.ok) return false;
  res.status(r.status).json({ error: r.error });
  return true;
}

/** Ids dos ciclos do recorte. */
export function scopeCycleIds(scope: CycleScope): number[] {
  return scope.kind === "all" ? scope.cycles.map(c => c.id) : [scope.cycle.id];
}

/**
 * Ciclo "sintético" do Total geral para as respostas que sempre trazem um
 * `cycle` ({ id, name, startDate, endDate }): id 0, nome "Total geral" e o
 * período do primeiro ao último ciclo.
 */
export function scopeCycleInfo(scope: CycleScope): { id: number; name: string; startDate: string | null; endDate: string | null } {
  if (scope.kind === "cycle") {
    return { id: scope.cycle.id, name: scope.cycle.name, startDate: scope.cycle.startDate ?? null, endDate: scope.cycle.endDate ?? null };
  }
  const starts = scope.cycles.map(c => c.startDate).filter((d): d is string => !!d).sort();
  const ends = scope.cycles.map(c => c.endDate).filter((d): d is string => !!d).sort();
  return { id: 0, name: "Total geral", startDate: starts[0] ?? null, endDate: ends[ends.length - 1] ?? null };
}
