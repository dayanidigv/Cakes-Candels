import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ConfigService } from '../../config/config.service';
import { REDIS_CLIENT } from '../providers/redis.provider';
import type Redis from 'ioredis';
import { UserRepository } from '@cc-erp/database';
import { AuthorizationContext, ScopeType } from '../interfaces/authorization-context.interface';

export interface JwtPayload {
  sub: string;
  username: string;
  roles: string[];
  branchId: string;
  organizationId: string;
  scope: string;
  iat?: number;
  exp?: number;
}

const PERMISSIONS_CACHE_TTL = 300; // 5 minutes
const CACHE_PREFIX = 'cc:permissions:';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly userRepository = new UserRepository();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException('Authorization token not found');
    }
    
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.jwtSecret
      });
    } catch {
      throw new UnauthorizedException('Token invalid or expired');
    }

    const permissions = await this.getUserPermissions(payload.sub);

    const authContext: AuthorizationContext = {
      userId: payload.sub,
      organizationId: payload.organizationId,
      scope: payload.scope as ScopeType,
      branchId: payload.branchId,
      permissions: Object.freeze(permissions), // Immutable array
    };

    (request as any).user = payload; // legacy support
    (request as any).authContext = Object.freeze({
      ...authContext,
      id: payload.sub,
      sub: payload.sub
    }); // Immutable context

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private async getUserPermissions(userId: string): Promise<string[]> {
    const cacheKey = `${CACHE_PREFIX}${userId}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as string[];
      }
    } catch {
      // Redis unavailable — fall through to DB
    }

    // DB fallback
    const userWithRoles = await this.userRepository.findById(userId);
    if (!userWithRoles) {
      return [];
    }

    const permissions = [
      ...new Set([
        ...userWithRoles.userRoles.map((ur) => ur.role.name),
        ...userWithRoles.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.name)
        ),
      ]),
    ];

    // Write back to cache
    try {
      await this.redis.setex(cacheKey, PERMISSIONS_CACHE_TTL, JSON.stringify(permissions));
    } catch {
      // Cache write failed — non-fatal
    }

    return permissions;
  }
}
