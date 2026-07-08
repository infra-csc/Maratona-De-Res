import { Router } from "express";
import { db, criteriaTable, areasTable, eventCriteriaTable, eventsTable } from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);

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
    })
    .from(criteriaTable)
    .leftJoin(areasTable, eq(criteriaTable.responsibleAreaId, areasTable.id))
    .where(eq(criteriaTable.eventScoped, false))
    .orderBy(criteriaTable.displayOrder, criteriaTable.name);
  res.json(criteria.map(c => ({ ...c, defaultWeight: parseFloat(c.defaultWeight as unknown as string) })));
});

router.post("/criteria", requireRole("admin", "rh"), async (req, res) => {
  const { name, description, responsibleAreaId, defaultWeight, displayOrder } = req.body;
  if (!name) { res.status(400).json({ error: "Nome obrigatório" }); return; }
  const [criterion] = await db.insert(criteriaTable).values({
    name,
    description: description ?? null,
    responsibleAreaId: responsibleAreaId ?? null,
    defaultWeight: String(defaultWeight ?? 1),
    displayOrder: displayOrder ?? 0,
  }).returning();
  await audit(req.user!.userId, "create", "criteria", criterion.id, null, criterion);
  res.status(201).json(criterion);
});

router.patch("/criteria/:id", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { name, description, responsibleAreaId, defaultWeight, active, displayOrder } = req.body;
  const [before] = await db.select().from(criteriaTable).where(eq(criteriaTable.id, id)).limit(1);
  if (!before) { res.status(404).json({ error: "Não encontrado" }); return; }

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

  const [criterion] = await db.update(criteriaTable).set({
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description }),
    ...(responsibleAreaId !== undefined && { responsibleAreaId }),
    ...(newAreaLabel !== undefined && { responsibleAreaLabel: newAreaLabel }),
    ...(defaultWeight !== undefined && { defaultWeight: String(defaultWeight) }),
    ...(active !== undefined && { active }),
    ...(displayOrder !== undefined && { displayOrder }),
  }).where(eq(criteriaTable.id, id)).returning();

  // Se um critério global for desativado, ele não deve continuar aparecendo
  // como pendente de peso/avaliador em eventos que ainda não travaram os
  // critérios (RH ainda não confirmou). Eventos já confirmados/avaliados
  // mantêm o snapshot histórico intacto.
  if (active === false && before.active !== false) {
    const openEvents = await db
      .select({ id: eventsTable.id })
      .from(eventsTable)
      .where(eq(eventsTable.criteriaConfirmed, false));
    const openEventIds = openEvents.map(e => e.id);
    if (openEventIds.length > 0) {
      await db.update(eventCriteriaTable)
        .set({ active: false })
        .where(and(
          eq(eventCriteriaTable.criterionId, id),
          inArray(eventCriteriaTable.eventId, openEventIds),
        ));
    }
  }

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
  const count = (updated as unknown as { rowCount: number }).rowCount ?? 0;
  await audit(req.user!.userId, "sync_area_labels", "criteria", undefined, { updated: count }, undefined);
  res.json({ updated: count });
});

export default router;
