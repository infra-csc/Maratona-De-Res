import { Router } from "express";
import { randomUUID } from "crypto";
import {
  db,
  criterionRoutingTable, criterionRedirectUsersTable,
  eventCriterionAssignmentsTable, criteriaTable, usersTable,
  areasTable, eventsTable, eventCriteriaTable, publicEvalTokensTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);

// ---------------------------------------------------------------------------
// GET /criterion-routing
// Retorna o roteamento de todos os critérios (admin/rh).
// ---------------------------------------------------------------------------
router.get("/criterion-routing", requireRole("admin", "rh"), async (_req, res) => {
  const routings = await db.select({
    criterionId: criterionRoutingTable.criterionId,
    defaultEvaluatorId: criterionRoutingTable.defaultEvaluatorId,
    defaultEvaluatorName: usersTable.name,
    commentRequired: criterionRoutingTable.commentRequired,
    redirectMode: criterionRoutingTable.redirectMode,
    redirectAreaId: criterionRoutingTable.redirectAreaId,
    redirectAreaName: areasTable.name,
    allowPublicLink: criterionRoutingTable.allowPublicLink,
  })
    .from(criterionRoutingTable)
    .leftJoin(usersTable, eq(criterionRoutingTable.defaultEvaluatorId, usersTable.id))
    .leftJoin(areasTable, eq(criterionRoutingTable.redirectAreaId, areasTable.id));

  res.json(routings);
});

// ---------------------------------------------------------------------------
// GET /criteria/:id/routing
// Retorna roteamento de um critério específico.
// ---------------------------------------------------------------------------
router.get("/criteria/:id/routing", requireRole("admin", "rh"), async (req, res) => {
  const criterionId = parseInt(req.params.id as string);

  const [routing] = await db.select({
    id: criterionRoutingTable.id,
    criterionId: criterionRoutingTable.criterionId,
    defaultEvaluatorId: criterionRoutingTable.defaultEvaluatorId,
    defaultEvaluatorName: usersTable.name,
    commentRequired: criterionRoutingTable.commentRequired,
    redirectMode: criterionRoutingTable.redirectMode,
    redirectAreaId: criterionRoutingTable.redirectAreaId,
    redirectAreaName: areasTable.name,
    allowPublicLink: criterionRoutingTable.allowPublicLink,
  })
    .from(criterionRoutingTable)
    .leftJoin(usersTable, eq(criterionRoutingTable.defaultEvaluatorId, usersTable.id))
    .leftJoin(areasTable, eq(criterionRoutingTable.redirectAreaId, areasTable.id))
    .where(eq(criterionRoutingTable.criterionId, criterionId))
    .limit(1);

  if (!routing) { res.json(null); return; }

  let redirectUsers: { id: number; name: string }[] = [];
  if (routing.redirectMode === "specific") {
    redirectUsers = await db.select({ id: usersTable.id, name: usersTable.name })
      .from(criterionRedirectUsersTable)
      .innerJoin(usersTable, eq(criterionRedirectUsersTable.userId, usersTable.id))
      .where(eq(criterionRedirectUsersTable.criterionId, criterionId))
      .orderBy(usersTable.name);
  }

  res.json({ ...routing, redirectUsers });
});

// ---------------------------------------------------------------------------
// PUT /criteria/:id/routing
// Cria ou atualiza o roteamento de um critério.
// Body: { defaultEvaluatorId, commentRequired, redirectMode, redirectAreaId,
//         allowPublicLink, redirectUserIds? }
// ---------------------------------------------------------------------------
router.put("/criteria/:id/routing", requireRole("admin", "rh"), async (req, res) => {
  const criterionId = parseInt(req.params.id as string);
  const { defaultEvaluatorId, commentRequired, redirectMode, redirectAreaId, allowPublicLink, redirectUserIds } = req.body;

  const [existing] = await db.select().from(criterionRoutingTable)
    .where(eq(criterionRoutingTable.criterionId, criterionId)).limit(1);

  const values = {
    defaultEvaluatorId: defaultEvaluatorId ?? null,
    commentRequired: commentRequired !== false,
    redirectMode: redirectMode ?? "area",
    redirectAreaId: redirectAreaId ?? null,
    allowPublicLink: allowPublicLink ?? false,
    updatedAt: new Date(),
  };

  let routing;
  if (existing) {
    [routing] = await db.update(criterionRoutingTable).set(values)
      .where(eq(criterionRoutingTable.id, existing.id)).returning();
  } else {
    [routing] = await db.insert(criterionRoutingTable).values({ criterionId, ...values }).returning();
  }

  if (redirectMode === "specific" && Array.isArray(redirectUserIds)) {
    await db.delete(criterionRedirectUsersTable)
      .where(eq(criterionRedirectUsersTable.criterionId, criterionId));
    if (redirectUserIds.length > 0) {
      await db.insert(criterionRedirectUsersTable).values(
        redirectUserIds.map((userId: number) => ({ criterionId, userId })),
      );
    }
  }

  await audit(req.user!.userId, "upsert", "criterion_routing", criterionId, existing ?? null, routing);
  res.json(routing);
});

