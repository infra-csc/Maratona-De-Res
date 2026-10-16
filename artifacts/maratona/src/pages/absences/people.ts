import type { Absence } from "@workspace/api-client-react";
import { scoreEffect, totalPoints } from "./helpers";
import type { EmployeeScore } from "./types";

/** Lançamentos de um colaborador somados: o que a nota dele sente. */
export interface PersonImpact {
  employeeId: number;
  name: string;
  penaltyCount: number;
  meritCount: number;
  penaltyPoints: number;
  meritPoints: number;
  /** Saldo (penalidades − méritos): positivo desconta da nota. */
  net: number;
  events: number | null;
  /** Saldo ÷ eventos, com sinal: positivo = desconto. */
  effect: number | null;
  score: EmployeeScore | undefined;
}

export function buildPeople(rows: Absence[], scores: Map<number, EmployeeScore>): PersonImpact[] {
  const by = new Map<number, PersonImpact>();
  for (const a of rows) {
    let p = by.get(a.employeeId);
    if (!p) {
      const score = scores.get(a.employeeId);
      p = {
        employeeId: a.employeeId, name: a.employeeName ?? "Colaborador",
        penaltyCount: 0, meritCount: 0, penaltyPoints: 0, meritPoints: 0, net: 0,
        events: score?.eventsCount ?? null, effect: null, score,
      };
      by.set(a.employeeId, p);
    }
    const pts = totalPoints(a);
    if (a.kind === "merit") { p.meritCount += 1; p.meritPoints += pts; } else { p.penaltyCount += 1; p.penaltyPoints += pts; }
  }
  const list = [...by.values()];
  for (const p of list) {
    p.net = p.penaltyPoints - p.meritPoints;
    const e = scoreEffect(Math.abs(p.net), p.events);
    p.effect = e == null ? null : (p.net >= 0 ? e : -e);
  }
  // Quem a nota mais sente primeiro (desconto maior no topo; méritos no fim).
  return list.sort((a, b) => (b.effect ?? b.net / 1000) - (a.effect ?? a.net / 1000) || a.name.localeCompare(b.name, "pt-BR"));
}
