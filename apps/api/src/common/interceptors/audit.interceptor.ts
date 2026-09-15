import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { prisma, AuditAction, AuditLogRepository } from '@cc-erp/database';

// Fallback IDs for development mode (DevToken)
const DEV_USER_ID = 'dff98468-ca1a-4817-88e1-0823f081a018';
const DEV_BRANCH_ID = '00000000-0000-0000-0000-000000000000';

// All resources tracked by the audit interceptor
const TRACKED_RESOURCES = [
  'organizations',
  'branches',
  'pos-registers',
  'roles',
  'settings',
  'feature-flags',
  'users',
  // Sprint 2.5 Masters
  'product-attributes',
  'values',
  'recipe-masters',
  'versions',
  'approval-workflows',
  'steps',
  'supplier-items',
  'number-series',
  'notification-templates',
  'reason-masters',
  'payment-methods',
  'vehicles',
  'designations',
  'tax-rule',
];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly auditLogRepository = new AuditLogRepository();

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const method = request.method;

    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const path = request.url;
    const segments = path.split('/').filter(Boolean);
    // Find the LAST matched resource (e.g. for /product-attributes/123/values/456, choose values)
    const trackedSegments = segments.filter((s) => TRACKED_RESOURCES.includes(s));
    const resource = trackedSegments[trackedSegments.length - 1];

    if (!resource) {
      return next.handle();
    }

    const entityName = this.mapResourceToEntity(resource);
    const moduleName = this.mapResourceToModule(resource);
    
    // Resolve entityId based on param name convention (id for parent, valueId/versionId/stepId for child)
    let entityId = null;
    if (resource === 'values') entityId = request.params.valueId || null;
    else if (resource === 'versions') entityId = request.params.versionId || null;
    else if (resource === 'steps') entityId = request.params.stepId || null;
    else entityId = request.params.id || null;

    let action: AuditAction = AuditAction.CREATE;
    if (method === 'PATCH' || method === 'PUT') action = AuditAction.UPDATE;
    else if (method === 'DELETE') action = AuditAction.DELETE;

    let beforeState: any = null;
    if (entityId && (action === AuditAction.UPDATE || action === AuditAction.DELETE)) {
      beforeState = await this.fetchEntity(entityName, entityId);
    }

    return next.handle().pipe(
      tap(async (response) => {
        try {
          // Use real JWT user if available, fall back to dev mock
          const requestUser = request.user;
          const userId = requestUser?.sub || DEV_USER_ID;
          const branchId = requestUser?.branchId || DEV_BRANCH_ID;

          let targetId = entityId || response?.id || response?.data?.id || null;
          if (!targetId && response && typeof response === 'object') {
            targetId = response.id;
          }

          let afterState: any = null;
          if (targetId && (action === AuditAction.CREATE || action === AuditAction.UPDATE)) {
            afterState = await this.fetchEntity(entityName, targetId);
          }

          await this.auditLogRepository.create({
            module: moduleName,
            entity: entityName,
            entityId: targetId || '00000000-0000-0000-0000-000000000000',
            action,
            performedBy: userId,
            branchId: branchId,
            ip: request.ip || '::1',
            device: request.headers['user-agent'] || 'Unknown',
            before: beforeState ? JSON.parse(JSON.stringify(beforeState)) : null,
            after: afterState ? JSON.parse(JSON.stringify(afterState)) : null,
          });
        } catch (e) {
          console.error('[AuditInterceptor] Failed to save audit log', e);
        }
      })
    );
  }

  private mapResourceToEntity(resource: string): string {
    switch (resource) {
      case 'organizations': return 'Organization';
      case 'branches': return 'Branch';
      case 'pos-registers': return 'POSRegister';
      case 'roles': return 'Role';
      case 'settings': return 'SystemSetting';
      case 'feature-flags': return 'FeatureFlag';
      case 'users': return 'User';
      // Sprint 2.5 Masters
      case 'product-attributes': return 'ProductAttribute';
      case 'values': return 'ProductAttributeValue';
      case 'recipe-masters': return 'RecipeMaster';
      case 'versions': return 'RecipeVersion';
      case 'approval-workflows': return 'ApprovalWorkflow';
      case 'steps': return 'ApprovalStep';
      case 'supplier-items': return 'SupplierItem';
      case 'number-series': return 'NumberSeries';
      case 'notification-templates': return 'NotificationTemplate';
      case 'reason-masters': return 'ReasonMaster';
      case 'payment-methods': return 'PaymentMethod';
      case 'vehicles': return 'Vehicle';
      case 'designations': return 'Designation';
      case 'tax-rule': return 'TaxRule';
      default: return 'Unknown';
    }
  }

  private mapResourceToModule(resource: string): string {
    switch (resource) {
      case 'organizations':
      case 'branches':
      case 'pos-registers':
      case 'roles':
      case 'users':
        return 'Identity';
      case 'settings':
      case 'feature-flags':
        return 'Shared';
      case 'product-attributes':
      case 'values':
      case 'recipe-masters':
      case 'versions':
      case 'approval-workflows':
      case 'steps':
      case 'supplier-items':
      case 'number-series':
      case 'notification-templates':
      case 'reason-masters':
      case 'payment-methods':
      case 'vehicles':
      case 'designations':
      case 'tax-rule':
        return 'Masters';
      default:
        return 'System';
    }
  }

  private async fetchEntity(entityName: string, id: string): Promise<any> {
    try {
      const db: any = prisma;
      const modelName = entityName.charAt(0).toLowerCase() + entityName.slice(1);
      if (db[modelName]) {
        return await db[modelName].findUnique({ where: { id } });
      }
    } catch (e) {
      console.warn(`[AuditInterceptor] Failed to fetch entity ${entityName}:${id}`, e);
    }
    return null;
  }
}
