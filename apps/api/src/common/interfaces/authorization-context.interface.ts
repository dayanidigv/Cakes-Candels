export type ScopeType = 'GLOBAL' | 'FACTORY' | 'BRANCH' | 'ASSIGNED';

export interface AuthorizationContext {
  readonly userId: string;
  readonly organizationId: string;
  readonly scope: ScopeType;
  readonly branchId?: string;
  readonly factoryId?: string;
  readonly roleId?: string;
  readonly permissions: readonly string[];
}
