import { Router } from "express";
import { db, rulesTable, platoonRulesTable } from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);

router.get("/rules", async (_req, res) => {
  const rules = await db.select().from(rulesTable).orderBy(rulesTable.key);
  res.json(rules);
});

router.patch("/rules/:key", requireRole("admin", "rh"), async (req, res) => {
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

type RangeRow = { id: number; minScore: number; maxScore: number; minInclusive: boolean; maxInclusive: boolean };

function validatePlatoonRanges(ranges: RangeRow[]): string | null {
  const active = [...ranges].sort((a, b) => a.minScore - b.minScore);
  if (active.length === 0) {
    return "É necessário pelo menos um intervalo de pelotão.";
  }
  const first = active[0];
  const last = active[active.length - 1];
  if (first.minScore !== 0) {
    return `Cobertura incompleta: o menor intervalo deve iniciar em 0 (atual: ${first.minScore}).`;
  }
  if (last.maxScore !== 100) {
    return `Cobertura incompleta: o maior intervalo deve terminar em 100 (atual: ${last.maxScore}).`;
  }
  for (let i = 0; i < active.length - 1; i++) {
    const curr = active[i];
    const next = active[i + 1];
    const currMax = curr.maxScore;
    const nextMin = next.minScore;
    if (currMax > nextMin) {
      return `Sobreposição de intervalos detectada: "${curr.minScore}–${curr.maxScore}" e "${next.minScore}–${next.maxScore}"`;
    }
    if (currMax < nextMin) {
      return `Lacuna entre intervalos detectada: ${curr.maxScore} → ${next.minScore}`;
    }
    const boundaryOk = curr.maxInclusive !== next.minInclusive;
    if (!boundaryOk) {
      return `Conflito de inclusão no limite ${currMax}: "${curr.minScore}–${curr.maxScore}" e "${next.minScore}–${next.maxScore}" cobrem o mesmo ponto`;
    }
  }
  return null;
}

router.post("/platoon-rules", requireRole("admin", "rh"), async (req, res) => {
  const { name, color, minScore, maxScore, minInclusive, maxInclusive, bonusValue, description, displayOrder } = req.body;
  if (!name || minScore === undefined || maxScore === undefined) {
    res.status(400).json({ error: "Campos obrigatórios: name, minScore, maxScore" });
    return;
  }
  if (parseFloat(minScore) >= parseFloat(maxScore)) {
    res.status(400).json({ error: "minScore deve ser menor que maxScore" });
    return;
  }

  const existing = await db.select().from(platoonRulesTable).where(eq(platoonRulesTable.active, true));
  const allRanges: RangeRow[] = [
    ...existing.map(r => ({
      id: r.id,
      minScore: parseFloat(r.minScore as unknown as string),
      maxScore: parseFloat(r.maxScore as unknown as string),
      minInclusive: r.minInclusive,
      maxInclusive: r.maxInclusive,
    })),
    { id: -1, minScore: parseFloat(minScore), maxScore: parseFloat(maxScore), minInclusive: minInclusive ?? true, maxInclusive: maxInclusive ?? false },
  ];
  const err = validatePlatoonRanges(allRanges);
  if (err) { res.status(400).json({ error: err }); return; }

  const [rule] = await db.insert(platoonRulesTable).values({
    name, color: color ?? "#94a3b8",
    minScore: String(minScore), maxScore: String(maxScore),
    minInclusive: minInclusive ?? true, maxInclusive: maxInclusive ?? false,
    bonusValue: String(bonusValue ?? 0),
    description: description ?? null, displayOrder: displayOrder ?? 0,
  }).returning();
  await audit(req.user!.userId, "create", "platoon_rules", rule.id, null, rule);
  res.status(201).json({ ...rule, minScore: parseFloat(rule.minScore as unknown as string), maxScore: parseFloat(rule.maxScore as unknown as string), bonusValue: parseFloat(rule.bonusValue as unknown as string) });
});

router.patch("/platoon-rules/:id", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { name, color, minScore, maxScore, minInclusive, maxInclusive, bonusValue, description, active, displayOrder } = req.body;
  const [before] = await db.select().from(platoonRulesTable).where(eq(platoonRulesTable.id, id)).limit(1);
  if (!before) { res.status(404).json({ error: "Não encontrado" }); return; }

  const newMinScore = minScore !== undefined ? parseFloat(minScore) : parseFloat(before.minScore as unknown as string);
  const newMaxScore = maxScore !== undefined ? parseFloat(maxScore) : parseFloat(before.maxScore as unknown as string);
  const newMinInclusive = minInclusive !== undefined ? minInclusive : before.minInclusive;
  const newMaxInclusive = maxInclusive !== undefined ? maxInclusive : before.maxInclusive;
  const willBeActive = active !== undefined ? active : before.active;

  if (newMinScore >= newMaxScore) {
    res.status(400).json({ error: "minScore deve ser menor que maxScore" });
    return;
  }

  if (willBeActive) {
    const otherActive = await db.select().from(platoonRulesTable)
      .where(eq(platoonRulesTable.active, true));
    const otherRanges: RangeRow[] = otherActive
      .filter(r => r.id !== id)
      .map(r => ({
        id: r.id,
        minScore: parseFloat(r.minScore as unknown as string),
        maxScore: parseFloat(r.maxScore as unknown as string),
        minInclusive: r.minInclusive,
        maxInclusive: r.maxInclusive,
      }));
    const allRanges: RangeRow[] = [
      ...otherRanges,
      { id, minScore: newMinScore, maxScore: newMaxScore, minInclusive: newMinInclusive, maxInclusive: newMaxInclusive },
    ];
    const err = validatePlatoonRanges(allRanges);
    if (err) { res.status(400).json({ error: err }); return; }
  }

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

router.delete("/platoon-rules/:id", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(platoonRulesTable).where(eq(platoonRulesTable.id, id));
  await audit(req.user!.userId, "delete", "platoon_rules", id);
  res.status(204).end();
});

export default router;
