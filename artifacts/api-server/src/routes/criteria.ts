import { Router } from "express";
import { db, criteriaTable, areasTable, eventCriteriaTable, eventsTable, criterionEvaluatingAreasTable } from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import { pgNum, affectedRows } from "../lib/pg-num.js";

const router = Router();
router.use(requireAuth);

/**
 * "Áreas que avaliam" (padrão do catálogo): `evaluateAllAreas` = todas as
 * áreas ativas; senão `evaluatingAreaIds` = áreas ALÉM da responsável.
 * Valida e normaliza o que veio no corpo; undefined = não mexer.
 */
function parseAreasInput(body: Record<string, unknown>): { all?: boolean; ids?: number[]; error?: string } {
  const out: { all?: boolean; ids?: number[]; error?: string } = {};
  if (body.evaluateAllAreas !== undefined) {
    if (typeof body.evaluateAllAreas !== "boolean") return { error: "evaluateAllAreas deve ser verdadeiro ou falso" };
    out.all = body.evaluateAllAreas;
  }
  if (body.evaluatingAreaIds !== undefined) {
    const raw = body.evaluatingAreaIds;
    if (!Array.isArray(raw) || raw.some(a => !Number.isInteger(Number(a)) || Number(a) <= 0)) return { error: "evaluatingAreaIds deve ser uma lista de áreas" };
    out.ids = [...new Set(raw.map(Number))];
  }
  return out;
}

async function saveEvaluatingAreas(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], criterionId: number, responsibleAreaId: number | null, ids: number[]) {
  await tx.delete(criterionEvaluatingAreasTable).where(eq(criterionEvaluatingAreasTable.criterionId, criterionId));
  const extra = ids.filter(a => a !== responsibleAreaId);
  if (extra.length > 0) await tx.insert(criterionEvaluatingAreasTable).values(extra.map(areaId => ({ criterionId, areaId })));
}

router.get("/criteria", async (_req, res) => {
  const criteria = await db
    .select({
      id: criteriaTable.id,
      name: criteriaTable.name,
      description: criteriaTable.description,
      responsibleAreaId: criteriaTable.responsibleAreaId,
      responsibleAreaName: areasTable.name,
      defaultWeight: criteriaTable.defaultWeight,
      active: criteriaTable.active,
      displayOrder: criteriaTable.displayOrder,
      evaluateAllAreas: criteriaTable.evaluateAllAreas,
      eventCount: sql<number>`(SELECT COUNT(DISTINCT ec.event_id) FROM event_criteria ec WHERE ec.criterion_id = ${criteriaTable.id} AND ec.active = true)`,
    })
    .from(criteriaTable)
    .leftJoin(areasTable, eq(criteriaTable.responsibleAreaId, areasTable.id))
    .where(eq(criteriaTable.eventScoped, false))
    .orderBy(criteriaTable.displayOrder, criteriaTable.name);
  const extra = await db.select({ criterionId: criterionEvaluatingAreasTable.criterionId, areaId: criterionEvaluatingAreasTable.areaId })
    .from(criterionEvaluatingAreasTable);
  const extraByCriterion = new Map<number, number[]>();
  for (const e of extra) extraByCriterion.set(e.criterionId, [...(extraByCriterion.get(e.criterionId) ?? []), e.areaId]);
  res.json(criteria.map(c => ({
    ...c, defaultWeight: pgNum(c.defaultWeight), eventCount: Number(c.eventCount),
    evaluatingAreaIds: (extraByCriterion.get(c.id) ?? []).sort((a, b) => a - b),
  })));
});

router.post("/criteria", requireRole("admin", "rh"), async (req, res) => {
  const { name, description, responsibleAreaId, defaultWeight, displayOrder } = req.body;
  if (!name) { res.status(400).json({ error: "Nome obrigatório" }); return; }
  const areas = parseAreasInput(req.body ?? {});
  if (areas.error) { res.status(400).json({ error: areas.error }); return; }
  const criterion = await db.transaction(async (tx) => {
    const [created] = await tx.insert(criteriaTable).values({
      name,
      description: description ?? null,
      responsibleAreaId: responsibleAreaId ?? null,
      defaultWeight: String(defaultWeight ?? 1),
      displayOrder: displayOrder ?? 0,
      evaluateAllAreas: areas.all ?? false,
    }).returning();
    if (areas.ids) await saveEvaluatingAreas(tx, created.id, created.responsibleAreaId, areas.ids);
    return created;
  });
  await audit(req.user!.userId, "create", "criteria", criterion.id, null, criterion);
  res.status(201).json(criterion);
});

