import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { getCurrentCycle } from "../lib/cycle.js";

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

export default router;
