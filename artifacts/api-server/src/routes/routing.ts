import { Router } from "express";
import { randomUUID } from "crypto";
import {
  db,
  criterionRoutingTable, criterionRedirectUsersTable,
  eventCriterionAssignmentsTable, criteriaTable, usersTable,
  areasTable, eventsTable, eventCriteriaTable, publicEvalTokensTable,
  publicEvalTokenCriteriaTable, areaConformityRoutingTable,
} from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);

// ---------------------------------------------------------------------------
// Áreas em que o usuário é "avaliador principal": aquelas cujos critérios têm
// este usuário como default_evaluator_id no roteamento. Usado para dar
// visibilidade completa dos quesitos da área e permissão de atribuir/tomar
// para si/mover entre colegas, sem precisar de papel admin/rh.
// ---------------------------------------------------------------------------
async function getPrincipalAreaIds(userId: number): Promise<number[]> {
  const rows = await db.select({ areaId: criteriaTable.responsibleAreaId })
    .from(criterionRoutingTable)
    .innerJoin(criteriaTable, eq(criterionRoutingTable.criterionId, criteriaTable.id))
    .where(eq(criterionRoutingTable.defaultEvaluatorId, userId));
  return [...new Set(rows.map(r => r.areaId).filter((id): id is number => id != null))];
}

// ---------------------------------------------------------------------------
// GET /users/my-principal-areas
// Retorna as áreas em que o usuário logado é avaliador principal (default
// evaluator de pelo menos um critério da área). Usado pelo front para
// decidir se mostra o painel "Quesitos da minha área".
// ---------------------------------------------------------------------------
router.get("/users/my-principal-areas", async (req, res) => {
  const user = req.user!;
  const areaIds = await getPrincipalAreaIds(user.userId);
  if (areaIds.length === 0) { res.json([]); return; }
  const areas = await db.select({ id: areasTable.id, name: areasTable.name })
    .from(areasTable).where(inArray(areasTable.id, areaIds));
  res.json(areas);
});

