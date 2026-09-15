import { CanActivate, ExecutionContext, Injectable, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRepository } from '@cc-erp/database';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';


const PERMISSIONS_CACHE_TTL = 300; // 5 minutes
const CACHE_PREFIX = 'cc:permissions:';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly userRepository = new UserRepository();

  constructor(
    private reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { authContext } = context.switchToHttp().getRequest();
    if (!authContext) {
      // If there's no auth context, the JwtAuthGuard either failed or wasn't applied.
      return false;
    }

    const userPermissions = authContext.permissions || [];

    // Bypass permissions if user has wildcard or admin role
    const hasAdminRole = userPermissions.some(
      (p) => p === '*' || p === 'SUPER_ADMIN' || p === 'SYSTEM_ADMIN' || p === 'ADMIN'
    );
    if (hasAdminRole) {
      return true;
    }

    return requiredPermissions.every(
      (perm) =>
        userPermissions.includes(perm) ||
        userPermissions.includes('*') ||
        userPermissions.includes(`${perm.split(':')[0]}:*`)
    );
  }

  /** Call this to invalidate cached permissions for a user (e.g., after role change) */
  static getCacheKey(userId: string): string {
    return `${CACHE_PREFIX}${userId}`;
  }

}
