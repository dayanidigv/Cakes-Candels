import { AuditAction } from '@prisma/client';

export interface LogisticsAuditLogParams {
  entity: string;
  entityId: string;
  action: AuditAction;
  performedBy: string;
  branchId: string;
  before?: any;
  after?: any;
}

export async function writeLogisticsAuditLog(tx: any, params: LogisticsAuditLogParams) {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const performedBy = isUuid.test(params.performedBy)
      ? params.performedBy
      : '00000000-0000-0000-0000-000000000000';
    const branchId = isUuid.test(params.branchId)
      ? params.branchId
      : '00000000-0000-0000-0000-000000000000';

    await tx.auditLog.create({
      data: {
        module: 'LOGISTICS',
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