// ---------------------------------------------------------------------------
// GET /criterion-routing
// Retorna o roteamento de todos os critérios (admin/rh).
// ---------------------------------------------------------------------------
router.get("/criterion-routing", requireRole("admin", "rh"), async (_req, res) => {
  const routings = await db.select({
    criterionId: criterionRoutingTable.criterionId,
    defaultEvaluatorId: criterionRoutingTable.defaultEvaluatorId,
    defaultEvaluatorName: usersTable.name,
    conformityEvaluatorId: criterionRoutingTable.conformityEvaluatorId,
    conformityEvaluatorName: sql<string | null>`(SELECT name FROM users WHERE id = ${criterionRoutingTable.conformityEvaluatorId})`,
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
    conformityEvaluatorId: criterionRoutingTable.conformityEvaluatorId,
    conformityEvaluatorName: sql<string | null>`(SELECT name FROM users WHERE id = ${criterionRoutingTable.conformityEvaluatorId})`,
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
  const { defaultEvaluatorId, conformityEvaluatorId, commentRequired, redirectMode, redirectAreaId, allowPublicLink, redirectUserIds } = req.body;

  const [existing] = await db.select().from(criterionRoutingTable)
    .where(eq(criterionRoutingTable.criterionId, criterionId)).limit(1);

  const values = {
    defaultEvaluatorId: defaultEvaluatorId ?? null,
    conformityEvaluatorId: conformityEvaluatorId ?? null,
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
    criterionAreaId: criteriaTable.responsibleAreaId,
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
    // Além das próprias, o avaliador principal de uma área vê TODAS as
    // atribuições dos critérios daquela área (visibilidade completa),
    // podendo depois atribuir/tomar/mover entre colegas via ação "assign".
    const principalAreaIds = await getPrincipalAreaIds(user.userId);
    let result: Array<(typeof enriched)[number] | {
      id: number | null;
      eventId: number;
      criterionId: number;
      criterionName: string;
      criterionAreaId: number | null;
      assignedToId: number | null;
      assignedToName: string | null;
      status: "pending";
      redirectedFromId: null;
      confirmedAt: null;
      updatedAt: null;
      createdAt: null;
      redirectedFromName: null;
    }> = enriched.filter(a =>
      a.assignedToId === user.userId ||
      (a.criterionAreaId != null && principalAreaIds.includes(a.criterionAreaId))
    );

    // Um critério só ganha uma linha em event_criterion_assignments depois
    // que alguém roda "Gerar Sugestões" (admin) ou faz a primeira ação nele.
    // Sem isso, um critério da área do principal que ainda não tem linha
    // simplesmente não aparecia na lista — escondendo a gestão da área dele
    // (quem está com o critério, poder de tomar/atribuir) até alguém mais
    // gerar as sugestões. Preenchemos aqui com linhas "virtuais" (pending,
    // sem id) para os critérios ativos do evento na área do principal que
    // ainda não têm atribuição real, usando o default_evaluator do routing.
    if (principalAreaIds.length > 0) {
      const assignedCriterionIds = new Set(enriched.map(a => a.criterionId));
      const areaCriteria = await db.select({
        criterionId: criteriaTable.id,
        criterionName: criteriaTable.name,
        criterionAreaId: criteriaTable.responsibleAreaId,
        defaultEvaluatorId: criterionRoutingTable.defaultEvaluatorId,
        defaultEvaluatorName: usersTable.name,
      })
        .from(eventCriteriaTable)
        .innerJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
        .leftJoin(criterionRoutingTable, eq(criterionRoutingTable.criterionId, criteriaTable.id))
        .leftJoin(usersTable, eq(criterionRoutingTable.defaultEvaluatorId, usersTable.id))
        .where(and(
          eq(eventCriteriaTable.eventId, eventId),
          eq(eventCriteriaTable.active, true),
          inArray(criteriaTable.responsibleAreaId, principalAreaIds),
        ));

      const virtualRows = areaCriteria
        .filter(c => !assignedCriterionIds.has(c.criterionId))
        .map(c => ({
          id: null as number | null,
          eventId,
          criterionId: c.criterionId,
          criterionName: c.criterionName,
          criterionAreaId: c.criterionAreaId,
          assignedToId: c.defaultEvaluatorId ?? null,
          assignedToName: c.defaultEvaluatorName ?? null,
          status: "pending" as const,
          redirectedFromId: null,
          confirmedAt: null,
          updatedAt: null,
          createdAt: null,
          redirectedFromName: null,
        }));

      result = [...result, ...virtualRows];
    }

    res.json(result);
    return;
  }

  res.json(enriched);
});

// ---------------------------------------------------------------------------
// POST /events/:id/criterion-assignments/generate
// Gera atribuições "suggested" para todos os critérios ativos do evento
// com base no criterion_routing. Pula critérios que já têm atribuição.
// Extraída em função para poder ser chamada tanto pela rota manual abaixo
// quanto automaticamente ao liberar as avaliações do evento (o avaliador
// padrão já vem pré-determinado do routing — não faz sentido depender de
// um clique manual de RH pra isso existir).
// ---------------------------------------------------------------------------
export async function generateCriterionAssignments(eventId: number) {
  const eventCriteria = await db.select({ criterionId: eventCriteriaTable.criterionId })
    .from(eventCriteriaTable)
    .where(and(eq(eventCriteriaTable.eventId, eventId), eq(eventCriteriaTable.active, true)));

  if (eventCriteria.length === 0) {
    return { generated: 0, skipped: 0 };
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

  return { generated, skipped };
}

router.post("/events/:id/criterion-assignments/generate", requireRole("admin", "rh"), async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const result = await generateCriterionAssignments(eventId);
  res.json(result);
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

  let [assignment] = await db.select().from(eventCriterionAssignmentsTable)
    .where(and(eq(eventCriterionAssignmentsTable.eventId, eventId), eq(eventCriterionAssignmentsTable.criterionId, criterionId)))
    .limit(1);

  // A linha de atribuição só existe depois que alguém rodou o endpoint de
  // geração de atribuições para o evento. Se o critério ainda não tem linha
  // (evento novo, critério adicionado depois, etc.), criamos na hora usando
  // o routing padrão do critério, em vez de falhar com 404 — evita o erro
  // "Atribuição não encontrada" ao confirmar um redirecionamento.
  if (!assignment) {
    const [routingDefault] = await db.select().from(criterionRoutingTable)
      .where(eq(criterionRoutingTable.criterionId, criterionId)).limit(1);
    [assignment] = await db.insert(eventCriterionAssignmentsTable).values({
      eventId,
      criterionId,
      assignedToId: routingDefault?.defaultEvaluatorId ?? null,
      status: routingDefault?.defaultEvaluatorId ? "suggested" : "pending",
    }).returning();
  }

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

  // --- ATRIBUIÇÃO PELO AVALIADOR PRINCIPAL DA ÁREA ---
  // O avaliador principal (default evaluator de algum critério da área) pode
  // atribuir qualquer critério da SUA área para si mesmo ou para outro colega
  // da mesma área, independente de quem está atribuído atualmente — sem
  // precisar de papel admin/rh. Diferente do redirect: não passa pelas
  // regras de redirectMode (é o "chefe" da área decidindo, não um repasse).
  if (action === "assign") {
    const isManager = ["admin", "rh"].includes(user.role);
    const [criterion] = await db.select({ areaId: criteriaTable.responsibleAreaId })
      .from(criteriaTable).where(eq(criteriaTable.id, criterionId)).limit(1);
    const principalAreaIds = isManager ? [] : await getPrincipalAreaIds(user.userId);
    const isAreaPrincipal = !isManager && criterion?.areaId != null && principalAreaIds.includes(criterion.areaId);

    if (!isManager && !isAreaPrincipal) {
      res.status(403).json({ error: "Sem permissão para atribuir este critério" });
      return;
    }
    if (assignment.status === "submitted") {
      res.status(400).json({ error: "Avaliação já submetida, não pode ser reatribuída" });
      return;
    }
    if (!assignedToId) {
      res.status(400).json({ error: "Usuário destino obrigatório" });
      return;
    }
    if (isAreaPrincipal) {
      const [targetUser] = await db.select({ areaId: usersTable.areaId })
        .from(usersTable).where(eq(usersTable.id, assignedToId)).limit(1);
      if (!targetUser || targetUser.areaId !== criterion!.areaId) {
        res.status(400).json({ error: "Usuário não pertence à sua área" });
        return;
      }
    }

    const [updated] = await db.update(eventCriterionAssignmentsTable).set({
      assignedToId,
      status: "confirmed",
      redirectedFromId: assignment.assignedToId,
      confirmedByUserId: user.userId,
      confirmedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(eq(eventCriterionAssignmentsTable.eventId, eventId), eq(eventCriterionAssignmentsTable.criterionId, criterionId)))
      .returning();

    await audit(user.userId, "assign", "event_criterion_assignments", assignment.id, assignment, updated);
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
// GET /events/:id/public-link-eligible-criteria
// Retorna os critérios do QUESTIONÁRIO deste avaliador neste evento que
// podem ser incluídos num link público (allowPublicLink=true no routing
// global do critério, atribuído a este usuário, e ainda não submetido).
// Usado pela UI para decidir se mostra o botão "Link Freelancer" e o que
// o link vai cobrir.
// ---------------------------------------------------------------------------
router.get("/events/:id/public-link-eligible-criteria", async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const user = req.user!;

  const assignments = await db.select({
    criterionId: eventCriterionAssignmentsTable.criterionId,
    criterionName: criteriaTable.name,
    status: eventCriterionAssignmentsTable.status,
    allowPublicLink: criterionRoutingTable.allowPublicLink,
  })
    .from(eventCriterionAssignmentsTable)
    .innerJoin(criteriaTable, eq(eventCriterionAssignmentsTable.criterionId, criteriaTable.id))
    .leftJoin(criterionRoutingTable, eq(criterionRoutingTable.criterionId, eventCriterionAssignmentsTable.criterionId))
    .where(and(
      eq(eventCriterionAssignmentsTable.eventId, eventId),
      eq(eventCriterionAssignmentsTable.assignedToId, user.userId),
    ));

  const eligible = assignments
    .filter(a => a.allowPublicLink && a.status !== "submitted")
    .map(a => ({ criterionId: a.criterionId, criterionName: a.criterionName }));

  res.json(eligible);
});

// ---------------------------------------------------------------------------
// POST /events/:id/public-token
// Gera UM link público único cobrindo TODO o questionário (todos os critérios
// elegíveis, ver rota acima) que o avaliador logado está respondendo neste
// evento. Só permitido se houver pelo menos um critério elegível.
// Body: { recipientName: string }
// ---------------------------------------------------------------------------
router.post("/events/:id/public-token", async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const user = req.user!;
  const { recipientName, criterionIds: requestedCriterionIds } = req.body ?? {};

  if (!recipientName || typeof recipientName !== "string" || !recipientName.trim()) {
    res.status(400).json({ error: "Nome do destinatário é obrigatório" });
    return;
  }

  const assignments = await db.select({
    criterionId: eventCriterionAssignmentsTable.criterionId,
    status: eventCriterionAssignmentsTable.status,
    allowPublicLink: criterionRoutingTable.allowPublicLink,
  })
    .from(eventCriterionAssignmentsTable)
    .leftJoin(criterionRoutingTable, eq(criterionRoutingTable.criterionId, eventCriterionAssignmentsTable.criterionId))
    .where(and(
      eq(eventCriterionAssignmentsTable.eventId, eventId),
      eq(eventCriterionAssignmentsTable.assignedToId, user.userId),
    ));

  let eligibleCriterionIds = assignments
    .filter(a => a.allowPublicLink && a.status !== "submitted")
    .map(a => a.criterionId);

  // Se o front passou uma lista de critérios (token de área/formulário), filtra
  // para a interseção — o token só cobre os critérios elegíveis daquela área.
  if (Array.isArray(requestedCriterionIds) && requestedCriterionIds.length > 0) {
    const requested = new Set(requestedCriterionIds as number[]);
    eligibleCriterionIds = eligibleCriterionIds.filter(id => requested.has(id));
  }

  if (eligibleCriterionIds.length === 0) {
    res.status(400).json({ error: "Nenhum critério deste formulário permite link público, ou já foram todos submetidos" });
    return;
  }

  const tokenId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(publicEvalTokensTable).values({
      id: tokenId,
      eventId,
      createdByUserId: user.userId,
      recipientName: recipientName.trim(),
    });
    await tx.insert(publicEvalTokenCriteriaTable).values(
      eligibleCriterionIds.map(criterionId => ({ tokenId, criterionId })),
    );
  });

  await audit(user.userId, "create", "public_eval_tokens", tokenId, null, {
    eventId, criterionIds: eligibleCriterionIds, recipientName: recipientName.trim(),
  });
  res.json({ tokenId });
});

// ---------------------------------------------------------------------------
// GET /events/:id/public-tokens
// Lista os links públicos gerados pelo avaliador logado para este evento
// (histórico exibido na tela de avaliação).
// ---------------------------------------------------------------------------
router.get("/events/:id/public-tokens", async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const user = req.user!;

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
      eq(publicEvalTokensTable.createdByUserId, user.userId),
      eq(publicEvalTokensTable.tokenType, "criteria"),
    ))
    .orderBy(publicEvalTokensTable.createdAt);

  res.json(tokens);
});

