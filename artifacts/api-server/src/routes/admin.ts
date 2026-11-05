/**
 * Endpoints administrativos de uso pontual (admin only).
 * Operações que precisam de acesso de escrita direto ao banco,
 * contornando a réplica read-only usada pelo agent para consultas de produção.
 */
import { Router } from "express";
import { db, eventCriteriaTable } from "@workspace/db";
import { and, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import { getCurrentCycle } from "../lib/cycle.js";
import { recomputeCycleResults } from "./results.js";

const router = Router();
router.use(requireAuth);

/**
 * POST /admin/event-criteria/bulk-update
 *
 * Atualiza active e/ou weight_override para um conjunto de event_criteria
 * identificados por (eventIds × criterionIds). Após cada operação,
 * recomputa o ciclo corrente para propagar os novos pesos.
 *
 * Body: array de operações:
 * [
 *   { "eventIds": [132, 133], "criterionIds": [19, 25], "active": true, "weightOverride": "3" },
 *   { "eventIds": [132],      "criterionIds": [17],     "active": true, "weightOverride": "0" }
 * ]
 *
 * Cada operação pode omitir active ou weightOverride para não alterar aquele campo.
 */
router.post(
  "/admin/event-criteria/bulk-update",
  requireRole("admin"),
  async (req, res) => {
    const ops = req.body as Array<{
      eventIds: number[];
      criterionIds: number[];
      active?: boolean;
      weightOverride?: string | null;
    }>;

    if (!Array.isArray(ops) || ops.length === 0) {
      res.status(400).json({ error: "Body deve ser array de operações" });
      return;
    }

    const summary: Array<{
      eventIds: number[];
      criterionIds: number[];
      rowsAffected: number;
    }> = [];

    for (const op of ops) {
      if (!Array.isArray(op.eventIds) || !Array.isArray(op.criterionIds)) {
        res.status(400).json({ error: "Cada operação precisa de eventIds e criterionIds" });
        return;
      }

      const patch: Partial<{ active: boolean; weightOverride: string | null }> = {};
      if (op.active !== undefined) patch.active = op.active;
      if (op.weightOverride !== undefined) patch.weightOverride = op.weightOverride;

      if (Object.keys(patch).length === 0) {
        summary.push({ eventIds: op.eventIds, criterionIds: op.criterionIds, rowsAffected: 0 });
        continue;
      }

      const result = await db
        .update(eventCriteriaTable)
        .set(patch)
        .where(
          and(
            inArray(eventCriteriaTable.eventId, op.eventIds),
            inArray(eventCriteriaTable.criterionId, op.criterionIds),
          ),
        )
        .returning({ id: eventCriteriaTable.id });

      summary.push({
        eventIds: op.eventIds,
        criterionIds: op.criterionIds,
        rowsAffected: result.length,
      });
    }

    // Recomputa ciclo corrente para propagar novos pesos
    const cycle = await getCurrentCycle();
    let recomputed = false;
    if (cycle) {
      await recomputeCycleResults(cycle.id, req.user!.userId);
      recomputed = true;
    }

    await audit(
      req.user!.userId,
      "bulk-update",
      "event_criteria",
      undefined,
      undefined,
      { ops: summary, recomputed, cycleId: cycle?.id },
    );

    // Confirmação: devolve o estado atual das linhas afetadas
    const allEventIds = ops.flatMap(o => o.eventIds);
    const allCriterionIds = ops.flatMap(o => o.criterionIds);
    const confirmation = await db
      .select({
        eventId: eventCriteriaTable.eventId,
        criterionId: eventCriteriaTable.criterionId,
        active: eventCriteriaTable.active,
        weightOverride: eventCriteriaTable.weightOverride,
      })
      .from(eventCriteriaTable)
      .where(
        and(
          inArray(eventCriteriaTable.eventId, [...new Set(allEventIds)]),
          inArray(eventCriteriaTable.criterionId, [...new Set(allCriterionIds)]),
        ),
      )
      .orderBy(eventCriteriaTable.eventId, eventCriteriaTable.criterionId);

    res.json({ summary, recomputed, cycleId: cycle?.id ?? null, confirmation });
  },
);

export default router;
