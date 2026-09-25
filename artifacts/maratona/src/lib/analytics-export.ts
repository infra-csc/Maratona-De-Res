import type { AnalyticsOverview } from "@workspace/api-client-react";

/** Nome de arquivo seguro a partir do nome do ciclo ("Ciclo 2 · 2026" → "ciclo-2-2026"). */
export function cycleSlug(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

const r1 = (v: number | null | undefined) => (v == null ? null : Math.round(v * 10) / 10);

/**
 * Planilha da tela de Análises: uma aba por bloco, com cabeçalhos em português.
 * O xlsx é carregado só quando o usuário exporta (não pesa na tela).
 */
export async function exportAnalyticsXlsx(data: AnalyticsOverview): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: Record<string, unknown>[]) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "Sem dados": "" }]);
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  const k = data.kpis;

  add("Resumo", [
    { Indicador: "Ciclo", Valor: data.cycle.name },
    { Indicador: "Período", Valor: data.cycle.startDate && data.cycle.endDate ? `${data.cycle.startDate} a ${data.cycle.endDate}` : "" },
    { Indicador: "Nota final média (colaboradores)", Valor: r1(k.avgFinalResult) },
    { Indicador: "Nota média dos eventos", Valor: r1(k.avgEventScore) },
    { Indicador: "Eventos no ciclo", Valor: k.eventsTotal },
    { Indicador: "Eventos confirmados", Valor: k.eventsConfirmed },
    { Indicador: "Colaboradores no ranking", Valor: k.collaborators },
    { Indicador: `Atingiram ${k.minEvents} eventos`, Valor: k.reachedMinEvents },
    { Indicador: "Elegíveis ao bônus", Valor: k.eligible },
    { Indicador: "Com bônus", Valor: k.withBonus },
    { Indicador: "Bônus projetado (R$)", Valor: k.bonusTotal },
    { Indicador: "Avaliações enviadas", Valor: k.evaluationsSubmitted },
    { Indicador: "Avaliações em rascunho", Valor: k.evaluationsDraft },
    { Indicador: "Critérios calibrados", Valor: k.calibratedCriteria },
    { Indicador: "Ajuste médio da calibração (pts)", Valor: r1(k.avgCalibrationShift) },
    { Indicador: "Penalidades lançadas", Valor: k.penaltiesCount },
    { Indicador: "Méritos lançados", Valor: k.meritsCount },
  ]);
  add("Evolução", data.scoreTrend.map(t => ({ "Fim de semana": t.label, "Nota média": t.avgScore, Eventos: t.events })));
  add("Critérios", data.criteria.map(c => ({
    Critério: c.name, Área: c.area ?? "", "Nota usada": c.avgScore, "Média dos avaliadores": c.evaluatorAvg,
    "Média calibrada": c.calibratedAvg, "Calibrados": c.calibratedCount, Eventos: c.eventsCount,
  })));
  add("Conformidade", data.conformity.map(c => ({ Item: c.label, Respostas: c.answered, "Não": c.nao, "% Não": c.naoPct })));
  add("Faixas", data.faixas.map(f => ({
    Faixa: f.name, "Nota mínima": f.minScore, "Nota máxima": f.maxScore, "Bônus base (R$)": f.bonusValue,
    "Por evento extra (R$)": f.bonusPerExtraEvent, Pessoas: f.count, "Bônus projetado (R$)": f.bonusTotal,
  })));
  add("Funil", data.funnel.map(f => ({ Etapa: f.label, Pessoas: f.count })));
  add("Perto da próxima faixa", data.nearNextFaixa.map(r => ({
    Colaborador: r.name, "Nota final": r.finalResult, "Faixa atual": r.currentFaixa ?? "", "Próxima faixa": r.nextFaixa,
    "Faltam (pts)": r.gap, "Bônus hoje (R$)": r.currentBonus, "Na próxima (R$)": r.potentialBonus,
  })));
  add("Avaliadores", data.evaluators.map(e => ({
    Avaliador: e.name, Enviadas: e.submitted, Rascunhos: e.drafts, "Nota média dada": e.avgGiven,
    "Ajuste da calibração (pts)": e.calibrationBias, "Casos calibrados": e.biasSamples, "Dias até enviar": e.avgDaysToSubmit,
  })));
  add("Penalidades e méritos", data.adjustments.map(a => ({
    Tipo: a.kind === "merit" ? "Mérito" : "Penalidade", Lançamento: a.label, Ocorrências: a.occurrences, Pontos: a.points, Pessoas: a.employees,
  })));
  add("Clientes", data.clients.map(c => ({ Cliente: c.client, "Nota média": c.avgScore, Eventos: c.events })));

  XLSX.writeFile(wb, `analises-${cycleSlug(data.cycle.name)}.xlsx`);
}