// ---------------------------------------------------------------------------
// GET /events/:id/criterion-assignments
// Lista as atribuições por critério do evento.
// Admin/RH/Diretoria: tudo. Avaliador: só as próprias.
// ---------------------------------------------------------------------------
router.get("/events/:id/criterion-assignments", async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const user = req.user!;

  const allAssigned = await db.select({
    id: eventCriterionAssignmentsTable.id,
    eventId: eventCriterionAssignmentsTable.eventId,
    criterionId: eventCriterionAssignmentsTable.criterionId,
    criterionName: criteriaTable.name,
    assignedToId: eventCriterionAssignmentsTable.assignedToId,
    assignedToName: usersTable.name,
    status: eventCriterionAssignmentsTable.status,
    redirectedFromId: eventCriterionAssignmentsTable.redirectedFromId,
    confirmedAt: eventCriterionAssignmentsTable.confirmedAt,
    updatedAt: eventCriterionAssignmentsTable.updatedAt,
    createdAt: eventCriterionAssignmentsTable.createdAt,
  })
    .from(eventCriterionAssignmentsTable)
    .leftJoin(criteriaTable, eq(eventCriterionAssignmentsTable.criterionId, criteriaTable.id))
    .leftJoin(usersTable, eq(eventCriterionAssignmentsTable.assignedToId, usersTable.id))
    .where(eq(eventCriterionAssignmentsTable.eventId, eventId))
    .orderBy(criteriaTable.name);

  // Enrich with redirectedFromName via a second look-up (alias not available in this drizzle version)
  const redirectFromIds = [...new Set(allAssigned.map(a => a.redirectedFromId).filter((id): id is number => id != null))];
  const redirectFromUsers = redirectFromIds.length > 0
    ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, redirectFromIds))
    : [];
  const redirectFromMap = new Map(redirectFromUsers.map(u => [u.id, u.name]));

  const enriched = allAssigned.map(a => ({
    ...a,
    redirectedFromName: a.redirectedFromId != null ? (redirectFromMap.get(a.redirectedFromId) ?? null) : null,
  }));

  if (user.role === "avaliador") {
    res.json(enriched.filter(a => a.assignedToId === user.userId));
    return;
  }

  res.json(enriched);
});

// ---------------------------------------------------------------------------
// POST /events/:id/criterion-assignments/generate
// Gera atribuições "suggested" para todos os critérios ativos do evento
// com base no criterion_routing. Pula critérios que já têm atribuição.
// ---------------------------------------------------------------------------
router.post("/events/:id/criterion-assignments/generate", requireRole("admin", "rh"), async (req, res) => {
  const eventId = parseInt(req.params.id as string);

  const eventCriteria = await db.select({ criterionId: eventCriteriaTable.criterionId })
    .from(eventCriteriaTable)
    .where(and(eq(eventCriteriaTable.eventId, eventId), eq(eventCriteriaTable.active, true)));

  if (eventCriteria.length === 0) {
    res.json({ generated: 0, skipped: 0 });
    return;
  }

  const criterionIds = eventCriteria.map(ec => ec.criterionId);

  const routings = await db.select()
    .from(criterionRoutingTable)
    .where(inArray(criterionRoutingTable.criterionId, criterionIds));
  const routingMap = new Map(routings.map(r => [r.criterionId, r]));

  const existing = await db.select({ criterionId: eventCriterionAssignmentsTable.criterionId })
    .from(eventCriterionAssignmentsTable)
    .where(eq(eventCriterionAssignmentsTable.eventId, eventId));
  const existingSet = new Set(existing.map(e => e.criterionId));

  let generated = 0; let skipped = 0;
  for (const { criterionId } of eventCriteria) {
    if (existingSet.has(criterionId)) { skipped++; continue; }
    const r = routingMap.get(criterionId);
    await db.insert(eventCriterionAssignmentsTable).values({
      eventId,
      criterionId,
      assignedToId: r?.defaultEvaluatorId ?? null,
      status: r?.defaultEvaluatorId ? "suggested" : "pending",
    });
    generated++;
  }

  res.json({ generated, skipped });
});

