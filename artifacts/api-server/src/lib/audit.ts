import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db";

export async function audit(
  userId: number | null,
  action: string,
  entity: string,
  entityId?: string | number,
  before?: unknown,
  after?: unknown,
) {
  try {
    await db.insert(auditLogsTable).values({
      userId,
      action,
      entity,
      entityId: entityId ? String(entityId) : null,
      beforeJson: before ? JSON.stringify(before) : null,
      afterJson: after ? JSON.stringify(after) : null,
    });
  } catch {
    // Non-blocking — audit failures shouldn't break the main flow
  }
}
