import bcrypt from "bcryptjs";
import {
  db, usersTable, areasTable, employeesTable, criteriaTable, eventsTable,
  eventParticipantsTable, eventCriteriaTable, platoonRulesTable, rulesTable,
  evaluationsTable, calibrationsTable, absencesTable, auditLogsTable,
  quarterlyResultsTable, employeeEventResultsTable, employeeQuarterEligibilityTable,
} from "@workspace/db";

async function seed() {
  console.log("🌱 Iniciando seed...");

  // Wipe in reverse-dependency order
  await db.delete(auditLogsTable);
  await db.delete(employeeQuarterEligibilityTable);
  await db.delete(employeeEventResultsTable);
  await db.delete(quarterlyResultsTable);
  await db.delete(calibrationsTable);
  await db.delete(evaluationsTable);
  await db.delete(absencesTable);
  await db.delete(eventCriteriaTable);
  await db.delete(eventParticipantsTable);
  await db.delete(eventsTable);
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
    { name: "Atendimento e Ativação", description: "Atendimento ao cliente e ativação" }, // 2
    { name: "Produção", description: "Coordenação e produção de eventos" },               // 3
    { name: "Departamento Pessoal", description: "RH e departamento pessoal" },            // 4
    { name: "Comercial", description: "Vendas, propostas e relacionamento com clientes" },// 5
    { name: "Almoxarifado", description: "Controle de estoque, ferramentas e materiais" },// 6
  ]).returning();

  console.log(`✓ ${areas.length} áreas criadas`);

  const hash = await bcrypt.hash("123456", 12);
  const users = await db.insert(usersTable).values([
    { name: "Admin Sistema", email: "admin@cenografica.com.br", passwordHash: hash, role: "admin" },
    { name: "Ana Paula RH", email: "rh@cenografica.com.br", passwordHash: hash, role: "rh", areaId: areas[4].id },
    { name: "Carlos Avaliador", email: "avaliador@cenografica.com.br", passwordHash: hash, role: "avaliador", areaId: areas[0].id },
    { name: "Diretoria Geral", email: "diretoria@cenografica.com.br", passwordHash: hash, role: "diretoria" },
    { name: "Visualizador", email: "visualizador@cenografica.com.br", passwordHash: hash, role: "visualizador" },
    { name: "Marcos Avaliador Logística", email: "avaliador2@cenografica.com.br", passwordHash: hash, role: "avaliador", areaId: areas[1].id },
    { name: "Avaliador Atendimento e Ativação", email: "avaliador.atendimento@cenografica.com.br", passwordHash: hash, role: "avaliador", areaId: areas[2].id },
    { name: "Avaliador Produção", email: "avaliador.producao@cenografica.com.br", passwordHash: hash, role: "avaliador", areaId: areas[3].id },
    { name: "Avaliador Departamento Pessoal", email: "avaliador.dp@cenografica.com.br", passwordHash: hash, role: "avaliador", areaId: areas[4].id },
    { name: "Avaliador Comercial", email: "avaliador.comercial@cenografica.com.br", passwordHash: hash, role: "avaliador", areaId: areas[5].id },
    { name: "Avaliador Almoxarifado", email: "avaliador.almoxarifado@cenografica.com.br", passwordHash: hash, role: "avaliador", areaId: areas[6].id },
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
      responsibleAreaId: areas[0].id, // Cenografia
      responsibleAreaLabel: "Cenografia",
      defaultWeight: "2",
      displayOrder: 2,
    },
    {
      name: "Qualidade da Entrega",
      description: "Avalia acabamento, materiais em bom estado, qualidade visual e satisfação na ativação/atendimento.",
      responsibleAreaId: areas[2].id, // Atendimento e Ativação
      responsibleAreaLabel: "Atendimento e Ativação",
      defaultWeight: "3",
      displayOrder: 3,
    },
    {
      name: "Obrigações Estruturais",
      description: "Avalia o cumprimento das obrigações estruturais da montagem, conforme alinhamento dos produtores de cenografia e supervisão.",
      responsibleAreaId: areas[3].id, // Produção
      responsibleAreaLabel: "Produtores de Cenografia / Sup. Ceno",
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
      responsibleAreaId: areas[3].id, // Produção
      responsibleAreaLabel: "Produção",
      defaultWeight: "3",
      displayOrder: 6,
    },
    {
      name: "Conduta e Comportamento",
      description: "Avalia uso de uniforme, EPI, envio de comprovações e fotos, horários na arena, comportamento profissional e cuidado com ferramentas.",
      responsibleAreaId: areas[4].id, // Departamento Pessoal
      responsibleAreaLabel: "Produtores locais e Departamento Pessoal",
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
    { key: "max_score", value: "5", description: "Pontuação máxima por critério (escala 0-5)" },
    { key: "min_evaluations_to_close", value: "1", description: "Mínimo de avaliações submetidas para fechar evento" },
    { key: "quarter_bonus_paid_by", value: "caju", description: "Forma de pagamento do bônus trimestral" },
  ]);

  console.log("✓ Regras do sistema criadas");

  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  const monthBase = (quarter - 1) * 3 + 1;

  const events = await db.insert(eventsTable).values([
    {
      name: "ECO RUN - MOSSORÓ",
      clientName: "ECO Events",
      location: "Centro de Eventos",
      city: "Mossoró",
      state: "RN",
      startDate: `${year}-${String(monthBase).padStart(2, "0")}-10`,
      endDate: `${year}-${String(monthBase).padStart(2, "0")}-12`,
      year, quarter,
      status: "closed",
    },
    {
      name: "EXPO CENOGRÁFICA NORDESTE",
      clientName: "Associação Industrial NE",
      location: "Centro de Convenções",
      city: "Fortaleza",
      state: "CE",
      startDate: `${year}-${String(monthBase).padStart(2, "0")}-20`,
      endDate: `${year}-${String(monthBase).padStart(2, "0")}-22`,
      year, quarter,
      status: "closed",
    },
    {
      name: "FESTIVAL CULTURAL RJ",
      clientName: "Prefeitura Municipal",
      location: "Parque Estadual",
      city: "Rio de Janeiro",
      state: "RJ",
      startDate: `${year}-${String(Math.min(12, monthBase + 1)).padStart(2, "0")}-05`,
      endDate: `${year}-${String(Math.min(12, monthBase + 1)).padStart(2, "0")}-07`,
      year, quarter,
      status: "open",
    },
    {
      name: "SHOWROOM PREMIUM SP",
      clientName: "Luxury Brands BR",
      location: "Shopping Iguatemi",
      city: "São Paulo",
      state: "SP",
      startDate: `${year}-${String(Math.min(12, monthBase + 2)).padStart(2, "0")}-15`,
      endDate: `${year}-${String(Math.min(12, monthBase + 2)).padStart(2, "0")}-17`,
      year, quarter,
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
  // pesos oficiais=[3,2,3,3,3,3,3], notas=[4,4,4,3,2,3,5]
  //   = 3×4+2×4+3×4+3×3+3×2+3×3+3×5 = 12+8+12+9+6+9+15 = 71
  const exampleScores = [4, 4, 4, 3, 2, 3, 5];
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
        comments: score < 3 ? "Ponto de atenção do time neste critério — reforçar na próxima missão." : null,
        commentVisibility: "internal",
        status: "submitted",
        submittedAt: new Date(),
      });
    }
  }

  console.log("✓ Avaliações do time criadas (resultado do evento esperado: 71/100)");

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
    date: `${year}-${String(monthBase).padStart(2, "0")}-11`,
    year,
    quarter,
    quantity: 1,
    reason: "Falta justificada",
    registeredByUserId: users[1].id,
  });

  console.log("✓ Ausências seed criadas");
  console.log("\n✅ Seed concluído com sucesso!");
  console.log("\n📊 Validação de cálculo:");
  console.log("   Pesos oficiais: [3,2,3,3,3,3,3], Notas: [4,4,4,3,2,3,5]");
  console.log("   Esperado: 71 | Resultado:", [3,2,3,3,3,3,3].reduce((s, w, i) => s + w * [4,4,4,3,2,3,5][i], 0));
  console.log("\n👤 Usuários criados (senha: 123456):");
  users.forEach((u: typeof users[number]) => console.log(`   ${u.email} — ${u.role}`));
}

seed().catch(console.error).finally(() => process.exit(0));
