import { Router } from "express";
import { requireAuth, requireRole } from "../lib/auth.js";
import { getCurrentCycle } from "../lib/cycle.js";
import { db, cyclesTable } from "@workspace/db";
import { audit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);

// Ciclo atual (período de referência). Usado em qualquer tela que mostra
// informação do ciclo, para exibir as datas que o ciclo está considerando.
router.get("/cycles/current", async (_req, res) => {
  const cycle = await getCurrentCycle();
  if (!cycle) { res.status(404).json({ error: "Nenhum ciclo ativo" }); return; }
  res.json({
    id: cycle.id,
    name: cycle.name,
    startDate: cycle.startDate,
    endDate: cycle.endDate,
    status: cycle.status,
    isCurrent: cycle.isCurrent,
  });
});

// Cria um novo ciclo e o marca como atual (só existe um ciclo corrente por vez).
// Necessário principalmente após um reset de dados, quando a tabela cycles
// fica vazia e não há mais como criar eventos sem um ciclo ativo.
router.post("/cycles", requireRole("admin"), async (req, res) => {
  const { name, startDate, endDate } = req.body ?? {};
  if (!name || !startDate || !endDate) {
    res.status(400).json({ error: "Campos obrigatórios: name, startDate, endDate" });
    return;
  }
  if (String(startDate) > String(endDate)) {
    res.status(400).json({ error: "A data de início deve ser anterior ou igual à data de término" });
    return;
  }

  const cycle = await db.transaction(async (tx) => {
    await tx.update(cyclesTable).set({ isCurrent: false });
    const [created] = await tx.insert(cyclesTable).values({
      name, startDate, endDate, status: "open", isCurrent: true,
    }).returning();
    return created;
  });

  await audit(req.user!.userId, "create", "cycles", cycle.id, null, cycle);
  res.status(201).json({
    id: cycle.id,
    name: cycle.name,
    startDate: cycle.startDate,
    endDate: cycle.endDate,
    status: cycle.status,
    isCurrent: cycle.isCurrent,
  });
});

export default router;
