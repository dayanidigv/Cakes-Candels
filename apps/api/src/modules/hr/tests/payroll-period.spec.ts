import { prisma } from '@cc-erp/database';
import { PayrollPeriodService } from '../services/payroll-period.service';
import { RequestingUser } from '../services/employee.service';

describe('Phase 3C — Payroll Period Management Specification', () => {
  let periodService: PayrollPeriodService;
  let orgId: string;
  let superAdminUser: RequestingUser;
  let branchManagerUser: RequestingUser;

  beforeAll(async () => {
    periodService = new PayrollPeriodService();

    const org = await prisma.organization.findFirst();
    if (!org) throw new Error('No organization found');
    orgId = org.id;

    const branches = await prisma.branch.findMany({ where: { organizationId: orgId } });

    superAdminUser = {
      sub: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000001',
      permissions: [],
      username: 'admin',
      organizationId: orgId,
      scope: 'GLOBAL',
      roles: ['SUPER_ADMIN'],
    };

    branchManagerUser = {
      sub: '00000000-0000-0000-0000-000000000002',
      userId: '00000000-0000-0000-0000-000000000002',
      permissions: [],
      username: 'branch_mgr',
      organizationId: orgId,
      branchId: branches[0]?.id,
      scope: 'BRANCH',
      roles: ['BRANCH_MANAGER'],
    };
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('Gate 1: Should create a valid calendar PayrollPeriod with deterministic UTC dates', async () => {
    const period = await periodService.createPeriod(
      {
        year: 2026,
        month: 10,
      },
      superAdminUser,
    );

    expect(period.id).toBeDefined();
    expect(period.year).toBe(2026);
    expect(period.month).toBe(10);
    expect(period.status).toBe('OPEN');

    const start = new Date(period.startDate);
    const end = new Date(period.endDate);
    expect(start.getUTCFullYear()).toBe(2026);
    expect(start.getUTCMonth()).toBe(9); // 0-indexed October
    expect(start.getUTCDate()).toBe(1);
    expect(end.getUTCDate()).toBe(31);

    // Verify AuditLog
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: period.id, entity: 'payroll_period' },
    });
    expect(audit).toBeDefined();

    await prisma.payrollPeriod.delete({ where: { id: period.id } });
  });

  it('Gate 2: Should reject duplicate year/month period for the same organization', async () => {
    const period = await periodService.createPeriod(
      { year: 2026, month: 11 },
      superAdminUser,
    );

    await expect(
      periodService.createPeriod({ year: 2026, month: 11 }, superAdminUser),
    ).rejects.toThrow(/already exists/);

    await prisma.payrollPeriod.delete({ where: { id: period.id } });
  });

  it('Gate 3: Should reject period creation by non-GLOBAL administrators', async () => {
    await expect(
      periodService.createPeriod({ year: 2026, month: 12 }, branchManagerUser),
    ).rejects.toThrow(/Only GLOBAL\/HQ HR administrators/);
  });
});
