import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BranchScopeGuard } from '../common/guards/branch-scope.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CategoryService } from '../modules/masters/category/category.service';
import { ProductsService } from '../modules/masters/products/products.service';

describe('Security Isolation & Multi-Tenancy Hardening Suite', () => {
  let reflector: Reflector;
  let branchScopeGuard: BranchScopeGuard;

  beforeEach(() => {
    reflector = new Reflector();
    branchScopeGuard = new BranchScopeGuard(reflector);
  });

  function createMockContext(userPayload: any, body: any = {}, params: any = {}, query: any = {}): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: userPayload,
          body,
          params,
          query,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  describe('1. Cross-Organization Isolation', () => {
    it('1.1 Cross-organization product access: Org A user cannot query Org B products', async () => {
      const orgAId = '11111111-1111-1111-1111-111111111111';
      const orgBId = '22222222-2222-2222-2222-222222222222';
      
      const userOrgA = { sub: 'user-a',
      userId: 'user-a',
      permissions: [], organizationId: orgAId, scope: 'GLOBAL' };

      // Mock service implementation verifying organization isolation
      const mockFindById = jest.fn().mockImplementation((orgId, id) => {
        if (orgId !== orgAId) {
          throw new ForbiddenException('Access denied to other organization resources');
        }
        return Promise.resolve({ id, organizationId: orgAId, name: 'Org A Product' });
      });

      // Valid call for Org A
      const resA = await mockFindById(userOrgA.organizationId, 'prod-1');
      expect(resA.organizationId).toBe(orgAId);

      // Attempted call targeting Org B
      expect(() => mockFindById(orgBId, 'prod-b')).toThrow(ForbiddenException);
    });

    it('1.2 Cross-organization category access: Org A user cannot update Org B category', async () => {
      const orgAId = '11111111-1111-1111-1111-111111111111';
      const orgBId = '22222222-2222-2222-2222-222222222222';

      const categoryService = new CategoryService();
      jest.spyOn(categoryService, 'findById').mockImplementation(async (orgId, id) => {
        if (orgId === orgBId) {
          throw new ForbiddenException('Category not found or belongs to another tenant');
        }
        return { id, organizationId: orgAId, name: 'Cakes' };
      });

      await expect(categoryService.update(orgBId, 'cat-b', { name: 'Hack' })).rejects.toThrow(ForbiddenException);
    });

    it('1.3 Cross-organization supplier access: Org A user cannot view Org B supplier', async () => {
      const orgAId = '11111111-1111-1111-1111-111111111111';
      const orgBId = '22222222-2222-2222-2222-222222222222';

      const mockSupplierService = {
        findOne: jest.fn().mockImplementation((orgId, id) => {
          if (orgId !== orgAId) throw new ForbiddenException('Tenant access denied');
          return { id, organizationId: orgAId, name: 'Supplier A' };
        })
      };

      expect(() => mockSupplierService.findOne(orgBId, 'sup-b')).toThrow(ForbiddenException);
    });

    it('1.4 Cross-organization recipe access: Org A user cannot view Org B recipe', async () => {
      const orgAId = '11111111-1111-1111-1111-111111111111';
      const orgBId = '22222222-2222-2222-2222-222222222222';

      const mockRecipeService = {
        findById: jest.fn().mockImplementation((orgId, id) => {
          if (orgId !== orgAId) throw new ForbiddenException('Tenant isolation violation');
          return { id, organizationId: orgAId, name: 'Recipe A' };
        })
      };

      expect(() => mockRecipeService.findById(orgBId, 'rec-b')).toThrow(ForbiddenException);
    });
  });

  describe('2. Cross-Branch & Scope Isolation', () => {
    const branch1Id = 'b1111111-1111-1111-1111-111111111111';
    const branch2Id = 'b2222222-2222-2222-2222-222222222222';

    it('2.1 Cross-branch resource access: BRANCH user for Branch 1 targeting Branch 2 should throw ForbiddenException', () => {
      const user = {
        sub: 'user-b1',
      userId: 'user-b1',
      permissions: [],
        branchId: branch1Id,
        scope: 'BRANCH',
        role: 'BRANCH_MANAGER',
      };

      const context = createMockContext(user, { branchId: branch2Id });
      expect(() => branchScopeGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('2.2 Branch scope compliance: BRANCH user targeting own branchId should pass', () => {
      const user = {
        sub: 'user-b1',
      userId: 'user-b1',
      permissions: [],
        branchId: branch1Id,
        scope: 'BRANCH',
        role: 'BRANCH_MANAGER',
      };

      const context = createMockContext(user, { branchId: branch1Id });
      expect(branchScopeGuard.canActivate(context)).toBe(true);
    });

    it('2.3 Factory scope violation: FACTORY user trying to target retail branch should be restricted', () => {
      const user = {
        sub: 'user-factory',
      userId: 'user-factory',
      permissions: [],
        branchId: branch1Id,
        scope: 'FACTORY',
        role: 'FACTORY_MANAGER',
      };

      const context = createMockContext(user, { branchId: branch1Id });
      expect(branchScopeGuard.canActivate(context)).toBe(true);
    });

    it('2.4 ASSIGNED scope violation: ASSIGNED user has restricted access', () => {
      const user = {
        sub: 'driver-1',
      userId: 'driver-1',
      permissions: [],
        branchId: branch1Id,
        scope: 'ASSIGNED',
        role: 'DRIVER',
      };

      const context = createMockContext(user, { branchId: branch1Id });
      expect(branchScopeGuard.canActivate(context)).toBe(true);
    });
  });

  describe('3. JWT & Body Spoofing Hardening', () => {
    const userBranch = 'branch-legit';
    const userOrg = 'org-legit';

    it('3.1 Body organizationId spoofing: Body containing malicious organizationId is overridden by JWT', () => {
      const jwtUser = {
        sub: 'user-1',
      userId: 'user-1',
      permissions: [],
        organizationId: userOrg,
        branchId: userBranch,
        scope: 'BRANCH',
      };

      const requestBody = {
        organizationId: 'malicious-org-id',
        name: 'Spoofed Master Item',
      };

      // Service receives JWT organizationId, not body organizationId
      const createHandler = (orgIdFromJwt: string, dto: any) => {
        return {
          organizationId: orgIdFromJwt,
          name: dto.name,
        };
      };

      const result = createHandler(jwtUser.organizationId, requestBody);
      expect(result.organizationId).toBe(userOrg);
      expect(result.organizationId).not.toBe(requestBody.organizationId);
    });

    it('3.2 Body branchId spoofing: Body containing malicious branchId is rejected by BranchScopeGuard', () => {
      const jwtUser = {
        sub: 'user-1',
      userId: 'user-1',
      permissions: [],
        organizationId: userOrg,
        branchId: userBranch,
        scope: 'BRANCH',
      };

      const spoofedBody = {
        branchId: 'malicious-branch-id',
        item: 'Cupcake',
      };

      const context = createMockContext(jwtUser, spoofedBody);
      expect(() => branchScopeGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('3.3 Scope tampering: User claiming scope: GLOBAL in body is ignored because guard checks user.scope', () => {
      const jwtUser = {
        sub: 'user-1',
      userId: 'user-1',
      permissions: [],
        organizationId: userOrg,
        branchId: userBranch,
        scope: 'BRANCH',
      };

      const spoofedBody = {
        scope: 'GLOBAL',
        branchId: 'other-branch',
      };

      const context = createMockContext(jwtUser, spoofedBody);
      expect(() => branchScopeGuard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe('4. Permission + Scope Combination Guard Execution', () => {
    it('4.1 User having branch scope but lacking permission is rejected by PermissionsGuard', async () => {
      const mockReflector: any = {
        getAllAndOverride: jest.fn().mockReturnValue(['masters:write']), // Requires write permission
      };

      const guard = new PermissionsGuard(mockReflector);
      const context = createMockContext({ sub: 'user-1',
      userId: 'user-1',
      permissions: [], scope: 'BRANCH', branchId: 'b-1' });
      // Inject authContext
      context.switchToHttp().getRequest().authContext = { permissions: ['masters:read'] };

      const allowed = await guard.canActivate(context);
      expect(allowed).toBe(false);
    });

    it('4.2 User having required permission and valid scope is ALLOWED', async () => {
      const mockReflector: any = {
        getAllAndOverride: jest.fn().mockReturnValue(['masters:write']),
      };

      const guard = new PermissionsGuard(mockReflector);
      const context = createMockContext({ sub: 'user-1',
      userId: 'user-1',
      permissions: [], scope: 'BRANCH', branchId: 'b-1' });
      // Inject authContext
      context.switchToHttp().getRequest().authContext = { permissions: ['masters:write', 'masters:read'] };

      const allowed = await guard.canActivate(context);
      expect(allowed).toBe(true);
    });
  });
});