// ---------------------------------------------------------------------------
// POST /events/:id/public-token/conformity
// Gera um link público single-use para o avaliador de conformidade Cenografia
// delegar o formulário (EPI / Estaiamentos / Conduta / Ausências / Destaque)
// a um freelancer sem cadastro.
// Body: { recipientName: string }
// ---------------------------------------------------------------------------
router.post("/events/:id/public-token/conformity", async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const user = req.user!;
  const { recipientName } = req.body ?? {};

  if (!recipientName || typeof recipientName !== "string" || !recipientName.trim()) {
    res.status(400).json({ error: "Nome do destinatário é obrigatório" });
    return;
  }

  const [ev] = await db.select({
    status: eventsTable.status,
    conformityEvaluatorUserId: eventsTable.conformityEvaluatorUserId,
  }).from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);

  if (!ev) { res.status(404).json({ error: "Evento não encontrado" }); return; }
  if (ev.status !== "open" && ev.status !== "closed") {
    res.status(400).json({ error: "Evento não está aberto para avaliações" }); return;
  }

  const isAdminRh = ["admin", "rh"].includes(user.role);
  if (!isAdminRh && ev.conformityEvaluatorUserId !== user.userId) {
    res.status(403).json({ error: "Você não é o avaliador de conformidade Cenografia deste evento" }); return;
  }

  // O formulário de conformidade é um só por evento — só pode existir UM link.
  // Se já há um pendente, devolve o mesmo (reenvia se o freelancer perdeu);
  // se já foi respondido, não faz sentido gerar outro.
  const existing = await db.select({ id: publicEvalTokensTable.id, usedAt: publicEvalTokensTable.usedAt })
    .from(publicEvalTokensTable)
    .where(and(eq(publicEvalTokensTable.eventId, eventId), eq(publicEvalTokensTable.tokenType, "conformity_cenografia")));
  if (existing.some(t => t.usedAt !== null)) {
    res.status(409).json({ error: "Este formulário já foi respondido por um freelancer — não é possível gerar outro link" });
    return;
  }
  const pending = existing.find(t => t.usedAt === null);
  if (pending) {
    await db.update(publicEvalTokensTable)
      .set({ recipientName: recipientName.trim() })
      .where(eq(publicEvalTokensTable.id, pending.id));
    res.json({ tokenId: pending.id, reused: true });
    return;
  }

  const tokenId = randomUUID();
  await db.insert(publicEvalTokensTable).values({
    id: tokenId,
    eventId,
    createdByUserId: user.userId,
    recipientName: recipientName.trim(),
    tokenType: "conformity_cenografia",
  });

  await audit(user.userId, "create", "public_eval_tokens", tokenId, null, {
    eventId, recipientName: recipientName.trim(), tokenType: "conformity_cenografia",
  });
  res.json({ tokenId });
});