router.patch("/criteria/:id", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { name, description, responsibleAreaId, defaultWeight, active, displayOrder } = req.body;
  const [before] = await db.select().from(criteriaTable).where(eq(criteriaTable.id, id)).limit(1);
  if (!before) { res.status(404).json({ error: "Não encontrado" }); return; }
  const areas = parseAreasInput(req.body ?? {});
  if (areas.error) { res.status(400).json({ error: areas.error }); return; }

  // Quando a área é alterada, sincroniza responsibleAreaLabel automaticamente.
  let newAreaLabel: string | null | undefined;
  if (responsibleAreaId !== undefined) {
    if (responsibleAreaId == null) {
      newAreaLabel = null;
    } else {
      const [area] = await db.select({ name: areasTable.name }).from(areasTable).where(eq(areasTable.id, responsibleAreaId)).limit(1);
      newAreaLabel = area?.name ?? null;
    }
  }

  // Critério e vínculos dos eventos abertos na mesma transação: se a
  // desativação nos eventos falhar, o catálogo não fica desativado sozinho.
  const criterion = await db.transaction(async (tx) => {
    const patch = {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(responsibleAreaId !== undefined && { responsibleAreaId }),
      ...(newAreaLabel !== undefined && { responsibleAreaLabel: newAreaLabel }),
      ...(defaultWeight !== undefined && { defaultWeight: String(defaultWeight) }),
      ...(active !== undefined && { active }),
      ...(displayOrder !== undefined && { displayOrder }),
      ...(areas.all !== undefined && { evaluateAllAreas: areas.all }),
    };
    // Só as áreas mudaram: nada a gravar em criteria (set({}) é erro no Drizzle).
    const [updatedCriterion] = Object.keys(patch).length > 0
      ? await tx.update(criteriaTable).set(patch).where(eq(criteriaTable.id, id)).returning()
      : await tx.select().from(criteriaTable).where(eq(criteriaTable.id, id)).limit(1);
    // O padrão vale para eventos NOVOS (e para o botão "Aplicar áreas do padrão"
    // no evento); eventos já montados não mudam sozinhos.
    if (areas.ids) await saveEvaluatingAreas(tx, id, updatedCriterion.responsibleAreaId, areas.ids);

    // Se um critério global for desativado, ele não deve continuar aparecendo
    // como pendente de peso/avaliador em eventos que ainda não travaram os
    // critérios (RH ainda não confirmou). Eventos já confirmados/avaliados
    // mantêm o snapshot histórico intacto.
    if (active === false && before.active !== false) {
      const openEvents = await tx
        .select({ id: eventsTable.id })
        .from(eventsTable)
        .where(eq(eventsTable.criteriaConfirmed, false));
      const openEventIds = openEvents.map(e => e.id);
      if (openEventIds.length > 0) {
        await tx.update(eventCriteriaTable)
          .set({ active: false })
          .where(and(
            eq(eventCriteriaTable.criterionId, id),
            inArray(eventCriteriaTable.eventId, openEventIds),
          ));
      }
    }

    return updatedCriterion;
  });

  await audit(req.user!.userId, "update", "criteria", id, before, criterion);
  res.json(criterion);
});

// Admin: sincroniza responsibleAreaLabel de todos os critérios com o nome
// real da área vinculada. Idempotente — só atualiza linhas divergentes.
router.post("/criteria/admin/sync-area-labels", requireRole("admin"), async (req, res) => {
  const updated = await db.execute(sql`
    UPDATE criteria
    SET    responsible_area_label = areas.name
    FROM   areas
    WHERE  criteria.responsible_area_id = areas.id
      AND  (criteria.responsible_area_label IS DISTINCT FROM areas.name)
  `);
  const count = affectedRows(updated);
  await audit(req.user!.userId, "sync_area_labels", "criteria", undefined, { updated: count }, undefined);
  res.json({ updated: count });
});

export default router;
