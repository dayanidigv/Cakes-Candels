import { AuditAction } from '@prisma/client';

export interface AuditLogParams {
  module?: string;
  entity: string;
  entityId: string;
  action: AuditAction;
  performedBy: string;
  branchId?: string;
  before?: any;
  after?: any;
}

export interface OutboxParams {
  type: string;
  payload: Record<string, any>;
}

export async function writeHrAuditLog(tx: any, params: AuditLogParams) {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const performedBy = isUuid.test(params.performedBy)
      ? params.performedBy
      : '00000000-0000-0000-0000-000000000000';
    const branchId = params.branchId && isUuid.test(params.branchId)
      ? params.branchId
      : '00000000-0000-0000-0000-000000000000';

    await tx.auditLog.create({
      data: {
        module: params.module ?? 'HR',
        entity: params.entity,
        entityId: params.entityId,
        action: params.action,
        performedBy,
        branchId,
        before: params.before ? JSON.parse(JSON.stringify(params.before)) : undefined,
        after: params.after ? JSON.parse(JSON.stringify(params.after)) : undefined,
      },
    });
  } catch {
    // Non-fatal audit capture failure
  }
}

export async function writeHrOutboxEvent(tx: any, params: OutboxParams) {
  try {
    const eventId = `evt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    await tx.outboxEvent.create({
      data: {
        eventId,
        type: params.type,
        payload: params.payload,
        status: 'PENDING',
      },
    });
  } catch {
    // Non-fatal outbox capture failure
  }
}