// ---------------------------------------------------------------------------
// PATCH /events/:id/criterion-assignments/:criterionId
// RH: confirma/reatribui. Avaliador: redireciona para outro usuário.
// Body: { assignedToId?, action?: 'confirm' | 'redirect' }
// ---------------------------------------------------------------------------
router.patch("/events/:id/criterion-assignments/:criterionId", async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const criterionId = parseInt(req.params.criterionId as string);
  const user = req.user!;
  const { assignedToId, action } = req.body;

  const [assignment] = await db.select().from(eventCriterionAssignmentsTable)
    .where(and(eq(eventCriterionAssignmentsTable.eventId, eventId), eq(eventCriterionAssignmentsTable.criterionId, criterionId)))
    .limit(1);
  if (!assignment) { res.status(404).json({ error: "Atribuição não encontrada" }); return; }

  // --- REDIRECIONAMENTO (avaliador atual passa para outro) ---
  if (action === "redirect") {
    const isCurrentAssignee = assignment.assignedToId === user.userId;
    const isManager = ["admin", "rh"].includes(user.role);
    if (!isCurrentAssignee && !isManager) {
      res.status(403).json({ error: "Sem permissão para redirecionar esta avaliação" });
      return;
    }
    if (assignment.status === "submitted") {
      res.status(400).json({ error: "Avaliação já submetida, não pode ser redirecionada" });
      return;
    }
    if (!assignedToId) {
      res.status(400).json({ error: "Usuário destino obrigatório" });
      return;
    }

    // Valida se o redirecionamento é permitido pelo routing
    const [routing] = await db.select().from(criterionRoutingTable)
      .where(eq(criterionRoutingTable.criterionId, criterionId)).limit(1);

    if (routing?.redirectMode === "none") {
      res.status(400).json({ error: "Este critério não permite redirecionamento" });
      return;
    }

    if (routing?.redirectMode === "specific") {
      const [allowed] = await db.select().from(criterionRedirectUsersTable)
        .where(and(eq(criterionRedirectUsersTable.criterionId, criterionId), eq(criterionRedirectUsersTable.userId, assignedToId)))
        .limit(1);
      if (!allowed) {
        res.status(400).json({ error: "Usuário não está na lista de redirecionamentos permitidos" });
        return;
      }
    }

    if (routing?.redirectMode === "area" && routing.redirectAreaId) {
      const [targetUser] = await db.select({ areaId: usersTable.areaId })
        .from(usersTable).where(eq(usersTable.id, assignedToId)).limit(1);
      if (!targetUser || targetUser.areaId !== routing.redirectAreaId) {
        res.status(400).json({ error: "Usuário não pertence à área permitida para redirecionamento" });
        return;
      }
    }

    const [updated] = await db.update(eventCriterionAssignmentsTable).set({
      assignedToId,
      status: "confirmed",
      redirectedFromId: assignment.assignedToId,
      updatedAt: new Date(),
    }).where(and(eq(eventCriterionAssignmentsTable.eventId, eventId), eq(eventCriterionAssignmentsTable.criterionId, criterionId)))
      .returning();

    await audit(user.userId, "redirect", "event_criterion_assignments", assignment.id, assignment, updated);
    res.json(updated);
    return;
  }

  // --- CONFIRMAÇÃO / REATRIBUIÇÃO (admin / rh) ---
  if (!["admin", "rh"].includes(user.role)) {
    res.status(403).json({ error: "Sem permissão" });
    return;
  }

  const [updated] = await db.update(eventCriterionAssignmentsTable).set({
    ...(assignedToId !== undefined && { assignedToId }),
    status: "confirmed",
    confirmedByUserId: user.userId,
    confirmedAt: new Date(),
    updatedAt: new Date(),
  }).where(and(eq(eventCriterionAssignmentsTable.eventId, eventId), eq(eventCriterionAssignmentsTable.criterionId, criterionId)))
    .returning();

  await audit(user.userId, "confirm", "event_criterion_assignments", assignment.id, assignment, updated);
  res.json(updated);
});

// ---------------------------------------------------------------------------
// GET /users/by-area/:areaId
// Lista usuários avaliadores de uma área (para popular dropdowns de redirect).
// ---------------------------------------------------------------------------
router.get("/users/by-area/:areaId", async (req, res) => {
  const areaId = parseInt(req.params.areaId as string);
  const users = await db.select({ id: usersTable.id, name: usersTable.name, role: usersTable.role })
    .from(usersTable)
    .where(and(eq(usersTable.areaId, areaId), eq(usersTable.active, true)))
    .orderBy(usersTable.name);
  res.json(users);
});

