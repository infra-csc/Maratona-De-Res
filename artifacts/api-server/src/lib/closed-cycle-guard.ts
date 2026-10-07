import type { Request, Response, NextFunction } from "express";
import { db, eventsTable, cyclesTable, evaluationsTable, calibrationCommentsTable, absencesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { isAfterCycleEnd } from "./cycle-rules.js";
import { getCurrentCycle } from "./cycle.js";
import { requireAuth } from "./auth.js";
import { eventsInNextCycle, nextCycleBody } from "./next-cycle.js";

/**
 * CICLO FECHADO SÓ CONSULTA — também na API, não só nas telas.
 *
 * Toda escrita sobre um evento cujo ciclo está fechado (status = closed) é
 * recusada com 409: o próprio evento, critérios, participantes, conformidade,
 * avaliações (inclusive pelo link público), calibrações, faltas/méritos,
 * elegibilidade e "fora do ciclo" do ciclo atual fechado.
 *
 * Fica LIBERADO:
 *  - o pagamento do bônus (PATCH /results/quarterly/:id/payment): o bônus é
 *    pago depois do fim do ciclo;
 *  - comentários do mural do evento (não mexem em nota);
 *  - evento "fora do período" (começa depois do fim do ciclo fechado): não
 *    faz parte do resultado dele e vai para o próximo ciclo quando ele for
 *    criado — pode ser PREPARADO (participantes, critérios, dados do evento,
 *    quem responde a matriz), mas NÃO avaliado: avaliação, matriz e link
 *    público nele respondem 409 code EVENT_NEXT_CYCLE até ele ser movido para
 *    um ciclo cujo período o contém (lib/next-cycle.ts, decisão de 06/10/2026;
 *    vale para o "fora do período" de qualquer ciclo, aberto ou fechado).
 *
 * Resposta padrão: 409 { error, code: "CLOSED_CYCLE", cycleClosed: true }.
 */
export const CLOSED_CYCLE_ERROR = "Ciclo fechado: só consulta. Edições ficam no ciclo atual; o pagamento do bônus deste ciclo continua liberado.";
export const CLOSED_CYCLE_CODE = "CLOSED_CYCLE";

/** Corpo padrão do 409 de ciclo fechado (mensagem própria opcional). */
export function closedCycleBody(error: string = CLOSED_CYCLE_ERROR, extra: Record<string, unknown> = {}) {
  return { error, code: CLOSED_CYCLE_CODE, cycleClosed: true, ...extra };
}

type EventRef = { id: number; startDate: string; cycleId: number };

async function eventsByIds(ids: number[]): Promise<EventRef[]> {
  const clean = [...new Set(ids.filter(n => Number.isInteger(n) && n > 0 && n <= 2_147_483_647))];
  if (clean.length === 0) return [];
  return db.select({ id: eventsTable.id, startDate: eventsTable.startDate, cycleId: eventsTable.cycleId })
    .from(eventsTable).where(inArray(eventsTable.id, clean));
}

/**
 * Quais destes eventos estão travados: ciclo fechado E dentro do período dele
 * (o "fora do período" fica liberado — vai para o próximo ciclo).
 */
export async function eventsLockedByClosedCycle(eventIds: number[]): Promise<Set<number>> {
  const evs = await eventsByIds(eventIds);
  if (evs.length === 0) return new Set();
  const cycles = await db.select({ id: cyclesTable.id, status: cyclesTable.status, endDate: cyclesTable.endDate })
    .from(cyclesTable).where(inArray(cyclesTable.id, [...new Set(evs.map(e => e.cycleId))]));
  const byId = new Map(cycles.map(c => [c.id, c]));
  return new Set(evs.filter(e => {
    const c = byId.get(e.cycleId);
    return c?.status === "closed" && !isAfterCycleEnd(e, c);
  }).map(e => e.id));
}

/** Algum destes eventos é de ciclo fechado (e está dentro do período dele)? */
export async function anyEventLockedByClosedCycle(eventIds: number[]): Promise<boolean> {
  return (await eventsLockedByClosedCycle(eventIds)).size > 0;
}

/**
 * Mudança de data em evento de ciclo fechado: recusada quando o evento está
 * travado (dentro do período) ou quando a data nova o colocaria de volta no
 * período do ciclo fechado. Devolve os ids recusados.
 */
export async function dateChangesBlockedByClosedCycle(changes: { eventId: number; newStartDate: string }[]): Promise<Set<number>> {
  const evs = await eventsByIds(changes.map(c => c.eventId));
  if (evs.length === 0) return new Set();
  const cycles = await db.select({ id: cyclesTable.id, status: cyclesTable.status, endDate: cyclesTable.endDate })
    .from(cyclesTable).where(inArray(cyclesTable.id, [...new Set(evs.map(e => e.cycleId))]));
  const cycleById = new Map(cycles.map(c => [c.id, c]));
  const evById = new Map(evs.map(e => [e.id, e]));
  const out = new Set<number>();
  for (const ch of changes) {
    const ev = evById.get(ch.eventId);
    const c = ev ? cycleById.get(ev.cycleId) : undefined;
    if (!ev || c?.status !== "closed") continue;
    if (!isAfterCycleEnd(ev, c) || !isAfterCycleEnd({ startDate: ch.newStartDate }, c)) out.add(ch.eventId);
  }
  return out;
}

async function cycleIsClosed(cycleId: number | null | undefined): Promise<boolean> {
  if (cycleId == null) return false;
  const [c] = await db.select({ status: cyclesTable.status }).from(cyclesTable).where(eq(cyclesTable.id, cycleId)).limit(1);
  return c?.status === "closed";
}

async function currentCycleClosed(): Promise<boolean> {
  return (await getCurrentCycle())?.status === "closed";
}

const WRITE = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const num = (v: unknown) => (v == null || v === "" ? NaN : Number(v));

type LockCheck = () => Promise<boolean>;

/**
 * A rota é coberta por esta trava? Devolve a checagem (que consulta o banco)
 * ou null quando a rota não é coberta. Separado em dois passos para a
 * autenticação rodar ANTES de qualquer consulta (anônimo recebe 401, B4).
 */
function lockCheckFor(method: string, path: string, body: Record<string, unknown>): LockCheck | null {
  let m: RegExpMatchArray | null;

  // /events/:id e tudo abaixo (critérios, participantes, conformidade,
  // confirmar/fechar/reabrir…), menos o mural de comentários.
  if ((m = path.match(/^\/events\/(\d+)(?:\/(.*))?$/))) {
    const sub = m[2] ?? "";
    if (/^comments(\/|$)/.test(sub)) return null;
    const ids = [Number(m[1])];
    if (sub === "merge") ids.push(num(body.mergeEventId));
    return () => anyEventLockedByClosedCycle(ids);
  }
  if (path === "/events/confirm-results-bulk" && Array.isArray(body.eventIds)) {
    const ids = (body.eventIds as unknown[]).map(num);
    return () => anyEventLockedByClosedCycle(ids);
  }

  // Avaliações: criar (eventId no corpo) e editar/enviar/reabrir/apagar (pelo id).
  if (path === "/evaluations" && method === "POST") return () => anyEventLockedByClosedCycle([num(body.eventId)]);
  if ((m = path.match(/^\/evaluations\/(\d+)(?:\/(submit|reopen))?$/))) {
    const id = Number(m[1]);
    return async () => {
      const [row] = await db.select({ eventId: evaluationsTable.eventId }).from(evaluationsTable).where(eq(evaluationsTable.id, id)).limit(1);
      return row ? anyEventLockedByClosedCycle([row.eventId]) : false;
    };
  }

  // Calibrações e comentários de calibração.
  if (path === "/calibrations" || path === "/calibrations/comments") return () => anyEventLockedByClosedCycle([num(body.eventId)]);
  if ((m = path.match(/^\/calibrations\/comments\/(\d+)$/))) {
    const id = Number(m[1]);
    return async () => {
      const [row] = await db.select({ eventId: calibrationCommentsTable.eventId }).from(calibrationCommentsTable).where(eq(calibrationCommentsTable.id, id)).limit(1);
      return row ? anyEventLockedByClosedCycle([row.eventId]) : false;
    };
  }

  // Faltas/méritos: o lançamento novo entra no ciclo ATUAL; editar/excluir
  // vale para o ciclo do lançamento. Falta ligada a evento acompanha o
  // evento: de ciclo fechado (dentro do período) → travada mesmo com o ciclo
  // atual aberto (B3); "fora do período" → liberada.
  if (path === "/absences" && method === "POST") {
    const eventId = num(body.eventId);
    return async () => {
      if (Number.isInteger(eventId) && eventId > 0) {
        const [ev] = await eventsByIds([eventId]);
        if (ev) {
          if (await anyEventLockedByClosedCycle([ev.id])) return true;
          const current = await getCurrentCycle();
          if (current?.status !== "closed") return false;
          // Ciclo atual fechado: só o evento "fora do período" dele passa.
          return !(ev.cycleId === current.id && isAfterCycleEnd(ev, current));
        }
      }
      return currentCycleClosed();
    };
  }
  if ((m = path.match(/^\/absences\/(\d+)$/))) {
    const id = Number(m[1]);
    return async () => {
      const [row] = await db.select({ cycleId: absencesTable.cycleId, eventId: absencesTable.eventId }).from(absencesTable).where(eq(absencesTable.id, id)).limit(1);
      if (!row) return false;
      if (row.eventId != null) {
        if (await anyEventLockedByClosedCycle([row.eventId])) return true;
        // O lançamento pode ter sido gravado num ciclo fechado diferente do do evento.
        const [ev] = await eventsByIds([row.eventId]);
        if (ev && ev.cycleId === row.cycleId) return false;
      }
      return cycleIsClosed(row.cycleId);
    };
  }

  // Elegibilidade e "fora do ciclo": valem para o ciclo ATUAL (M1).
  if (path === "/cycle-eligibility" && method === "POST") return currentCycleClosed;
  if (/^\/employees\/\d+\/cycle-exclusion$/.test(path)) return currentCycleClosed;
  return null;
}

/**
 * Escritas que são AVALIAÇÃO (não preparação) — recusadas em evento do
 * PRÓXIMO ciclo (lib/next-cycle.ts): avaliação (criar/editar/enviar/reabrir),
 * matriz de conformidade e geração de link público. Apagar rascunho continua
 * livre (é limpeza). Devolve a checagem ou null quando a rota não é coberta.
 * O link público (sem login) confere no próprio roteador (public-eval.ts).
 */
function nextCycleCheckFor(method: string, path: string, body: Record<string, unknown>): LockCheck | null {
  let m: RegExpMatchArray | null;
  const anyNext = async (ids: number[]) => (await eventsInNextCycle(ids)).size > 0;
  if (path === "/evaluations" && method === "POST") return () => anyNext([num(body.eventId)]);
  if ((m = path.match(/^\/evaluations\/(\d+)(?:\/(submit|reopen))?$/)) && method !== "DELETE") {
    const id = Number(m[1]);
    return async () => {
      const [row] = await db.select({ eventId: evaluationsTable.eventId }).from(evaluationsTable).where(eq(evaluationsTable.id, id)).limit(1);
      return row ? anyNext([row.eventId]) : false;
    };
  }
  if (method === "POST" && (m = path.match(/^\/events\/(\d+)\/(?:conformity|public-token(?:\/conformity(?:-ferramentas)?)?|admin-public-token)$/))) {
    const id = Number(m[1]);
    return () => anyNext([id]);
  }
  return null;
}

/**
 * Caminho como o Express o enxerga para casar a rota: decodificado (%33 → 3),
 * em minúsculas e sem barra no fim. null = endereço inválido:
 *  - URI malformada (o Express também recusaria ao decodificar o parâmetro);
 *  - id "quase numérico" nas rotas cobertas (/events/3abc, /evaluations/+3,
 *    /absences/%203…): as rotas leem o id com parseInt/Number, que aceitam
 *    esses formatos e chegariam ao registro 3 — a trava, que só reconhece
 *    dígitos, deixaria passar.
 */
export function normalizeGuardPath(rawPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  const path = decoded.toLowerCase().replace(/\/+$/, "") || "/";
  const m = path.match(/^\/(?:events|evaluations|absences|employees|calibrations\/comments)\/([^/]*)/);
  if (m && !/^\d+$/.test(m[1])) {
    const seg = m[1];
    if (!Number.isNaN(parseInt(seg, 10)) || (seg.trim() !== "" && Number.isFinite(Number(seg)))) return null;
  }
  return path;
}

/**
 * Middleware montado em routes/index.ts antes de TODOS os roteadores de
 * escrita. Leitura nunca é afetada. A autenticação vem PRIMEIRO (B4): sem
 * login válido a requisição recebe o 401 de sempre, nunca um 409 que revela
 * o estado do ciclo. Ordem das recusas: ciclo fechado (CLOSED_CYCLE) e, em
 * seguida, evento do próximo ciclo (EVENT_NEXT_CYCLE).
 */
export function closedCycleWriteGuard(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (!WRITE.has(method)) { next(); return; }
  // M1 (4ª revisão): o Express casa as rotas sem diferenciar maiúsculas e
  // decodifica os parâmetros (/EVENTS/%33/conformity chega na rota de
  // /events/3/conformity). A trava casa o MESMO caminho normalizado — senão
  // uma URL "disfarçada" escrevia em ciclo fechado.
  const path = normalizeGuardPath(req.path);
  if (path == null) { res.status(400).json({ error: "Endereço inválido." }); return; }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const check = lockCheckFor(method, path, body);
  const nextCycleCheck = nextCycleCheckFor(method, path, body);
  if (!check && !nextCycleCheck) { next(); return; }
  void requireAuth(req, res, () => {
    (async () => {
      if (check && await check()) { res.status(409).json(closedCycleBody()); return; }
      if (nextCycleCheck && await nextCycleCheck()) { res.status(409).json(nextCycleBody()); return; }
      next();
    })().catch(next);
  }).catch(next);
}
