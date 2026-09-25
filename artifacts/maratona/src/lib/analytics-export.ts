import type { AnalyticsOverview } from "@workspace/api-client-react";

/** Nome de arquivo seguro a partir do nome do ciclo ("Ciclo 2 · 2026" → "ciclo-2-2026"). */
export function cycleSlug(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
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