// ---------------------------------------------------------------------------
// GET /events/:id/criterion-assignments/redirect-options/:criterionId
// Retorna os usuários possíveis para redirecionar, de acordo com as regras do routing.
// ---------------------------------------------------------------------------
router.get("/events/:id/criterion-assignments/redirect-options/:criterionId", async (req, res) => {
  const criterionId = parseInt(req.params.criterionId as string);

  const [routing] = await db.select().from(criterionRoutingTable)
    .where(eq(criterionRoutingTable.criterionId, criterionId)).limit(1);

  if (!routing || routing.redirectMode === "none") {
    res.json([]);
    return;
  }

  if (routing.redirectMode === "specific") {
    const users = await db.select({ id: usersTable.id, name: usersTable.name })
      .from(criterionRedirectUsersTable)
      .innerJoin(usersTable, eq(criterionRedirectUsersTable.userId, usersTable.id))
      .where(and(eq(criterionRedirectUsersTable.criterionId, criterionId), eq(usersTable.active, true)))
      .orderBy(usersTable.name);
    res.json(users);
    return;
  }

  if (routing.redirectMode === "area" && routing.redirectAreaId) {
    const users = await db.select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(and(eq(usersTable.areaId, routing.redirectAreaId), eq(usersTable.active, true)))
      .orderBy(usersTable.name);
    res.json(users);
    return;
  }

  res.json([]);
});

// ---------------------------------------------------------------------------
// POST /events/:id/criterion-assignments/:criterionId/public-token
// Gera um link público de avaliação para freelancer (single-use).
// Só permitido se allowPublicLink=true no criterion_routing.
// Body: { recipientName: string }
// ---------------------------------------------------------------------------
router.post("/events/:id/criterion-assignments/:criterionId/public-token", async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const criterionId = parseInt(req.params.criterionId as string);
  const user = req.user!;
  const { recipientName } = req.body ?? {};

  if (!recipientName || typeof recipientName !== "string" || !recipientName.trim()) {
    res.status(400).json({ error: "Nome do destinatário é obrigatório" });
    return;
  }

  const [routing] = await db.select().from(criterionRoutingTable)
    .where(eq(criterionRoutingTable.criterionId, criterionId)).limit(1);
  if (!routing?.allowPublicLink) {
    res.status(403).json({ error: "Este critério não permite link público" });
    return;
  }

  const [assignment] = await db.select().from(eventCriterionAssignmentsTable)
    .where(and(
      eq(eventCriterionAssignmentsTable.eventId, eventId),
      eq(eventCriterionAssignmentsTable.criterionId, criterionId),
    )).limit(1);

  if (assignment?.status === "submitted") {
    res.status(400).json({ error: "Avaliação já submetida para este critério" });
    return;
  }

  const tokenId = randomUUID();
  await db.insert(publicEvalTokensTable).values({
    id: tokenId,
    eventId,
    criterionId,
    createdByUserId: user.userId,
    recipientName: recipientName.trim(),
  });

  await audit(user.userId, "create", "public_eval_tokens", tokenId, null, { eventId, criterionId, recipientName: recipientName.trim() });
  res.json({ tokenId });
});

// ---------------------------------------------------------------------------
// GET /events/:id/criterion-assignments/:criterionId/public-tokens
// Lista tokens gerados para este critério/evento (histórico).
// ---------------------------------------------------------------------------
router.get("/events/:id/criterion-assignments/:criterionId/public-tokens", async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const criterionId = parseInt(req.params.criterionId as string);

  const tokens = await db.select({
    id: publicEvalTokensTable.id,
    recipientName: publicEvalTokensTable.recipientName,
    submitterName: publicEvalTokensTable.submitterName,
    usedAt: publicEvalTokensTable.usedAt,
    createdAt: publicEvalTokensTable.createdAt,
    createdByName: usersTable.name,
  })
    .from(publicEvalTokensTable)
    .leftJoin(usersTable, eq(publicEvalTokensTable.createdByUserId, usersTable.id))
    .where(and(
      eq(publicEvalTokensTable.eventId, eventId),
      eq(publicEvalTokensTable.criterionId, criterionId),
    ))
    .orderBy(publicEvalTokensTable.createdAt);

  res.json(tokens);
});

export default router;
