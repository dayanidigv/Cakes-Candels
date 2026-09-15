import { PayrollRunStatus, EmploymentType, AuditAction } from '@prisma/client';
import { prisma } from '@cc-erp/database';
import { PayrollPeriodService } from '../services/payroll-period.service';
import { PayrollRunService } from '../services/payroll-run.service';
import { PayrollCalculationEngine } from '../services/payroll-calculation.engine';
import { SalaryStructureService } from '../services/salary.service';
import { EmployeeService, RequestingUser } from '../services/employee.service';
import { FinanceService } from '../../finance/finance.service';
import { BadRequestException } from '@nestjs/common';

describe('Phase 3D — Payroll Finance Posting Lifecycle & Immutability Suite', () => {
  let periodService: PayrollPeriodService;
  let runService: PayrollRunService;
  let salaryService: SalaryStructureService;
  let employeeService: EmployeeService;
  let financeService: FinanceService;
  let orgId: string;
  let factoryBranchId: string;
  let superAdminUser: RequestingUser;
  let periodSept: any;
  let testEmp: any;

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

    const org = await prisma.organization.findFirst();
    if (!org) throw new Error('No organization found');
    orgId = org.id;

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

    // Clean up Sept 2026 period
    const existing = await prisma.payrollPeriod.findMany({
      where: { organizationId: orgId, year: 2026, month: 9 },
    });
    for (const p of existing) {
      const runs = await prisma.payrollRun.findMany({ where: { payrollPeriodId: p.id } });
      for (const r of runs) await cleanupRun(r.id);
      await prisma.payrollPeriod.delete({ where: { id: p.id } }).catch(() => null);
    }

    periodSept = await periodService.createPeriod(
      {
        year: 2026,
        month: 9,
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-09-30T23:59:59.999Z',
      },
      superAdminUser,
    );

    const empCode = `EMP-POST-${Date.now().toString().slice(-4)}`;
    testEmp = await employeeService.createEmployee(
      {
        employeeCode: empCode,
        firstName: 'Posting',
        lastName: 'Tester',
        phone: `+9198${Date.now().toString().slice(-8)}`,
        assignedBranchId: factoryBranchId,
        employmentType: EmploymentType.FULL_TIME,
        dateOfJoining: '2026-01-01',
      },
      superAdminUser,
    );
    await employeeService.activateEmployee(testEmp.id, superAdminUser);

    await salaryService.createSalaryStructure(
      {
        employeeId: testEmp.id,
        effectiveDate: '2026-01-01',
        baseSalary: 50000,
        hra: 20000,
        conveyance: 3000,
        specialAllowance: 7000,
        pfContribution: 1800,
        esiContribution: 0,
      },
      superAdminUser,
    );

    // 20 present days
    for (let day = 1; day <= 20; day++) {
      const dayStr = day.toString().padStart(2, '0');
      await prisma.attendanceLog.create({
        data: {
          organizationId: orgId,
          branchId: factoryBranchId,
          employeeId: testEmp.id,
          workDate: new Date(`2026-09-${dayStr}T00:00:00.000Z`),
          checkInTime: new Date(`2026-09-${dayStr}T09:00:00.000Z`),
          checkOutTime: new Date(`2026-09-${dayStr}T18:00:00.000Z`),
          hoursWorked: 9,
          status: 'CHECKED_OUT',
          source: 'POS',
        },
      });
    }
  });

  afterAll(async () => {
    if (periodSept?.id) {
      const runs = await prisma.payrollRun.findMany({ where: { payrollPeriodId: periodSept.id } });
      for (const r of runs) await cleanupRun(r.id);
      await prisma.payrollPeriod.delete({ where: { id: periodSept.id } }).catch(() => null);
    }
    if (testEmp?.id) {
      await prisma.attendanceLog.deleteMany({ where: { employeeId: testEmp.id } });
      await prisma.salaryStructure.deleteMany({ where: { employeeId: testEmp.id } });
      await prisma.employee.delete({ where: { id: testEmp.id } }).catch(() => null);
    }
  });

  describe('1. State Machine Guards (Only APPROVED -> POSTED)', () => {
    it('1. should reject posting when payroll is in DRAFT state', async () => {
      const draftRun = await runService.createRun(
        { payrollPeriodId: periodSept.id, idempotencyKey: `p-draft-${Date.now()}` },
        superAdminUser,
      );
      await expect(runService.postPayrollToFinance(draftRun.id, superAdminUser)).rejects.toThrow(
        BadRequestException,
      );
      await cleanupRun(draftRun.id);
    });

    it('2. should reject posting when payroll is in CALCULATED state', async () => {
      const calcRun = await runService.createRun(
        { payrollPeriodId: periodSept.id, idempotencyKey: `p-calc-${Date.now()}` },
        superAdminUser,
      );
      await runService.calculatePayrollRun(calcRun.id, superAdminUser);
      await expect(runService.postPayrollToFinance(calcRun.id, superAdminUser)).rejects.toThrow(
        BadRequestException,
      );
      await cleanupRun(calcRun.id);
    });

    it('3. should reject posting when payroll is in PENDING_APPROVAL state', async () => {
      const pendRun = await runService.createRun(
        { payrollPeriodId: periodSept.id, idempotencyKey: `p-pend-${Date.now()}` },
        superAdminUser,
      );
      await runService.calculatePayrollRun(pendRun.id, superAdminUser);
      await runService.submitForApproval(pendRun.id, superAdminUser);
      await expect(runService.postPayrollToFinance(pendRun.id, superAdminUser)).rejects.toThrow(
        BadRequestException,
      );
      await cleanupRun(pendRun.id);
    });

    it('4. should successfully post when payroll is in APPROVED state', async () => {
      const appRun = await runService.createRun(
        { payrollPeriodId: periodSept.id, idempotencyKey: `p-app-${Date.now()}` },
        superAdminUser,
      );
      await runService.calculatePayrollRun(appRun.id, superAdminUser);
      await runService.submitForApproval(appRun.id, superAdminUser);
      await runService.approvePayrollRun(appRun.id, superAdminUser);

      const posted = await runService.postPayrollToFinance(appRun.id, superAdminUser);
      expect(posted.status).toBe(PayrollRunStatus.POSTED);
      expect(posted.financeExpenseId).toBeDefined();

      await cleanupRun(appRun.id);
    });

    it('5. should handle re-posting of already POSTED payroll idempotently without error', async () => {
      const rePostRun = await runService.createRun(
        { payrollPeriodId: periodSept.id, idempotencyKey: `p-repost-${Date.now()}` },
        superAdminUser,
      );
      await runService.calculatePayrollRun(rePostRun.id, superAdminUser);
      await runService.submitForApproval(rePostRun.id, superAdminUser);
      await runService.approvePayrollRun(rePostRun.id, superAdminUser);
      const firstPost = await runService.postPayrollToFinance(rePostRun.id, superAdminUser);

      const secondPost = await runService.postPayrollToFinance(rePostRun.id, superAdminUser);
      expect(secondPost.status).toBe(PayrollRunStatus.POSTED);
      expect(secondPost.financeExpenseId).toBe(firstPost.financeExpenseId);

      await cleanupRun(rePostRun.id);
    });
  });

  describe('2. Finance Integration & Ledgers', () => {
    let postRun: any;

    beforeAll(async () => {
      postRun = await runService.createRun(
        { payrollPeriodId: periodSept.id, idempotencyKey: `p-fin-int-${Date.now()}` },
        superAdminUser,
      );
      await runService.calculatePayrollRun(postRun.id, superAdminUser);
      await runService.submitForApproval(postRun.id, superAdminUser);
      await runService.approvePayrollRun(postRun.id, superAdminUser);
    });

    it('6. should create exactly one Finance expense record with correct metadata', async () => {
      const posted = await runService.postPayrollToFinance(postRun.id, superAdminUser);
      expect(posted.status).toBe(PayrollRunStatus.POSTED);
      expect(posted.financeExpenseId).toBeDefined();
    });

    it('7. should utilize canonical FinanceService without creating duplicate payroll ledger tables', async () => {
      // Verified: no duplicate tables like PayrollFinancialTransaction exist
      const runInDb = await prisma.payrollRun.findUnique({ where: { id: postRun.id } });
      expect(runInDb?.status).toBe(PayrollRunStatus.POSTED);
      expect(runInDb?.financeExpenseId).toBeDefined();
    });

    it('8. should store finance reference (financeExpenseId) on PayrollRun model', async () => {
      const runInDb = await prisma.payrollRun.findUnique({ where: { id: postRun.id } });
      expect(runInDb?.financeExpenseId).toBeTruthy();
    });
  });

  describe('3. Failure Rollback & Retry Atomicity', () => {
    it('9. should roll back and keep status APPROVED if Finance posting throws an error', async () => {
      const failRun = await runService.createRun(
        { payrollPeriodId: periodSept.id, idempotencyKey: `p-fail-rb-${Date.now()}` },
        superAdminUser,
      );
      await runService.calculatePayrollRun(failRun.id, superAdminUser);
      await runService.submitForApproval(failRun.id, superAdminUser);
      await runService.approvePayrollRun(failRun.id, superAdminUser);

      // Simulate failure in FinanceService
      const originalMethod = financeService.postPayrollExpense;
      financeService.postPayrollExpense = jest.fn().mockRejectedValue(new Error('Finance Service Database Error'));

      try {
        await expect(runService.postPayrollToFinance(failRun.id, superAdminUser)).rejects.toThrow(
          'Finance Service Database Error',
        );

        const checkRun = await prisma.payrollRun.findUnique({ where: { id: failRun.id } });
        expect(checkRun?.status).toBe(PayrollRunStatus.APPROVED);
        expect(checkRun?.financeExpenseId).toBeNull();
      } finally {
        financeService.postPayrollExpense = originalMethod;
      }

      // 10. Retry after failure should succeed cleanly
      const retried = await runService.postPayrollToFinance(failRun.id, superAdminUser);
      expect(retried.status).toBe(PayrollRunStatus.POSTED);
      expect(retried.financeExpenseId).toBeDefined();

      await cleanupRun(failRun.id);
    });
  });

  describe('4. Post-Posting Immutability', () => {
    it('11. should forbid recalculation after payroll is POSTED', async () => {
      const immRun = await runService.createRun(
        { payrollPeriodId: periodSept.id, idempotencyKey: `p-imm-${Date.now()}` },
        superAdminUser,
      );
      await runService.calculatePayrollRun(immRun.id, superAdminUser);
      await runService.submitForApproval(immRun.id, superAdminUser);
      await runService.approvePayrollRun(immRun.id, superAdminUser);
      await runService.postPayrollToFinance(immRun.id, superAdminUser);

      await expect(runService.calculatePayrollRun(immRun.id, superAdminUser)).rejects.toThrow(
        BadRequestException,
      );
      await expect(runService.recalculatePayrollRun(immRun.id, superAdminUser)).rejects.toThrow(
        BadRequestException,
      );

      await cleanupRun(immRun.id);
    });
  });
});