/** Planilha do relatório por evento: Eventos, Critérios por evento e Equipes (só confirmados). */
export async function exportEventsReportXlsx(report: import("@workspace/api-client-react").EventsReport): Promise<void> {
  const XLSX = await import("xlsx");
  const br = (d: string | null | undefined) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "");
  const n2 = (v: number | null | undefined) => (v == null ? "" : Math.round(v * 100) / 100);
  const events = report.events.filter(e => e.resultsConfirmed && e.finalScore != null)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name, "pt-BR"));
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: Record<string, unknown>[], widths: number[]) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "Sem dados": "" }]);
    ws["!cols"] = widths.map(wch => ({ wch }));
    if (rows.length) ws["!autofilter"] = { ref: ws["!ref"] as string };
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add("Eventos", events.map(e => ({
    Data: br(e.startDate), Evento: e.name, Cliente: e.clientName ?? "", Local: [e.city, e.state].filter(Boolean).join("/"),
    Tipo: e.isHistorical ? "Importado (nota pronta)" : "Avaliado no app",
    "Nota final oficial (0-100)": n2(e.finalScore), "Performance (0-100)": e.isHistorical ? "" : n2(e.performanceScore),
    "Desconto da matriz (pts)": e.isHistorical ? "" : n2(e.conformityPenalty),
    "Critérios calibrados": e.isHistorical ? "" : `${e.calibratedCriteria}/${e.totalCriteria}`,
    "Equipe (contam para nota)": e.team.filter(t => t.countsForScore).length, "Equipe (total)": e.team.length,
  })), [11, 46, 20, 16, 22, 14, 12, 12, 11, 12, 10]);
  add("Critérios por evento", events.flatMap(e => e.criteria.map(c => ({
    Data: br(e.startDate), Evento: e.name, Critério: c.name, Área: c.area ?? "", Peso: c.weight,
    "Média dos avaliadores (0-10)": n2(c.evaluatorAvg), "Calibrada pelo RH (0-10)": n2(c.calibrated), "Nota usada (0-10)": n2(c.used),
    "Justificativa da calibração": c.calibrationReason ?? "",
    "Conta na nota": c.weight > 0 ? "Sim" : "Não (peso 0)",
  }))), [11, 46, 34, 16, 6, 12, 12, 10, 50, 14]);
  add("Equipes", events.flatMap(e => e.team.map(t => ({
    Data: br(e.startDate), Evento: e.name, Colaborador: t.name, "Função no evento": t.functionName ?? "",
    Vínculo: t.employmentType === "freela" ? "Freela" : t.employmentType === "casa" ? "Casa" : (t.employmentType ?? ""),
    "Conta para a nota": t.countsForScore ? "Sim" : "Não", "Nota final do evento (0-100)": n2(e.finalScore),
  }))), [11, 46, 38, 26, 8, 10, 12]);
  XLSX.writeFile(wb, `relatorio-por-evento-${cycleSlug(report.cycle.name)}.xlsx`);
}
