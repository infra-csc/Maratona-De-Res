import type { scoreChangesTable } from "@workspace/db";
import { redact } from "./audit-view.js";

/**
 * Linha do tempo da nota — o que gravar a cada recálculo do ciclo.
 * Função pura: compara o retrato de antes com o de depois, por colaborador,
 * e devolve uma linha por quem mudou (nota final, faixa, bônus, eventos ou
 * elegibilidade). Quem não mudou não gera linha.
 */

export interface ScoreSnapshot {
  employeeId: number;
  finalResult: string | number | null;
  platoon: string | null;
  bonusValue: string | number | null;
  eventsCount: number | null;
  eligible: boolean | null;
}

export interface ChangeCause { action: string; entity: string; entityId: string | null; detail: unknown }

type ScoreChangeInsert = typeof scoreChangesTable.$inferInsert;

const num = (v: string | number | null | undefined) => (v == null ? null : Number(v));
const str = (v: number | null) => (v == null ? null : v.toFixed(2));

export function diffScoreSnapshots(
  cycleId: number,
  before: ScoreSnapshot[],
  after: ScoreSnapshot[],
  userId: number | null,
  cause: ChangeCause | null,
): ScoreChangeInsert[] {
  const prev = new Map(before.map(b => [b.employeeId, b]));
  const next = new Map(after.map(a => [a.employeeId, a]));
  const ids = [...new Set([...prev.keys(), ...next.keys()])].sort((a, b) => a - b);
  const detail = cause?.detail != null ? JSON.stringify(redact(cause.detail)) : null;
  const out: ScoreChangeInsert[] = [];
  for (const employeeId of ids) {
    const b = prev.get(employeeId);
    const a = next.get(employeeId);
    const fb = num(b?.finalResult), fa = num(a?.finalResult);
    const bb = num(b?.bonusValue), ba = num(a?.bonusValue);
    const changed =
      fb !== fa || (b?.platoon ?? null) !== (a?.platoon ?? null) || bb !== ba ||
      (b?.eventsCount ?? null) !== (a?.eventsCount ?? null) || (b?.eligible ?? null) !== (a?.eligible ?? null);
    if (!changed) continue;
    out.push({
      cycleId, employeeId,
      userId: userId && userId > 0 ? userId : null,
      causeAction: cause?.action ?? null,
      causeEntity: cause?.entity ?? null,
      causeEntityId: cause?.entityId ?? null,
      causeDetail: detail,
      finalBefore: str(fb), finalAfter: str(fa),
      platoonBefore: b?.platoon ?? null, platoonAfter: a?.platoon ?? null,
      bonusBefore: str(bb), bonusAfter: str(ba),
      eventsBefore: b?.eventsCount ?? null, eventsAfter: a?.eventsCount ?? null,
      eligibleBefore: b?.eligible ?? null, eligibleAfter: a?.eligible ?? null,
    });
  }
  return out;
}
