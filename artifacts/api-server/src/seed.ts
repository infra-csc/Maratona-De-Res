import bcrypt from "bcryptjs";
import { isNotNull, eq, sql } from "drizzle-orm";
import {
  db, usersTable, areasTable, employeesTable, criteriaTable, eventsTable,
  eventParticipantsTable, eventCriteriaTable, platoonRulesTable, rulesTable,
  evaluationsTable, calibrationsTable, absencesTable, auditLogsTable,
  quarterlyResultsTable, employeeEventResultsTable, employeeCycleEligibilityTable,
  cyclesTable,
} from "@workspace/db";
import { calculateEventResult } from "./lib/calculations";

async function seed() {
  console.log("🌱 Iniciando seed...");

  // GUARD: nunca apagar dados vindos da integração (ERP).
  // Eventos sincronizados têm external_id e colaboradores têm source_type = 'erp'.
  // Esses dados precisam ser preservados — a sincronização apenas incrementa.
  //
  // IMPORTANTE: FORCE_SEED=1 sozinho NÃO apaga dados da integração. Isso é
  // proposital: durante o desenvolvimento é comum recriar as fixtures de demo,
  // e o reflexo de rodar "FORCE_SEED=1" já destruiu os dados sincronizados mais
  // de uma vez. Para realmente apagar a integração é preciso o segundo flag
  // explícito WIPE_INTEGRATION=1 (em conjunto com FORCE_SEED=1).
  const [{ extEvents }] = await db
    .select({ extEvents: sql<number>`count(*)` })
    .from(eventsTable)
    .where(isNotNull(eventsTable.externalId));
  const [{ erpEmployees }] = await db
    .select({ erpEmployees: sql<number>`count(*)` })
    .from(employeesTable)
    .where(eq(employeesTable.sourceType, "erp"));
  const hasIntegrationData = Number(extEvents) > 0 || Number(erpEmployees) > 0;

  const forceSeed = process.env.FORCE_SEED === "1";
  const wipeIntegration = process.env.WIPE_INTEGRATION === "1";

  if (hasIntegrationData && !(forceSeed && wipeIntegration)) {
    console.log(
      `\n⛔ Seed cancelado: há dados da integração no banco ` +
      `(${extEvents} eventos, ${erpEmployees} colaboradores ERP) que NÃO serão apagados.\n` +
      (forceSeed
        ? "   FORCE_SEED=1 sozinho NÃO apaga dados da integração. " +
          "Para apagar mesmo assim, rode também com WIPE_INTEGRATION=1.\n"
        : "   Para reinicializar um banco SEM integração, rode com FORCE_SEED=1. " +
          "Se realmente quiser perder os dados sincronizados, use FORCE_SEED=1 WIPE_INTEGRATION=1.\n"),
    );
    return;
  }

  // Wipe in reverse-dependency order
  await db.delete(auditLogsTable);
  await db.delete(employeeCycleEligibilityTable);
  await db.delete(employeeEventResultsTable);
  await db.delete(quarterlyResultsTable);
  await db.delete(calibrationsTable);
  await db.delete(evaluationsTable);
  await db.delete(absencesTable);
  await db.delete(eventCriteriaTable);
  await db.delete(eventParticipantsTable);
  await db.delete(eventsTable);
  await db.delete(cyclesTable);
  await db.delete(platoonRulesTable);
  await db.delete(rulesTable);
  await db.delete(criteriaTable);
  await db.delete(usersTable);
  await db.delete(employeesTable);
  await db.delete(areasTable);
  console.log("✓ Dados anteriores removidos");

  const areas = await db.insert(areasTable).values([
    { name: "Cenografia", description: "Equipe de cenografia e montagem" },               // 0
    { name: "Logística", description: "Transporte e logística operacional" },              // 1
    { name: "Produção", description: "Coordenação e produção de eventos" },               // 2
    { name: "Ferramentas e case", description: "Controle e retorno de ferramentas e cases" }, // 3
    { name: "Atendimento", description: "Atendimento ao cliente" },                        // 4
    { name: "Ativação", description: "Ativação de marca e experiência" },                  // 5
  ]).returning();

  console.log(`✓ ${areas.length} áreas criadas`);

  const hash = await bcrypt.hash("123456", 12);
  const users = await db.insert(usersTable).values([
    { name: "Admin Sistema", email: "admin@cenografica.com.br", passwordHash: hash, role: "admin" },
    { name: "Ana Paula RH", email: "rh@cenografica.com.br", passwordHash: hash, role: "rh" },
    { name: "Carlos Avaliador", email: "avaliador@cenografica.com.br", passwordHash: hash, role: "avaliador", areaId: areas[0].id },
    { name: "Diretoria Geral", email: "diretoria@cenografica.com.br", passwordHash: hash, role: "diretoria" },
    { name: "Visualizador", email: "visualizador@cenografica.com.br", passwordHash: hash, role: "visualizador" },
    { name: "Marcos Avaliador Logística", email: "avaliador2@cenografica.com.br", passwordHash: hash, role: "avaliador", areaId: areas[1].id },
    { name: "Avaliador Atendimento", email: "avaliador.atendimento@cenografica.com.br", passwordHash: hash, role: "avaliador", areaId: areas[4].id },
    { name: "Avaliador Produção", email: "avaliador.producao@cenografica.com.br", passwordHash: hash, role: "avaliador", areaId: areas[2].id },
    { name: "Avaliador Ferramentas e case", email: "avaliador.ferramentas@cenografica.com.br", passwordHash: hash, role: "avaliador", areaId: areas[3].id },
    { name: "Avaliador Ativação", email: "avaliador.ativacao@cenografica.com.br", passwordHash: hash, role: "avaliador", areaId: areas[5].id },
  ]).returning();

  console.log(`✓ ${users.length} usuários criados`);

  const employees = await db.insert(employeesTable).values([
    { name: "Adriano Santos", department: "Cenografia", functionName: "Montador Senior" },
    { name: "Beatriz Lima", department: "Cenografia", functionName: "Montadora" },
    { name: "Carlos Eduardo Ferreira", department: "Cenografia", functionName: "Montador" },
    { name: "Diana Carvalho", department: "Cenografia", functionName: "Montadora Senior" },
    { name: "Eduardo Nascimento", department: "Logística", functionName: "Motorista/Auxiliar" },
    { name: "Fernanda Costa", department: "Cenografia", functionName: "Montadora" },
    { name: "Gabriel Ribeiro", department: "Cenografia", functionName: "Montador" },
    { name: "Helena Alves", department: "Produção", functionName: "Assistente de Produção" },
    { name: "Igor Mendes", department: "Cenografia", functionName: "Montador" },
    { name: "Juliana Pereira", department: "Cenografia", functionName: "Montadora" },
    { name: "Lucas Oliveira", department: "Logística", functionName: "Auxiliar Logístico" },
    { name: "Mariana Souza", department: "Cenografia", functionName: "Montadora Senior" },
  ]).returning();

  console.log(`✓ ${employees.length} colaboradores criados`);

  // 7 quesitos fixos — pesos somam 20
  // Nota máx = 5 → resultado máx = 5×20 = 100
  const criteria = await db.insert(criteriaTable).values([
    {
      name: "Perda de Material/Estrutura",
      description: "Todo material enviado deve retornar à base sem perda de mercadorias, materiais ou avarias.",
      responsibleAreaId: areas[1].id, // Logística
      responsibleAreaLabel: "Logística",
      defaultWeight: "3",
      displayOrder: 1,
    },
    {
      name: "Ferramentas & Case",
      description: "Todas as ferramentas e cases devem retornar à base corretamente, sem perdas ou danos.",
      responsibleAreaId: areas[3].id, // Ferramentas e case
      responsibleAreaLabel: "Ferramentas e case",
      defaultWeight: "2",
      displayOrder: 2,
    },
    {
      name: "Qualidade da Entrega",
      description: "Avalia acabamento, materiais em bom estado, qualidade visual e satisfação na ativação/atendimento.",
      responsibleAreaId: areas[4].id, // Atendimento
      responsibleAreaLabel: "Atendimento",
      defaultWeight: "3",
      displayOrder: 3,
    },
    {
      name: "Obrigações Estruturais",
      description: "Avalia o cumprimento das obrigações estruturais da montagem, conforme alinhamento dos produtores de cenografia e supervisão.",
      responsibleAreaId: areas[0].id, // Cenografia
      responsibleAreaLabel: "Cenografia",
      defaultWeight: "3",
      displayOrder: 4,
    },
    {
      name: "Logística Reversa",
      description: "Avalia se a carga de retorno foi feita adequadamente e conforme o alinhamento combinado.",
      responsibleAreaId: areas[1].id, // Logística
      responsibleAreaLabel: "Logística",
      defaultWeight: "3",
      displayOrder: 5,
    },
    {
      name: "Prazo de Entrega",
      description: "Avalia se as entregas ocorreram dentro do cronograma, sem atrasos e sem custos adicionais de mão de obra.",
      responsibleAreaId: areas[2].id, // Produção
      responsibleAreaLabel: "Produção",
      defaultWeight: "3",
      displayOrder: 6,
    },
    {
      name: "Conduta e Comportamento",
      description: "Avalia uso de uniforme, EPI, envio de comprovações e fotos, horários na arena, comportamento profissional e cuidado com ferramentas.",
      responsibleAreaId: areas[0].id, // Cenografia
      responsibleAreaLabel: "Cenografia",
      defaultWeight: "3",
      displayOrder: 7,
    },
  ]).returning();

  console.log(`✓ ${criteria.length} critérios criados`);

  // Pelotões — escala 0-100 (Nota × Peso, max 5×20=100)
  await db.insert(platoonRulesTable).values([
    { name: "Pelotão Quênia", color: "#dc2626", minScore: "90", maxScore: "100", minInclusive: true, maxInclusive: true, bonusValue: "3200.00", description: "Top performers — bônus máximo Caju", displayOrder: 1 },
    { name: "Pelotão Azul",   color: "#2563eb", minScore: "80", maxScore: "90",  minInclusive: true, maxInclusive: false, bonusValue: "2400.00", description: "Alta performance",   displayOrder: 2 },
    { name: "Pelotão Verde",  color: "#16a34a", minScore: "70", maxScore: "80",  minInclusive: true, maxInclusive: false, bonusValue: "1600.00", description: "Boa performance",    displayOrder: 3 },
    { name: "Pelotão Branco", color: "#64748b", minScore: "0",  maxScore: "70",  minInclusive: true, maxInclusive: false, bonusValue: "0.00",    description: "Precisa melhorar",  displayOrder: 4 },
  ]);

  console.log("✓ Regras de pelotão criadas");

  await db.insert(rulesTable).values([
    { key: "absence_penalty_per_absence", value: "50", description: "Penalidade por falta (desconto em pontos no resultado final, escala 0-100)" },
    { key: "max_score", value: "10", description: "Pontuação máxima por critério (escala 0-10)" },
    { key: "min_evaluations_to_close", value: "1", description: "Mínimo de avaliações submetidas para fechar evento" },
    { key: "min_events_eligibility", value: "8", description: "Mínimo de eventos participados no ciclo para o colaborador ser elegível ao bônus" },
    { key: "cycle_bonus_paid_by", value: "caju", description: "Forma de pagamento do bônus do ciclo" },
  ]);

  console.log("✓ Regras do sistema criadas");

  const now = new Date();
  const year = now.getFullYear();

  const [cycle] = await db.insert(cyclesTable).values({
    name: `Ciclo ${year}`,
    startDate: `${year}-06-01`,
    endDate: `${year}-09-30`,
    status: "open",
    isCurrent: true,
  }).returning();

  console.log(`✓ Ciclo atual criado: ${cycle.name}`);

  const events = await db.insert(eventsTable).values([
    {
      name: "ECO RUN - MOSSORÓ",
      clientName: "ECO Events",
      location: "Centro de Eventos",
      city: "Mossoró",
      state: "RN",
      startDate: `${year}-06-13`,
      endDate: `${year}-06-15`,
      cycleId: cycle.id,
      status: "closed",
    },
    {
      name: "EXPO CENOGRÁFICA NORDESTE",
      clientName: "Associação Industrial NE",
      location: "Centro de Convenções",
      city: "Fortaleza",
      state: "CE",
      startDate: `${year}-06-27`,
      endDate: `${year}-06-29`,
      cycleId: cycle.id,
      status: "closed",
    },
    {
      name: "FESTIVAL CULTURAL RJ",
      clientName: "Prefeitura Municipal",
      location: "Parque Estadual",
      city: "Rio de Janeiro",
      state: "RJ",
      startDate: `${year}-07-11`,
      endDate: `${year}-07-13`,
      cycleId: cycle.id,
      status: "open",
    },
    {
      name: "SHOWROOM PREMIUM SP",
      clientName: "Luxury Brands BR",
      location: "Shopping Iguatemi",
      city: "São Paulo",
      state: "SP",
      startDate: `${year}-08-15`,
      endDate: `${year}-08-17`,
      cycleId: cycle.id,
      status: "open",
    },
  ]).returning();

  console.log(`✓ ${events.length} eventos criados`);

  const participantSubset = employees.slice(0, 8);
  for (const ev of events) {
    await db.insert(eventParticipantsTable).values(
      participantSubset.map((emp: typeof employees[number]) => ({
        eventId: ev.id, employeeId: emp.id, functionName: emp.functionName,
      }))
    );
    await db.insert(eventCriteriaTable).values(
      criteria.map((c: typeof criteria[number]) => ({
        eventId: ev.id, criterionId: c.id, active: true,
        weightOverride: c.defaultWeight,
      }))
    );
  }

  console.log("✓ Participantes e critérios dos eventos configurados");

  // Avaliação por TIME do evento: uma nota por (evento, critério, avaliador).
  // Todos os participantes do time recebem a MESMA nota do evento.
  // pesos oficiais=[3,2,3,3,3,3,3] (soma 20), notas (0-10)=[8,8,8,6,4,6,10]
  //   média ponderada = (3×8+2×8+3×8+3×6+3×4+3×6+3×10)/20 ×10 = 142/20 ×10 = 71
  const exampleScores = [8, 8, 8, 6, 4, 6, 10];
  const closedEvents = events.filter(e => e.status === "closed");

  for (const ev of closedEvents) {
    for (let i = 0; i < criteria.length; i++) {
      const c = criteria[i];
      const score = exampleScores[i % exampleScores.length];
      await db.insert(evaluationsTable).values({
        eventId: ev.id,
        criterionId: c.id,
        evaluatorUserId: users[2].id,
        score: String(score),
        comments: score < 6 ? "Ponto de atenção do time neste critério — reforçar na próxima missão." : null,
        commentVisibility: "internal",
        status: "submitted",
        submittedAt: new Date(),
      });
    }
  }

  console.log("✓ Avaliações do time criadas (escala 0–10, resultado em média ponderada ×10 → 0–100)");

  // Calibração no nível do critério do evento (não por colaborador).
  for (const ev of closedEvents) {
    for (const c of criteria.slice(0, 2)) {
      await db.insert(calibrationsTable).values({
        eventId: ev.id,
        criterionId: c.id,
        originalAverageScore: String(4.0),
        calibratedScore: String(4.0),
        calibrationReason: "Calibração de alinhamento do evento — mantido pela Diretoria",
        calibratedByUserId: users[3].id,
      });
    }
  }

  console.log("✓ Calibrações do evento criadas");

  // Ausências: apenas 1 colaborador, para não impactar muito os resultados de demonstração
  await db.insert(absencesTable).values({
    employeeId: employees[4].id,
    eventId: closedEvents[0]?.id ?? null,
    penaltyType: "falta",
    points: 50,
    date: `${year}-06-14`,
    cycleId: cycle.id,
    quantity: 1,
    reason: "Sem justificativa apresentada",
    registeredByUserId: users[1].id,
  });

  console.log("✓ Ausências seed criadas");
  console.log("\n✅ Seed concluído com sucesso!");
  console.log("\n📊 Validação de cálculo (escala 0–10, média ponderada ×10 → 0–100):");
  {
    const exWeights = [3, 3, 2, 3, 3, 3, 3];
    const exScores = [8, 8, 8, 6, 4, 6, 10];
    const exResult = calculateEventResult(
      exWeights.map((weight, i) => ({ criterionId: i + 1, weight, averageScore: exScores[i], calibratedScore: null })),
    );
    console.log(`   Pesos: [${exWeights.join(",")}], Notas: [${exScores.join(",")}]`);
    console.log(`   Esperado: 71 | Resultado: ${exResult}`);
  }
  console.log("\n👤 Usuários criados (senha: 123456):");
  users.forEach((u: typeof users[number]) => console.log(`   ${u.email} — ${u.role}`));
}

seed().catch(console.error).finally(() => process.exit(0));
