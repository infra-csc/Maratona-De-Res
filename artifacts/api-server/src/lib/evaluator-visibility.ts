import { db, evaluationsTable, criteriaTable, eventsTable, cyclesTable, eventAreaAssignmentsTable, auditLogsTable } from "@workspace/db";
import { and, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { getUserAreaId } from "./area-evaluation.js";
import { getPrincipalAreaIds } from "../routes/routing.js";

/**
 * Que avaliações o AVALIADOR enxerga (regra do dono: só o que foi avaliado da
 * SUA área) — a mesma regra em GET /evaluations e no áudio (/storage, B2):
 *  - as PRÓPRIAS (rascunho inclusive);
 *  - de outras pessoas, só as ENVIADAS: da área do próprio cadastro e, no
 *    fluxo antigo (ciclo sem avaliação por área), da área em que foi
 *    designado NAQUELE evento e das áreas em que é o avaliador principal.
 *    No ciclo por área só a área do cadastro conta (A1, 4ª revisão).
 * Condição SQL: exige `evaluations` e `criteria` (join por criterion_id) na consulta.
 */
export async function evaluatorVisibleEvaluationsSql(userId: number): Promise<SQL> {
  const [ownAreaId, principalAreaIds] = await Promise.all([getUserAreaId(userId), getPrincipalAreaIds(userId)]);
  return or(
    eq(evaluationsTable.evaluatorUserId, userId),
    and(
      eq(evaluationsTable.status, "submitted"),
      or(
        ownAreaId != null ? eq(criteriaTable.responsibleAreaId, ownAreaId) : sql`false`,
        // Designação de área no evento: só no fluxo antigo. No ciclo por área a
        // designação não dá acesso (D2) — nem visibilidade (A1, 4ª revisão).
        sql`(EXISTS (SELECT 1 FROM ${eventAreaAssignmentsTable} eaa
                      WHERE eaa.event_id = ${evaluationsTable.eventId}
                        AND eaa.area_id = ${criteriaTable.responsibleAreaId}
                        AND eaa.evaluator_user_id = ${userId})
             AND NOT EXISTS (SELECT 1 FROM ${eventsTable} ae JOIN ${cyclesTable} ac ON ac.id = ae.cycle_id
                              WHERE ae.id = ${evaluationsTable.eventId} AND ac.area_evaluation))`,
        principalAreaIds.length > 0
          ? and(
              inArray(criteriaTable.responsibleAreaId, principalAreaIds),
              sql`NOT EXISTS (SELECT 1 FROM ${eventsTable} pe JOIN ${cyclesTable} pc ON pc.id = pe.cycle_id
                               WHERE pe.id = ${evaluationsTable.eventId} AND pc.area_evaluation)`,
            )
          : sql`false`,
      ),
    ),
  )!;
}

/**
 * B2: o avaliador pode ouvir este áudio? Só se ele for de uma avaliação que
 * ele enxerga (regra acima) ou se foi ELE quem acabou de gravá-lo (o upload é
 * registrado na auditoria — o áudio recém-gravado ainda não está em
 * avaliação nenhuma e a tela toca para conferir).
 */
export async function evaluatorCanHearAudio(userId: number, objectPath: string): Promise<boolean> {
  const visible = await evaluatorVisibleEvaluationsSql(userId);
  const [row] = await db.select({ id: evaluationsTable.id }).from(evaluationsTable)
    .leftJoin(criteriaTable, eq(evaluationsTable.criterionId, criteriaTable.id))
    .where(and(eq(evaluationsTable.audioUrl, objectPath), visible))
    .limit(1);
  if (row) return true;
  const [own] = await db.select({ id: auditLogsTable.id }).from(auditLogsTable)
    .where(and(eq(auditLogsTable.entity, "storage_audio"), eq(auditLogsTable.entityId, objectPath), eq(auditLogsTable.userId, userId), eq(auditLogsTable.action, "upload_audio")))
    .limit(1);
  return !!own;
}
