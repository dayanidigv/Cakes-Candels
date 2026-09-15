import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * BranchScopeGuard enforces data isolation at the branch level.
 *
 * JWT Payload Shape (injected by AuthService):
 *   user.scope    = 'GLOBAL' | 'FACTORY' | 'BRANCH' | 'ASSIGNED'
 *   user.branchId = UUID of the user's assigned branch (nullable for GLOBAL)
 *   user.role     = primary role name
 *
 * Authorization Matrix:
 *   GLOBAL scope  → may access any branch's data
 *   FACTORY scope → may access factory resources; blocked from retail branches
 *   BRANCH scope  → may ONLY access resources belonging to their own branchId
 *   ASSIGNED scope→ may only access explicitly assigned records (driver, etc.)
 */
@Injectable()
export class BranchScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Dev token bypass
    if (user.sub === 'dev-token-user' || user.isDevToken) {
      return true;
    }

    // GLOBAL scope users (OWNER, ADMIN, ACCOUNTANT) may access any branch
    if (user.scope === 'GLOBAL') {
      return true;
    }

    // Extract requested branchId from any common location
    const requestBranchId =
      request.params?.branchId ||
      request.query?.branchId ||
      request.body?.branchId;

    // If no branchId targeted, allow — domain service must add its own filter using user.branchId
    if (!requestBranchId) {
      return true;
    }

    // FACTORY scope: only factory branches are accessible
    if (user.scope === 'FACTORY') {
      // We allow it — factory managers can target factory branch IDs
      // The service layer must verify the branch.type === 'FACTORY'
      return true;
    }

    // BRANCH scope: strictly isolate to user's assigned branch
    if (user.scope === 'BRANCH') {
      if (!user.branchId) {
        throw new ForbiddenException('Your account has no branch assigned. Contact administrator.');
      }
      if (requestBranchId !== user.branchId) {
        throw new ForbiddenException(
          `Unauthorized: You may only access resources for your assigned branch.`
        );
      }
      return true;
    }

    // ASSIGNED scope: do not check branchId here; handled at resource level
    return true;
  }
}
