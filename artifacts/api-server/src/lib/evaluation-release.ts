import { db, eventsTable, eventCriteriaTable, criteriaTable, cyclesTable } from "@workspace/db";
import { and, eq, inArray, lt, lte, sql } from "drizzle-orm";
import { audit } from "./audit.js";
import { freezeEventCriteriaWeights } from "../routes/evaluations.js";
import { generateCriterionAssignments } from "../routes/routing.js";
import { todayBR } from "./evaluation-dates.js";
import { logger } from "./logger.js";
export { todayBR, evaluationOpensOn, isOpenForEvaluation, opensLabel } from "./evaluation-dates.js";

/**
 * Liberação da avaliação (regra do dono, 05/10/2026): o evento fica disponível
 * para os avaliadores SOZINHO, a partir do DIA SEGUINTE ao fim do evento
 * (meia-noite em Brasília) — sem depender do "Confirmar critérios" do RH.
 * Antes, o evento só aparecia depois do clique do RH, e se o RH confirmasse
 * cedo dava para avaliar antes de o evento acontecer.
 */

/**
 * Faz, para os eventos cuja avaliação já abriu e que o RH ainda não
 * confirmou, a MESMA confirmação do botão "Confirmar critérios": congela os
 * pesos, marca como confirmado e gera as atribuições padrão. Idempotente e
 * segura contra corrida (o UPDATE só vale para quem ainda está false).
 * Eventos sem critério ativo de peso positivo ficam para o RH (não dá para
 * confirmar). Devolve os ids liberados.
 *
 * Robustez (M5): cada evento é liberado no seu próprio try/catch — um evento
 * com erro é registrado no log e a varredura segue para os demais. Ciclo
 * FECHADO (status closed) nunca tem evento liberado sozinho.
 */
export async function autoReleaseDueEvents(opts: { eventIds?: number[] } = {}): Promise<number[]> {
  const today = todayBR();
  // Só o ciclo ATUAL: evento de ciclo anterior nunca é liberado sozinho.
  const [current] = await db.select({ id: cyclesTable.id, status: cyclesTable.status, endDate: cyclesTable.endDate }).from(cyclesTable).where(eq(cyclesTable.isCurrent, true)).limit(1);
  if (!current || current.status === "closed") return [];
  const conds = [
    eq(eventsTable.cycleId, current.id),
    // Evento "fora do período" (começa depois do fim do ciclo) é do PRÓXIMO
    // ciclo: não é liberado sozinho — só depois de movido para o ciclo novo
    // (lib/next-cycle.ts).
    ...(current.endDate ? [lte(eventsTable.startDate, current.endDate)] : []),
    eq(eventsTable.criteriaConfirmed, false),
    eq(eventsTable.isHistorical, false),
    inArray(eventsTable.status, ["open", "closed"]),
    // fim do evento ANTES de hoje (Brasília) = hoje é o dia seguinte ou depois
    lt(sql`coalesce(${eventsTable.endDate}, ${eventsTable.startDate})`, today),
  ];
  if (opts.eventIds) {
    if (opts.eventIds.length === 0) return [];
    conds.push(inArray(eventsTable.id, opts.eventIds));
  }
  const due = await db.select({ id: eventsTable.id }).from(eventsTable).where(and(...conds));
  const released: number[] = [];
  for (const { id } of due) {
    try {
      if (await releaseOne(id)) {
        released.push(id);
        await audit(null, "auto_confirm_criteria", "events", id, null, { reason: "dia seguinte ao evento", opensOn: today });
      }
    } catch (err) {
      // Um evento com problema não pode impedir a liberação dos outros.
      logger.error({ err, eventId: id }, "Liberação automática da avaliação falhou para o evento; segue para os demais");
    }
  }
  return released;
}

async function releaseOne(id: number): Promise<boolean> {
  const weights = await db.select({ active: eventCriteriaTable.active, w: sql<string>`coalesce(${eventCriteriaTable.weightOverride}, ${criteriaTable.defaultWeight}, '1')` })
    .from(eventCriteriaTable).leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
    .where(eq(eventCriteriaTable.eventId, id));
  if (weights.filter(r => r.active).reduce((s, r) => s + parseFloat(r.w), 0) <= 0) return false;
  return db.transaction(async (tx) => {
    const [upd] = await tx.update(eventsTable)
      .set({ criteriaConfirmed: true, criteriaConfirmedAt: new Date() })
      .where(and(eq(eventsTable.id, id), eq(eventsTable.criteriaConfirmed, false)))
      .returning({ id: eventsTable.id });
    if (!upd) return false;
    await freezeEventCriteriaWeights(id, tx);
    await generateCriterionAssignments(id, tx);
    return true;
  });
}

/**
 * Para as rotas de leitura (lista do avaliador, rascunho): a liberação nunca
 * derruba a requisição — erro vira log e a resposta segue com o que já está
 * liberado.
 */
export async function autoReleaseSafely(opts: { eventIds?: number[] } = {}): Promise<number[]> {
  try {
    return await autoReleaseDueEvents(opts);
  } catch (err) {
    logger.error({ err, eventIds: opts.eventIds }, "Liberação automática da avaliação falhou; a requisição segue");
    return [];
  }
}

// A tela do avaliador consulta a lista a cada filtro/foco; varrer o ciclo
// inteiro a cada chamada é desperdício. No máximo uma varredura por minuto
// por instância (chamadas simultâneas aguardam a mesma). O evento aberto pela
// URL é liberado na hora pela chamada direcionada (opts.eventIds), sem memo.
const THROTTLE_MS = 60_000;
let lastSweepAt = 0;
let sweepInFlight: Promise<number[]> | null = null;
export function autoReleaseDueEventsThrottled(): Promise<number[]> {
  if (sweepInFlight) return sweepInFlight;
  if (Date.now() - lastSweepAt < THROTTLE_MS) return Promise.resolve([]);
  lastSweepAt = Date.now();
  // Nunca rejeita: erro vira log (quem chama é rota de leitura — nada de 500).
  sweepInFlight = autoReleaseDueEvents()
    .catch((err) => {
      lastSweepAt = 0;
      logger.error({ err }, "Varredura da liberação automática falhou; a requisição segue");
      return [] as number[];
    })
    .finally(() => { sweepInFlight = null; });
  return sweepInFlight;
}
