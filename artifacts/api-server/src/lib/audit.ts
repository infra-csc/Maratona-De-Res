import { AsyncLocalStorage } from "node:async_hooks";
import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db";
import { logger } from "./logger.js";

/**
 * Contexto do ator real da requisição. requireAuth o preenche quando o token é
 * de impersonação ("Modo Dev"), para que toda chamada a audit() — que recebe
 * o userId do usuário impersonado — grave também o admin que de fato agiu,
 * sem precisar mudar as ~100 chamadas espalhadas pelas rotas.
 */
interface AuditActorContext { impersonatorId: number | null }
const actorContext = new AsyncLocalStorage<AuditActorContext>();

export function runWithAuditActor<T>(ctx: AuditActorContext, fn: () => T): T {
  return actorContext.run(ctx, fn);
}

export function currentImpersonatorId(): number | null {
  return actorContext.getStore()?.impersonatorId ?? null;
}

export async function audit(
  userId: number | null,
  action: string,
  entity: string,
  entityId?: string | number,
  before?: unknown,
  after?: unknown,
) {
  try {
    const impersonatorId = currentImpersonatorId();
    await db.insert(auditLogsTable).values({
      userId,
      // Só envia a coluna quando há impersonação: um banco ainda sem a migração
      // 0001 continua gravando a auditoria normal.
      ...(impersonatorId != null ? { impersonatorUserId: impersonatorId } : {}),
      action,
      entity,
      entityId: entityId ? String(entityId) : null,
      beforeJson: before ? JSON.stringify(before) : null,
      afterJson: after ? JSON.stringify(after) : null,
    });
  } catch (err) {
    // Non-blocking — audit failures shouldn't break the main flow, but a
    // silent failure on a financial action is worse than a log line.
    logger.error({ err, action, entity, entityId }, "audit: falha ao gravar trilha");
  }
}
