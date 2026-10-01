import { roundFinalResult } from "./calculations.js";

/**
 * Linha do tempo da nota de UM colaborador num ciclo (só gestão).
 *
 * Três fontes, numa lista só, em ordem de data:
 *  - "recorded": cada recálculo grava o antes → depois (tabela score_changes)
 *    com a ação que causou — exato, a partir de quando passou a existir;
 *  - "reconstructed": antes disso, a nota é REMONTADA repassando em ordem os
 *    eventos que entraram na nota (data da confirmação) e as penalidades e
 *    méritos (data do lançamento), com as notas de evento de HOJE;
 *  - "info": calibrações e publicações da auditoria nos eventos dele — não
 *    mudam a nota sozinhas (a publicação é que recalcula), mas explicam o salto.
 */

export interface TimelineEventFact { eventId: number; name: string; at: string; score: number }
export interface TimelineAdjustmentFact { id: number; at: string; kind: "penalty" | "merit"; label: string; points: number; quantity: number; reason: string | null; eventName: string | null; by: string | null }
export interface PlatoonLike { name: string; color: string | null; minScore: number }

export interface TimelineEntry {
  id: string;
  at: string;
  kind: "recorded" | "reconstructed" | "info";
  type: string;
  employeeId?: number | null;
  employeeName?: string | null;
  eventId?: number | null;
  eventName?: string | null;
  criterionName?: string | null;
  label?: string | null;
  reason?: string | null;
  by?: string | null;
  eventScore?: number | null;
  points?: number | null;
  scoreBefore?: number | null;
  scoreAfter?: number | null;
  finalBefore?: number | null;
  finalAfter?: number | null;
  platoonBefore?: string | null;
  platoonAfter?: string | null;
  bonusBefore?: number | null;
  bonusAfter?: number | null;
  eventsBefore?: number | null;
  eventsAfter?: number | null;
  eligibleBefore?: boolean | null;
  eligibleAfter?: boolean | null;
}

export function platoonFor(score: number | null, rules: PlatoonLike[]): string | null {
  if (score == null) return null;
  let name: string | null = null;
  for (const r of [...rules].sort((a, b) => a.minScore - b.minScore)) if (score >= r.minScore) name = r.name;
  return name;
}

/**
 * Repassa eventos e ajustes em ordem e devolve um passo por fato, com a nota
 * final de antes e de depois (mesma conta do recálculo: (soma − penalidades +
 * méritos) ÷ N, travada em 0..100, 1 casa arredondada uma vez).
 * Só devolve fatos ANTES de `until` (quando o registro exato começou).
 */
export function reconstructSteps(
  events: TimelineEventFact[],
  adjustments: TimelineAdjustmentFact[],
  rules: PlatoonLike[],
  until: string | null,
): TimelineEntry[] {
  type Fact = { at: string; ev?: TimelineEventFact; adj?: TimelineAdjustmentFact };
  const facts: Fact[] = [
    ...events.map(ev => ({ at: ev.at, ev })),
    ...adjustments.map(adj => ({ at: adj.at, adj })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  let sum = 0, n = 0, net = 0;
  const final = () => (n > 0 ? Math.min(100, Math.max(0, roundFinalResult((sum - net) / n))) : null);
  const out: TimelineEntry[] = [];
  for (const f of facts) {
    const before = final();
    if (f.ev) { sum += f.ev.score; n += 1; } else if (f.adj) { net += (f.adj.kind === "merit" ? -1 : 1) * f.adj.points * f.adj.quantity; }
    const after = final();
    if (until && f.at >= until) continue; // daqui em diante vale o registro exato
    const base = { at: f.at, kind: "reconstructed" as const, finalBefore: before, finalAfter: after, platoonBefore: platoonFor(before, rules), platoonAfter: platoonFor(after, rules), eventsBefore: n - (f.ev ? 1 : 0), eventsAfter: n };
    if (f.ev) {
      out.push({ ...base, id: `ev-${f.ev.eventId}`, type: "event_counted", eventId: f.ev.eventId, eventName: f.ev.name, eventScore: f.ev.score });
    } else if (f.adj) {
      out.push({ ...base, id: `adj-${f.adj.id}`, type: f.adj.kind, label: f.adj.label, points: f.adj.points * f.adj.quantity, reason: f.adj.reason, eventName: f.adj.eventName, by: f.adj.by });
    }
  }
  return out;
}