// ---------------------------------------------------------------------------
// POST /events/:id/public-token/conformity-ferramentas
// Gera um link público single-use para o avaliador de conformidade Ferramentas
// delegar o formulário (Guarda de Equipamentos) a um freelancer sem cadastro.
// Body: { recipientName: string }
// ---------------------------------------------------------------------------
router.post("/events/:id/public-token/conformity-ferramentas", async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const user = req.user!;
  const { recipientName } = req.body ?? {};

  if (!recipientName || typeof recipientName !== "string" || !recipientName.trim()) {
    res.status(400).json({ error: "Nome do destinatário é obrigatório" });
    return;
  }

  const [ev] = await db.select({
    status: eventsTable.status,
    conformityEvaluatorFerramentasUserId: eventsTable.conformityEvaluatorFerramentasUserId,
  }).from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);

  if (!ev) { res.status(404).json({ error: "Evento não encontrado" }); return; }
  if (ev.status !== "open" && ev.status !== "closed") {
    res.status(400).json({ error: "Evento não está aberto para avaliações" }); return;
  }

  const isAdminRh = ["admin", "rh"].includes(user.role);
  if (!isAdminRh && ev.conformityEvaluatorFerramentasUserId !== user.userId) {
    res.status(403).json({ error: "Você não é o avaliador de conformidade Ferramentas deste evento" }); return;
  }

  // Um link só por evento — mesmo comportamento do formulário de Cenografia.
  const existing = await db.select({ id: publicEvalTokensTable.id, usedAt: publicEvalTokensTable.usedAt })
    .from(publicEvalTokensTable)
    .where(and(eq(publicEvalTokensTable.eventId, eventId), eq(publicEvalTokensTable.tokenType, "conformity_ferramentas")));
  if (existing.some(t => t.usedAt !== null)) {
    res.status(409).json({ error: "Este formulário já foi respondido por um freelancer — não é possível gerar outro link" });
    return;
  }
  const pending = existing.find(t => t.usedAt === null);
  if (pending) {
    await db.update(publicEvalTokensTable)
      .set({ recipientName: recipientName.trim() })
      .where(eq(publicEvalTokensTable.id, pending.id));
    res.json({ tokenId: pending.id, reused: true });
    return;
  }

  const tokenId = randomUUID();
  await db.insert(publicEvalTokensTable).values({
    id: tokenId,
    eventId,
    createdByUserId: user.userId,
    recipientName: recipientName.trim(),
    tokenType: "conformity_ferramentas",
  });

  await audit(user.userId, "create", "public_eval_tokens", tokenId, null, {
    eventId, recipientName: recipientName.trim(), tokenType: "conformity_ferramentas",
  });
  res.json({ tokenId });
});

