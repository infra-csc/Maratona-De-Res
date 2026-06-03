import bcrypt from "bcryptjs";
import {
  db, usersTable, areasTable, employeesTable, criteriaTable, eventsTable,
  eventParticipantsTable, eventCriteriaTable, platoonRulesTable, rulesTable,
  evaluationsTable, calibrationsTable, absencesTable,
} from "@workspace/db";

async function seed() {
  console.log("🌱 Iniciando seed...");

  const areas = await db.insert(areasTable).values([
    { name: "Cenografia", description: "Equipe de cenografia e montagem" },
    { name: "Iluminação", description: "Equipe de iluminação técnica" },
    { name: "Sonorização", description: "Equipe de áudio e som" },
    { name: "Produção", description: "Coordenação e produção de eventos" },
    { name: "Logística", description: "Transporte e logística operacional" },
    { name: "TI", description: "Tecnologia da informação e sistemas" },
    { name: "Gestão de Pessoas", description: "RH e desenvolvimento humano" },
  ]).returning();

  console.log(`✓ ${areas.length} áreas criadas`);

  const hash = await bcrypt.hash("123456", 12);
  const users = await db.insert(usersTable).values([
    { name: "Admin Sistema", email: "admin@cenografica.com.br", passwordHash: hash, role: "admin" },
    { name: "Ana Paula RH", email: "rh@cenografica.com.br", passwordHash: hash, role: "rh", areaId: areas[6].id },
    { name: "Carlos Avaliador", email: "avaliador@cenografica.com.br", passwordHash: hash, role: "avaliador", areaId: areas[0].id },
    { name: "Diretoria Geral", email: "diretoria@cenografica.com.br", passwordHash: hash, role: "diretoria" },
    { name: "Visualizador", email: "visualizador@cenografica.com.br", passwordHash: hash, role: "visualizador" },
    { name: "Marcos Supervisor", email: "supervisor@cenografica.com.br", passwordHash: hash, role: "avaliador", areaId: areas[3].id },
  ]).returning();

  console.log(`✓ ${users.length} usuários criados`);

  const employees = await db.insert(employeesTable).values([
    { name: "Adriano Santos", department: "Cenografia", functionName: "Montador Senior" },
    { name: "Beatriz Lima", department: "Iluminação", functionName: "Técnica de Iluminação" },
    { name: "Carlos Eduardo Ferreira", department: "Sonorização", functionName: "Operador de Som" },
    { name: "Diana Carvalho", department: "Produção", functionName: "Coordenadora de Eventos" },
    { name: "Eduardo Nascimento", department: "Logística", functionName: "Motorista/Auxiliar" },
    { name: "Fernanda Costa", department: "Cenografia", functionName: "Montadora" },
    { name: "Gabriel Ribeiro", department: "Iluminação", functionName: "Técnico de Iluminação" },
    { name: "Helena Alves", department: "Produção", functionName: "Assistente de Produção" },
    { name: "Igor Mendes", department: "Cenografia", functionName: "Montador" },
    { name: "Juliana Pereira", department: "Sonorização", functionName: "Técnica de Áudio" },
    { name: "Lucas Oliveira", department: "Logística", functionName: "Auxiliar Logístico" },
    { name: "Mariana Souza", department: "Cenografia", functionName: "Montadora Senior" },
  ]).returning();

  console.log(`✓ ${employees.length} colaboradores criados`);

  const criteria = await db.insert(criteriaTable).values([
    { name: "Pontualidade", description: "Chegar no horário e cumprir prazos", responsibleAreaId: areas[6].id, defaultWeight: "3", displayOrder: 1 },
    { name: "Qualidade do Trabalho", description: "Excelência na execução das tarefas", responsibleAreaId: areas[0].id, defaultWeight: "4", displayOrder: 2 },
    { name: "Trabalho em Equipe", description: "Colaboração e espírito de equipe", responsibleAreaId: areas[6].id, defaultWeight: "3", displayOrder: 3 },
    { name: "Segurança", description: "Cumprimento de normas de segurança do trabalho", responsibleAreaId: areas[3].id, defaultWeight: "4", displayOrder: 4 },
    { name: "Proatividade", description: "Iniciativa e antecipação de problemas", responsibleAreaId: areas[6].id, defaultWeight: "2", displayOrder: 5 },
    { name: "Comunicação", description: "Clareza e eficiência na comunicação", responsibleAreaId: areas[6].id, defaultWeight: "2", displayOrder: 6 },
    { name: "Adaptabilidade", description: "Flexibilidade para lidar com mudanças", responsibleAreaId: areas[3].id, defaultWeight: "2", displayOrder: 7 },
  ]).returning();

  console.log(`✓ ${criteria.length} critérios criados`);

  await db.insert(platoonRulesTable).values([
    { name: "Pelotão Quênia", color: "#dc2626", minScore: "0.80", maxScore: "1.01", minInclusive: true, maxInclusive: false, bonusValue: "300.00", description: "Top performers — bônus máximo Caju", displayOrder: 1 },
    { name: "Pelotão Azul", color: "#2563eb", minScore: "0.60", maxScore: "0.80", minInclusive: true, maxInclusive: false, bonusValue: "200.00", description: "Alta performance", displayOrder: 2 },
    { name: "Pelotão Verde", color: "#16a34a", minScore: "0.40", maxScore: "0.60", minInclusive: true, maxInclusive: false, bonusValue: "100.00", description: "Boa performance", displayOrder: 3 },
    { name: "Pelotão Branco", color: "#64748b", minScore: "0.00", maxScore: "0.40", minInclusive: true, maxInclusive: false, bonusValue: "0.00", description: "Precisa melhorar", displayOrder: 4 },
  ]);

  console.log("✓ Regras de pelotão criadas");

  await db.insert(rulesTable).values([
    { key: "absence_penalty_per_absence", value: "0.01", description: "Penalidade por falta (desconto no resultado final, em decimal)" },
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
      name: "Evento Corporativo Tech Summit",
      clientName: "TechCorp Brasil",
      location: "Expo Center Norte",
      city: "São Paulo",
      state: "SP",
      startDate: `${year}-${String(monthBase).padStart(2, "0")}-10`,
      endDate: `${year}-${String(monthBase).padStart(2, "0")}-12`,
      year, quarter,
      status: "closed",
    },
    {
      name: "Feira Industrial Nordeste",
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
      name: "Festival Cultural Cenográfica",
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
      name: "Showroom Produtos Premium",
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
      criteria.map((c: typeof criteria[number]) => ({ eventId: ev.id, criterionId: c.id, active: true }))
    );
  }

  console.log("✓ Participantes e critérios dos eventos configurados");

  const evaluatorUserId = users[2].id;
  const closedEvents = events.filter(e => e.status === "closed");
  const evalScores = [4.5, 4.0, 3.5, 5.0, 3.0, 4.0, 4.5, 4.0, 3.5, 4.5, 4.0, 5.0, 4.5, 3.5];
  let scoreIdx = 0;

  for (const ev of closedEvents) {
    for (const emp of participantSubset) {
      for (const c of criteria) {
        const score = evalScores[scoreIdx++ % evalScores.length];
        const comments = score < 3 ? "Necessita melhorar neste critério" : null;
        await db.insert(evaluationsTable).values({
          eventId: ev.id,
          employeeId: emp.id,
          criterionId: c.id,
          evaluatorUserId,
          score: String(score),
          comments,
          status: "submitted",
          submittedAt: new Date(),
        });
      }
    }
  }

  console.log("✓ Avaliações seed criadas para eventos fechados");

  for (const ev of closedEvents) {
    for (const emp of participantSubset.slice(0, 4)) {
      for (const c of criteria.slice(0, 3)) {
        await db.insert(calibrationsTable).values({
          eventId: ev.id,
          employeeId: emp.id,
          criterionId: c.id,
          originalAverageScore: String(4.0),
          calibratedScore: String(4.2),
          calibrationReason: "Calibração de alinhamento pelo comitê de RH",
          calibratedByUserId: users[0].id,
        });
      }
    }
  }

  console.log("✓ Calibrações seed criadas");

  for (const emp of employees.slice(0, 5)) {
    await db.insert(absencesTable).values({
      employeeId: emp.id,
      eventId: closedEvents[0]?.id ?? null,
      date: `${year}-${String(monthBase).padStart(2, "0")}-11`,
      year,
      quarter,
      quantity: 1,
      reason: "Falta justificada",
      registeredByUserId: users[1].id,
    });
  }

  console.log("✓ Ausências seed criadas");
  console.log("\n✅ Seed concluído com sucesso!");
  console.log("\n👤 Usuários criados (senha: 123456):");
  users.forEach((u: typeof users[number]) => console.log(`   ${u.email} — ${u.role}`));
}

seed().catch(console.error).finally(() => process.exit(0));
