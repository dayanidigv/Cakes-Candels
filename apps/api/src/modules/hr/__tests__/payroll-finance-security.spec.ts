import { PayrollRunStatus, EmploymentType } from '@prisma/client';
import { prisma } from '@cc-erp/database';
import { PayrollPeriodService } from '../services/payroll-period.service';
import { PayrollRunService } from '../services/payroll-run.service';
import { PayrollCalculationEngine } from '../services/payroll-calculation.engine';
import { SalaryStructureService } from '../services/salary.service';
import { EmployeeService, RequestingUser } from '../services/employee.service';
import { FinanceService } from '../../finance/finance.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('Phase 3D — Payroll Finance Security & Tenant Isolation Suite', () => {
  let periodService: PayrollPeriodService;
  let runService: PayrollRunService;
  let salaryService: SalaryStructureService;
  let employeeService: EmployeeService;
  let financeService: FinanceService;
  let orgId: string;
  let otherOrgId: string;
  let factoryBranchId: string;
  let superAdminUser: RequestingUser;
  let branchStaffUser: RequestingUser;
  let assignedUser: RequestingUser;
  let otherOrgUser: RequestingUser;
  let periodNov: any;
  let secEmp: any;

  async function cleanupRun(runId: string) {
    await prisma.payslip.deleteMany({ where: { payrollItem: { payrollRunId: runId } } });
    await prisma.payrollDetail.deleteMany({ where: { payrollItem: { payrollRunId: runId } } });
    await prisma.payrollItem.deleteMany({ where: { payrollRunId: runId } });
    await prisma.payrollRun.delete({ where: { id: runId } }).catch(() => null);
  }

  beforeAll(async () => {
    periodService = new PayrollPeriodService();
    salaryService = new SalaryStructureService();
    employeeService = new EmployeeService();
    financeService = new FinanceService();
    runService = new PayrollRunService(new PayrollCalculationEngine(), salaryService, financeService);

    const orgs = await prisma.organization.findMany();
    if (!orgs || orgs.length === 0) throw new Error('No organization found');
    orgId = orgs[0].id;

    // Second org for cross-tenant test
    let otherOrg = orgs.find((o) => o.id !== orgId);
    if (!otherOrg) {
      otherOrg = await prisma.organization.create({
        data: {
          name: 'Other Corp',
          code: `OTHER-${Date.now()}`,
        },
      });
    }
    otherOrgId = otherOrg.id;

    const branches = await prisma.branch.findMany({ where: { organizationId: orgId } });
    const factory = branches.find((b) => b.type === 'FACTORY') || branches[0];
    factoryBranchId = factory.id;

    superAdminUser = {
      sub: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000001',
      permissions: [],
      username: 'admin',
      organizationId: orgId,
      branchId: factoryBranchId,
      roles: ['SUPER_ADMIN', 'FINANCE_MANAGER'],
      scope: 'GLOBAL',
    };

    branchStaffUser = {
      sub: '00000000-0000-0000-0000-000000000002',
      userId: '00000000-0000-0000-0000-000000000002',
      permissions: [],
      username: 'branch_cashier',
      organizationId: orgId,
      branchId: factoryBranchId,
      roles: ['CASHIER'],
      scope: 'BRANCH',
    };

    assignedUser = {
      sub: '00000000-0000-0000-0000-000000000003',
      userId: '00000000-0000-0000-0000-000000000003',
      permissions: [],
      username: 'driver_user',
      organizationId: orgId,
      branchId: factoryBranchId,
      roles: ['DRIVER'],
      scope: 'ASSIGNED',
    };

    otherOrgUser = {
      sub: '00000000-0000-0000-0000-000000000004',
      userId: '00000000-0000-0000-0000-000000000004',
      permissions: [],
      username: 'other_admin',
      organizationId: otherOrgId,
      roles: ['SUPER_ADMIN'],
      scope: 'GLOBAL',
    };

    // Clean up Nov 2026 period
    const existing = await prisma.payrollPeriod.findMany({
      where: { organizationId: orgId, year: 2026, month: 11 },
    });
    for (const p of existing) {
      const runs = await prisma.payrollRun.findMany({ where: { payrollPeriodId: p.id } });
      for (const r of runs) await cleanupRun(r.id);
      await prisma.payrollPeriod.delete({ where: { id: p.id } }).catch(() => null);
    }

    periodNov = await periodService.createPeriod(
      {
        year: 2026,
        month: 11,
        startDate: '2026-11-01T00:00:00.000Z',
        endDate: '2026-11-30T23:59:59.999Z',
      },
      superAdminUser,
    );

    const empCode = `EMP-SEC-${Date.now().toString().slice(-4)}`;
    secEmp = await employeeService.createEmployee(
      {
        employeeCode: empCode,
        firstName: 'Security',
        lastName: 'Tester',
        phone: `+9196${Date.now().toString().slice(-8)}`,
        assignedBranchId: factoryBranchId,
        employmentType: EmploymentType.FULL_TIME,
        dateOfJoining: '2026-01-01',
      },
      superAdminUser,
    );
    await employeeService.activateEmployee(secEmp.id, superAdminUser);

    await salaryService.createSalaryStructure(
      {
        employeeId: secEmp.id,
        effectiveDate: '2026-01-01',
        baseSalary: 45000,
        hra: 18000,
        conveyance: 3000,
        specialAllowance: 5000,
        pfContribution: 1800,
        esiContribution: 0,
      },
      superAdminUser,
    );

    // 15 present days
    for (let day = 1; day <= 15; day++) {
      const dayStr = day.toString().padStart(2, '0');
      await prisma.attendanceLog.create({
        data: {
          organizationId: orgId,
          branchId: factoryBranchId,
          employeeId: secEmp.id,
          workDate: new Date(`2026-11-${dayStr}T00:00:00.000Z`),
          checkInTime: new Date(`2026-11-${dayStr}T09:00:00.000Z`),
          checkOutTime: new Date(`2026-11-${dayStr}T18:00:00.000Z`),
          hoursWorked: 9,
          status: 'CHECKED_OUT',
          source: 'POS',
        },
      });
    }
  });

  afterAll(async () => {
    if (periodNov?.id) {
      const runs = await prisma.payrollRun.findMany({ where: { payrollPeriodId: periodNov.id } });
      for (const r of runs) await cleanupRun(r.id);
      await prisma.payrollPeriod.delete({ where: { id: periodNov.id } }).catch(() => null);
    }
    if (secEmp?.id) {
      await prisma.attendanceLog.deleteMany({ where: { employeeId: secEmp.id } });
      await prisma.salaryStructure.deleteMany({ where: { employeeId: secEmp.id } });
      await prisma.employee.delete({ where: { id: secEmp.id } }).catch(() => null);
    }
  });

  describe('1. Cross-Organization Tenant Isolation', () => {
    let testRun: any;

    beforeAll(async () => {
      testRun = await runService.createRun(
        { payrollPeriodId: periodNov.id, idempotencyKey: `p-sec-org-${Date.now()}` },
        superAdminUser,
      );
      await runService.calculatePayrollRun(testRun.id, superAdminUser);
      await runService.submitForApproval(testRun.id, superAdminUser);
      await runService.approvePayrollRun(testRun.id, superAdminUser);
    });

    afterAll(async () => {
      await cleanupRun(testRun.id);
    });

    it('should reject posting attempt by user belonging to a different organization', async () => {
      await expect(runService.postPayrollToFinance(testRun.id, otherOrgUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('2. Scope-Based Authorization (BranchScopeGuard / Role)', () => {
    let testRun: any;

    beforeAll(async () => {
      testRun = await runService.createRun(
        { payrollPeriodId: periodNov.id, idempotencyKey: `p-sec-scope-${Date.now()}` },
        superAdminUser,
      );
      await runService.calculatePayrollRun(testRun.id, superAdminUser);
      await runService.submitForApproval(testRun.id, superAdminUser);
      await runService.approvePayrollRun(testRun.id, superAdminUser);
    });

    afterAll(async () => {
      await cleanupRun(testRun.id);
    });

    it('should forbid users with BRANCH scope from posting payroll to Finance', async () => {
      await expect(runService.postPayrollToFinance(testRun.id, branchStaffUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should forbid users with ASSIGNED scope from posting payroll to Finance', async () => {
      await expect(runService.postPayrollToFinance(testRun.id, assignedUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('3. Financial Totals Authority', () => {
    it('should compute and post financial values strictly from database records, ignoring frontend overrides', async () => {
      const authRun = await runService.createRun(
        { payrollPeriodId: periodNov.id, idempotencyKey: `p-sec-auth-${Date.now()}` },
        superAdminUser,
      );
      const calc = await runService.calculatePayrollRun(authRun.id, superAdminUser);
      await runService.submitForApproval(authRun.id, superAdminUser);
      await runService.approvePayrollRun(authRun.id, superAdminUser);

      // postPayrollToFinance takes only (id, user, idempotencyKey) - does not accept any financial amounts
      const posted = await runService.postPayrollToFinance(authRun.id, superAdminUser);
      expect(Number(posted.totalGrossPay)).toBe(Number(calc.totalGrossPay));
      expect(Number(posted.totalNetPay)).toBe(Number(calc.totalNetPay));
      expect(Number(posted.totalDeductions)).toBe(Number(calc.totalDeductions));

      await cleanupRun(authRun.id);
    });
  });
});
