import { Router } from "express";
import { db, rulesTable, platoonRulesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);

router.get("/rules", async (_req, res) => {
  const rules = await db.select().from(rulesTable).orderBy(rulesTable.key);
  res.json(rules);
});

router.patch("/rules/:key", requireRole("admin"), async (req, res) => {
  const key = req.params.key as string;
  const { value } = req.body;
  if (value === undefined) { res.status(400).json({ error: "value obrigatório" }); return; }
  const [before] = await db.select().from(rulesTable).where(eq(rulesTable.key, key)).limit(1);
  if (!before) { res.status(404).json({ error: "Regra não encontrada" }); return; }
  const [rule] = await db.update(rulesTable).set({ value, updatedAt: new Date() }).where(eq(rulesTable.key, key)).returning();
  await audit(req.user!.userId, "update", "rules", key, before, rule);
  res.json(rule);
});

router.get("/platoon-rules", async (_req, res) => {
  const rules = await db.select().from(platoonRulesTable).orderBy(platoonRulesTable.displayOrder);
  res.json(rules.map(r => ({
    ...r,
    minScore: parseFloat(r.minScore as unknown as string),
    maxScore: parseFloat(r.maxScore as unknown as string),
    bonusValue: parseFloat(r.bonusValue as unknown as string),
  })));
});

router.post("/platoon-rules", requireRole("admin"), async (req, res) => {
  const { name, color, minScore, maxScore, minInclusive, maxInclusive, bonusValue, description, displayOrder } = req.body;
  if (!name || minScore === undefined || maxScore === undefined) {
    res.status(400).json({ error: "Campos obrigatórios: name, minScore, maxScore" });
    return;
  }
  const [rule] = await db.insert(platoonRulesTable).values({
    name, color: color ?? "#gray",
    minScore: String(minScore), maxScore: String(maxScore),
    minInclusive: minInclusive ?? true, maxInclusive: maxInclusive ?? false,
    bonusValue: String(bonusValue ?? 0),
    description: description ?? null, displayOrder: displayOrder ?? 0,
  }).returning();
  await audit(req.user!.userId, "create", "platoon_rules", rule.id, null, rule);
  res.status(201).json({ ...rule, minScore: parseFloat(rule.minScore as unknown as string), maxScore: parseFloat(rule.maxScore as unknown as string), bonusValue: parseFloat(rule.bonusValue as unknown as string) });
});

router.patch("/platoon-rules/:id", requireRole("admin"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { name, color, minScore, maxScore, minInclusive, maxInclusive, bonusValue, description, active, displayOrder } = req.body;
  const [before] = await db.select().from(platoonRulesTable).where(eq(platoonRulesTable.id, id)).limit(1);
  if (!before) { res.status(404).json({ error: "Não encontrado" }); return; }
  const [rule] = await db.update(platoonRulesTable).set({
    ...(name !== undefined && { name }),
    ...(color !== undefined && { color }),
    ...(minScore !== undefined && { minScore: String(minScore) }),
    ...(maxScore !== undefined && { maxScore: String(maxScore) }),
    ...(minInclusive !== undefined && { minInclusive }),
    ...(maxInclusive !== undefined && { maxInclusive }),
    ...(bonusValue !== undefined && { bonusValue: String(bonusValue) }),
    ...(description !== undefined && { description }),
    ...(active !== undefined && { active }),
    ...(displayOrder !== undefined && { displayOrder }),
  }).where(eq(platoonRulesTable.id, id)).returning();
  await audit(req.user!.userId, "update", "platoon_rules", id, before, rule);
  res.json({ ...rule, minScore: parseFloat(rule.minScore as unknown as string), maxScore: parseFloat(rule.maxScore as unknown as string), bonusValue: parseFloat(rule.bonusValue as unknown as string) });
});

router.delete("/platoon-rules/:id", requireRole("admin"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(platoonRulesTable).where(eq(platoonRulesTable.id, id));
  await audit(req.user!.userId, "delete", "platoon_rules", id);
  res.status(204).end();
});

export default router;