// ---------------------------------------------------------------------------
// GET /events/:id/public-tokens/conformity
// Lista tokens de conformidade Cenografia gerados pelo avaliador logado.
// ---------------------------------------------------------------------------
router.get("/events/:id/public-tokens/conformity", async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const user = req.user!;

  const tokens = await db.select({
    id: publicEvalTokensTable.id,
    recipientName: publicEvalTokensTable.recipientName,
    submitterName: publicEvalTokensTable.submitterName,
    usedAt: publicEvalTokensTable.usedAt,
    createdAt: publicEvalTokensTable.createdAt,
  })
    .from(publicEvalTokensTable)
    .where(and(
      eq(publicEvalTokensTable.eventId, eventId),
      eq(publicEvalTokensTable.createdByUserId, user.userId),
      eq(publicEvalTokensTable.tokenType, "conformity_cenografia"),
    ))
    .orderBy(publicEvalTokensTable.createdAt);

  res.json(tokens);
});

// ---------------------------------------------------------------------------
// GET /events/:id/public-tokens/conformity-ferramentas
// Lista tokens de conformidade Ferramentas gerados pelo avaliador logado.
// ---------------------------------------------------------------------------
router.get("/events/:id/public-tokens/conformity-ferramentas", async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const user = req.user!;

  const tokens = await db.select({
    id: publicEvalTokensTable.id,
    recipientName: publicEvalTokensTable.recipientName,
    submitterName: publicEvalTokensTable.submitterName,
    usedAt: publicEvalTokensTable.usedAt,
    createdAt: publicEvalTokensTable.createdAt,
  })
    .from(publicEvalTokensTable)
    .where(and(
      eq(publicEvalTokensTable.eventId, eventId),
      eq(publicEvalTokensTable.createdByUserId, user.userId),
      eq(publicEvalTokensTable.tokenType, "conformity_ferramentas"),
    ))
    .orderBy(publicEvalTokensTable.createdAt);

  res.json(tokens);
});

