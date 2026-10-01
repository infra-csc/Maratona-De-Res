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
interface AuditActorContext {
  impersonatorId: number | null;
  /**
   * Última ação auditada NESTA requisição. O recálculo do ciclo lê daqui o
   * motivo de cada mudança de nota (linha do tempo), sem precisar mudar as ~30
   * chamadas de recomputeCycleResults.
   */
  lastAction?: { action: string; entity: string; entityId: string | null; detail: unknown };
}
const actorContext = new AsyncLocalStorage<AuditActorContext>();

export function runWithAuditActor<T>(ctx: AuditActorContext, fn: () => T): T {
  return actorContext.run(ctx, fn);
}

export function currentImpersonatorId(): number | null {
  return actorContext.getStore()?.impersonatorId ?? null;
}

export function currentLastAction(): AuditActorContext["lastAction"] | null {
  return actorContext.getStore()?.lastAction ?? null;
}

/**
 * Define o "motivo" que o próximo recálculo grava na linha do tempo quando a
 * requisição fez VÁRIAS ações (ex.: confirmar em lote) — sem isso, todo
 * mundo herdava a última ação auditada (o último evento da lista).
 */
export function setRecomputeCause(cause: NonNullable<AuditActorContext["lastAction"]>): void {
  const store = actorContext.getStore();
  if (store) store.lastAction = cause;
}

export async function audit(
  userId: number | null,
  action: string,
  entity: string,
  entityId?: string | number,
  before?: unknown,
  after?: unknown,
) {
  const store = actorContext.getStore();
  if (store) store.lastAction = { action, entity, entityId: entityId != null ? String(entityId) : null, detail: after ?? before ?? null };
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
