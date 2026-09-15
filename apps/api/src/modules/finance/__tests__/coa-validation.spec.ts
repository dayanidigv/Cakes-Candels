import { Test, TestingModule } from '@nestjs/testing';
import { AccountService, RequestingUser } from '../services/account.service';
import { prisma } from '@cc-erp/database';
import { AccountType, AccountCategory, BalanceType } from '@prisma/client';
import { ConflictException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('Sprint 12 — Phase 12.2: Chart of Accounts Validation Suite', () => {
  let service: AccountService;

  const userOrgA: RequestingUser = {
    id: '11111111-1111-1111-1111-111111111111',
      userId: '11111111-1111-1111-1111-111111111111',
      permissions: [],
      scope: 'GLOBAL',
    organizationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    role: 'SUPER_ADMIN',
    permissions: ['finance:coa:create', 'finance:coa:read', 'finance:coa:update'],
  };

  const userOrgB: RequestingUser = {
    id: '22222222-2222-2222-2222-222222222222',
      userId: '22222222-2222-2222-2222-222222222222',
      permissions: [],
      scope: 'GLOBAL',
    organizationId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    role: 'SUPER_ADMIN',
    permissions: ['finance:coa:create', 'finance:coa:read'],
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AccountService],
    }).compile();

    service = module.get<AccountService>(AccountService);

    // Clean up test data
    await prisma.account.deleteMany({
      where: {
        organizationId: {
          in: [userOrgA.organizationId, userOrgB.organizationId],
        },
      },
    });

    // Ensure organizations exist in DB
    await prisma.organization.upsert({
      where: { id: userOrgA.organizationId },
      userId: userOrgA.organizationId },
      permissions: [],
      scope: 'GLOBAL',
      create: { id: userOrgA.organizationId,
      userId: userOrgA.organizationId,
      permissions: [],
      scope: 'GLOBAL', code: 'TEST_ORG_A', name: 'Test Org A' },
      update: {},
    });
    await prisma.organization.upsert({
      where: { id: userOrgB.organizationId },
      userId: userOrgB.organizationId },
      permissions: [],
      scope: 'GLOBAL',
      create: { id: userOrgB.organizationId,
      userId: userOrgB.organizationId,
      permissions: [],
      scope: 'GLOBAL', code: 'TEST_ORG_B', name: 'Test Org B' },
      update: {},
    });
  });

  afterAll(async () => {
    await prisma.account.deleteMany({
      where: {
        organizationId: {
          in: [userOrgA.organizationId, userOrgB.organizationId],
        },
      },
    });
  });

  it('1. should create a valid root ASSET account', async () => {
    const account = await service.createAccount(
      {
        code: '10000',
        name: 'ASSETS',
        type: AccountType.ASSET,
        category: AccountCategory.CASH_AND_EQUIVALENTS,
        normalBalance: BalanceType.DEBIT,
        isPostable: false,
      },
      userOrgA,
    );

    expect(account).toBeDefined();
    expect(account.code).toBe('10000');
    expect(account.type).toBe(AccountType.ASSET);
    expect(account.normalBalance).toBe(BalanceType.DEBIT);
    expect(account.organizationId).toBe(userOrgA.organizationId);
  });

  it('2. should reject duplicate account code in same organization', async () => {
    await expect(
      service.createAccount(
        {
          code: '10000',
          name: 'DUPLICATE ASSETS',
          type: AccountType.ASSET,
          category: AccountCategory.CASH_AND_EQUIVALENTS,
          normalBalance: BalanceType.DEBIT,
        },
        userOrgA,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('3. should allow same account code in different organization (tenant isolation)', async () => {
    const accountOrgB = await service.createAccount(
      {
        code: '10000',
        name: 'ASSETS ORG B',
        type: AccountType.ASSET,
        category: AccountCategory.CASH_AND_EQUIVALENTS,
        normalBalance: BalanceType.DEBIT,
        isPostable: false,
      },
      userOrgB,
    );

    expect(accountOrgB.code).toBe('10000');
    expect(accountOrgB.organizationId).toBe(userOrgB.organizationId);
  });

  it('4. should create child account under valid parent', async () => {
    const parent = await prisma.account.findUnique({
      where: { organizationId_code: { organizationId: userOrgA.organizationId, code: '10000' } },
    });

    const child = await service.createAccount(
      {
        code: '11100',
        name: 'Petty Cash Till',
        type: AccountType.ASSET,
        category: AccountCategory.CASH_AND_EQUIVALENTS,
        normalBalance: BalanceType.DEBIT,
        parentId: parent!.id,
        isPostable: true,
      },
      userOrgA,
    );

    expect(child.parentId).toBe(parent!.id);
    expect(child.isPostable).toBe(true);

    // Verify parent is now non-postable summary account
    const updatedParent = await prisma.account.findUnique({ where: { id: parent!.id } });
    expect(updatedParent!.isPostable).toBe(false);
  });

  it('5. should reject cross-organization parent account',
      userId: parent!.id } });
    expect(updatedParent!.isPostable).toBe(false);
  });

  it('5. should reject cross-organization parent account',
      permissions: [],
      scope: 'GLOBAL', async () => {
    const parentOrgB = await prisma.account.findUnique({
      where: { organizationId_code: { organizationId: userOrgB.organizationId, code: '10000' } },
    });

    await expect(
      service.createAccount(
        {
          code: '11200',
          name: 'Invalid Parent Account',
          type: AccountType.ASSET,
          category: AccountCategory.CASH_AND_EQUIVALENTS,
          normalBalance: BalanceType.DEBIT,
          parentId: parentOrgB!.id,
        },
        userOrgA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('6. should reject invalid normal balance for Asset type', async () => {
    await expect(
      service.createAccount(
        {
          code: '11300',
          name: 'Invalid Balance Account',
          type: AccountType.ASSET,
          category: AccountCategory.CASH_AND_EQUIVALENTS,
          normalBalance: BalanceType.CREDIT, // Invalid: Assets must be DEBIT
        },
      userId: Assets must be DEBIT
        },
      permissions: [],
      scope: 'GLOBAL',
        userOrgA,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('7. should resolve hierarchical account tree', async () => {
    const tree = await service.getAccountTree(userOrgA);
    expect(tree.length).toBeGreaterThanOrEqual(1);

    const root = tree.find((node) => node.code === '10000');
    expect(root).toBeDefined();
    expect(root!.children).toBeDefined();
    expect(root!.children!.some((c) => c.code === '11100')).toBe(true);
  });

  it('8. should reject deactivating an account with active children', async () => {
    const parent = await prisma.account.findUnique({
      where: { organizationId_code: { organizationId: userOrgA.organizationId, code: '10000' } },
    });

    await expect(service.deactivateAccount(parent!.id, userOrgA)).rejects.toThrow(BadRequestException);
  });

  it('9. should reject deactivating a system-protected account', async () => {
    const systemAcc = await service.createAccount(
      {
        code: '51000',
        name: 'Salary Expense (System)',
        type: AccountType.EXPENSE,
        category: AccountCategory.SALARY_AND_WAGES,
        normalBalance: BalanceType.DEBIT,
        isSystem: true,
      },
      userOrgA,
    );

    await expect(service.deactivateAccount(systemAcc.id, userOrgA)).rejects.toThrow(ForbiddenException);
  });

  it('10. should idempotently seed standard bakery Chart of Accounts', async () => {
    const seeded = await service.seedSystemAccounts(userOrgA.organizationId, userOrgA.id);
    expect(seeded.length).toBeGreaterThanOrEqual(30);

    // Verify key bakery accounts exist
    const cashAcc = seeded.find((a) => a.code === '11100');
    const rawInvAcc = seeded.find((a) => a.code === '13100');
    const apAcc = seeded.find((a) => a.code === '21000');
    const payrollPayable = seeded.find((a) => a.code === '21200');
    const salesRevAcc = seeded.find((a) => a.code === '41000');
    const salaryExpAcc = seeded.find((a) => a.code === '51000');

    expect(cashAcc).toBeDefined();
    expect(rawInvAcc).toBeDefined();
    expect(apAcc).toBeDefined();
    expect(payrollPayable).toBeDefined();
    expect(salesRevAcc).toBeDefined();
    expect(salaryExpAcc).toBeDefined();

    // Re-run seed to test idempotency
    const reseeded = await service.seedSystemAccounts(userOrgA.organizationId, userOrgA.id);
    expect(reseeded.length).toBe(seeded.length);
  });
});