// ---------------------------------------------------------------------------
// GET /events/:id/public-tokens/all
// Admin/RH: lista TODOS os links públicos gerados para este evento (qualquer
// avaliador, qualquer formulário — critérios, Cenografia, Ferramentas e Case),
// para dar visibilidade central de quem enviou o quê e se já foi respondido.
// ---------------------------------------------------------------------------
router.get("/events/:id/public-tokens/all", requireRole("admin", "rh"), async (req, res) => {
  const eventId = parseInt(req.params.id as string);

  const tokens = await db.select({
    id: publicEvalTokensTable.id,
    tokenType: publicEvalTokensTable.tokenType,
    recipientName: publicEvalTokensTable.recipientName,
    submitterName: publicEvalTokensTable.submitterName,
    usedAt: publicEvalTokensTable.usedAt,
    createdAt: publicEvalTokensTable.createdAt,
    createdByName: usersTable.name,
  })
    .from(publicEvalTokensTable)
    .leftJoin(usersTable, eq(publicEvalTokensTable.createdByUserId, usersTable.id))
    .where(eq(publicEvalTokensTable.eventId, eventId))
    .orderBy(publicEvalTokensTable.createdAt);

  res.json(tokens);
});

// ---------------------------------------------------------------------------
// GET /conformity-routing
// Lista o avaliador padrão da Matriz de Conformidade configurado por área
// (ex.: Cenografia → grupo 2 da matriz, Ferramentas e Case → grupo 1).
// ---------------------------------------------------------------------------
router.get("/conformity-routing", async (_req, res) => {
  const rows = await db.select({
    id: areaConformityRoutingTable.id,
    areaId: areaConformityRoutingTable.areaId,
    areaName: areasTable.name,
    defaultEvaluatorId: areaConformityRoutingTable.defaultEvaluatorId,
    defaultEvaluatorName: usersTable.name,
  })
    .from(areaConformityRoutingTable)
    .leftJoin(areasTable, eq(areaConformityRoutingTable.areaId, areasTable.id))
    .leftJoin(usersTable, eq(areaConformityRoutingTable.defaultEvaluatorId, usersTable.id));
  res.json(rows);
});

// ---------------------------------------------------------------------------
// PUT /areas/:id/conformity-routing
// Define (ou remove, com defaultEvaluatorId: null) o avaliador padrão da
// Matriz de Conformidade para esta área.
// ---------------------------------------------------------------------------
router.put("/areas/:id/conformity-routing", requireRole("admin", "rh"), async (req, res) => {
  const areaId = parseInt(req.params.id as string);
  const { defaultEvaluatorId } = req.body as { defaultEvaluatorId: number | null };

  const [area] = await db.select().from(areasTable).where(eq(areasTable.id, areaId)).limit(1);
  if (!area) { res.status(404).json({ error: "Área não encontrada" }); return; }

  const [existing] = await db.select().from(areaConformityRoutingTable)
    .where(eq(areaConformityRoutingTable.areaId, areaId)).limit(1);

  let saved: typeof areaConformityRoutingTable.$inferSelect;
  if (existing) {
    [saved] = await db.update(areaConformityRoutingTable)
      .set({ defaultEvaluatorId: defaultEvaluatorId ?? null, updatedAt: new Date() })
      .where(eq(areaConformityRoutingTable.id, existing.id))
      .returning();
  } else {
    [saved] = await db.insert(areaConformityRoutingTable)
      .values({ areaId, defaultEvaluatorId: defaultEvaluatorId ?? null })
      .returning();
  }

  await audit(req.user!.userId, "set_conformity_routing", "areas", areaId, existing ?? null, saved);
  res.json(saved);
});

export default router;
