import { prisma } from '@cc-erp/database';
import { PayrollPeriodService } from '../services/payroll-period.service';
import { PayrollRunService } from '../services/payroll-run.service';
import { PayrollCalculationEngine } from '../services/payroll-calculation.engine';
import { SalaryStructureService } from '../services/salary.service';
import { FinanceService } from '../../finance/finance.service';
import { RequestingUser } from '../services/employee.service';

describe('Phase 3C — Payroll RBAC & Scope Isolation Specification', () => {
  let periodService: PayrollPeriodService;
  let runService: PayrollRunService;
  let salaryService: SalaryStructureService;
  let financeService: FinanceService;
  let orgId: string;
  let factoryBranchId: string;
  let retailBranchId: string;
  let branchManagerUser: RequestingUser;
  let assignedUser: RequestingUser;
  let periodJuly: any;

  beforeAll(async () => {
    periodService = new PayrollPeriodService();
    salaryService = new SalaryStructureService();
    financeService = new FinanceService();
    runService = new PayrollRunService(new PayrollCalculationEngine(), salaryService, financeService);

    const org = await prisma.organization.findFirst();
    if (!org) throw new Error('No organization found');
    orgId = org.id;

    const branches = await prisma.branch.findMany({ where: { organizationId: orgId } });
    factoryBranchId = branches[0]?.id;
    retailBranchId = branches[1]?.id || factoryBranchId;

    const superAdminUser: RequestingUser = {
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
      username: 'retail_mgr',
      organizationId: orgId,
      branchId: retailBranchId,
      scope: 'BRANCH',
      roles: ['BRANCH_MANAGER'],
    };

    assignedUser = {
      sub: '00000000-0000-0000-0000-000000000003',
      userId: '00000000-0000-0000-0000-000000000003',
      permissions: [],
      username: 'staff_user',
      organizationId: orgId,
      branchId: factoryBranchId,
      scope: 'ASSIGNED',
      roles: ['STAFF'],
    };

    periodJuly = await periodService.createPeriod(
      { year: 2026, month: 7 },
      superAdminUser,
    );
  });

  afterAll(async () => {
    await prisma.payrollPeriod.delete({ where: { id: periodJuly.id } });
    await prisma.$disconnect();
  });

  it('Gate 1: Branch Managers cannot create master Payroll Periods or Runs', async () => {
    await expect(
      periodService.createPeriod({ year: 2026, month: 8 }, branchManagerUser),
    ).rejects.toThrow(/Only GLOBAL\/HQ HR administrators/);

    await expect(
      runService.createRun({ payrollPeriodId: periodJuly.id }, branchManagerUser),
    ).rejects.toThrow(/Only GLOBAL\/HQ HR administrators/);
  });

  it('Gate 2: Assigned Staff users cannot calculate payroll runs', async () => {
    await expect(
      runService.calculatePayrollRun(periodJuly.id, assignedUser),
    ).rejects.toThrow(/Insufficient permissions to calculate payroll/);
  });
});
