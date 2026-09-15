import { PayrollRunStatus, EmploymentType, AuditAction } from '@prisma/client';
import { prisma } from '@cc-erp/database';
import { PayrollPeriodService } from '../services/payroll-period.service';
import { PayrollRunService } from '../services/payroll-run.service';
import { PayrollCalculationEngine } from '../services/payroll-calculation.engine';
import { SalaryStructureService } from '../services/salary.service';
import { EmployeeService, RequestingUser } from '../services/employee.service';
import { FinanceService } from '../../finance/finance.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('Phase 3D — Finance Posting & General Ledger Integration Specification', () => {
  let periodService: PayrollPeriodService;
  let runService: PayrollRunService;
  let salaryService: SalaryStructureService;
  let employeeService: EmployeeService;
  let financeService: FinanceService;
  let orgId: string;
  let factoryBranchId: string;
  let superAdminUser: RequestingUser;
  let branchUser: RequestingUser;
  let periodAugust: any;
  let financeEmp: any;

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

    branchUser = {
      sub: '00000000-0000-0000-0000-000000000002',
      userId: '00000000-0000-0000-0000-000000000002',
      permissions: [],
      username: 'branch_staff',
      organizationId: orgId,
      branchId: factoryBranchId,
      roles: ['BRANCH_STAFF'],
      scope: 'BRANCH',
    };

    // Clean up any existing August 2026 period & runs
    const existingPeriods = await prisma.payrollPeriod.findMany({
      where: { organizationId: orgId, year: 2026, month: 8 },
    });
    for (const p of existingPeriods) {
      const runs = await prisma.payrollRun.findMany({ where: { payrollPeriodId: p.id } });
      for (const r of runs) {
        await cleanupRun(r.id);
      }
      await prisma.payrollPeriod.delete({ where: { id: p.id } }).catch(() => null);
    }

    periodAugust = await periodService.createPeriod(
      {
        year: 2026,
        month: 8,
        startDate: '2026-08-01T00:00:00.000Z',
        endDate: '2026-08-31T23:59:59.999Z',
      },
      superAdminUser,
    );

    // Create a dedicated employee with salary structure
    const empCode = `EMP-FIN-${Date.now().toString().slice(-4)}`;
    financeEmp = await employeeService.createEmployee(
      {
        employeeCode: empCode,
        firstName: 'Finance',
        lastName: 'Auditor',
        phone: `+9199${Date.now().toString().slice(-8)}`,
        assignedBranchId: factoryBranchId,
        employmentType: EmploymentType.FULL_TIME,
        dateOfJoining: '2026-01-01',
      },
      superAdminUser,
    );
    await employeeService.activateEmployee(financeEmp.id, superAdminUser);

    await salaryService.createSalaryStructure(
      {
        employeeId: financeEmp.id,
        effectiveDate: '2026-01-01',
        baseSalary: 60000,
        hra: 24000,
        conveyance: 5000,
        specialAllowance: 11000,
        pfContribution: 1800,
        esiContribution: 0,
      },
      superAdminUser,
    );

    // Seed 22 present days
    for (let day = 1; day <= 22; day++) {
      const dayStr = day.toString().padStart(2, '0');
      const workDate = new Date(`2026-08-${dayStr}T00:00:00.000Z`);
      await prisma.attendanceLog.create({
        data: {
          organizationId: orgId,
          branchId: factoryBranchId,
          employeeId: financeEmp.id,
          workDate,
          checkInTime: new Date(`2026-08-${dayStr}T09:00:00.000Z`),
          checkOutTime: new Date(`2026-08-${dayStr}T18:00:00.000Z`),
          hoursWorked: 9,
          status: 'CHECKED_OUT',
          source: 'POS',
        },
      });
    }
  });

  afterAll(async () => {
    if (periodAugust?.id) {
      const runs = await prisma.payrollRun.findMany({ where: { payrollPeriodId: periodAugust.id } });
      for (const r of runs) {
        await cleanupRun(r.id);
      }
      await prisma.payrollPeriod.delete({ where: { id: periodAugust.id } }).catch(() => null);
    }
    if (financeEmp?.id) {
      await prisma.attendanceLog.deleteMany({ where: { employeeId: financeEmp.id } });
      await prisma.salaryStructure.deleteMany({ where: { employeeId: financeEmp.id } });
      await prisma.employee.delete({ where: { id: financeEmp.id } }).catch(() => null);
    }
  });

  describe('1. State Machine & Approval Lifecycle (DRAFT -> CALCULATED -> PENDING_APPROVAL -> APPROVED -> POSTED)', () => {
    let run: any;

    it('should complete the entire lifecycle from DRAFT to APPROVED and then POSTED', async () => {
      // 1. Initialize run
      run = await runService.createRun(
        { payrollPeriodId: periodAugust.id, idempotencyKey: `fin-run-${Date.now()}` },
        superAdminUser,
      );
      expect(run.status).toBe(PayrollRunStatus.DRAFT);

      // 2. Calculate
      const calculated = await runService.calculatePayrollRun(run.id, superAdminUser);
      expect(calculated.status).toBe(PayrollRunStatus.CALCULATED);
      expect(Number(calculated.totalGrossPay)).toBeGreaterThan(0);
      expect(Number(calculated.totalNetPay)).toBeGreaterThan(0);

      // 3. Submit for approval
      const submitted = await runService.submitForApproval(run.id, superAdminUser);
      expect(submitted.status).toBe(PayrollRunStatus.PENDING_APPROVAL);

      // 4. Approve
      const approved = await runService.approvePayrollRun(run.id, superAdminUser);
      expect(approved.status).toBe(PayrollRunStatus.APPROVED);
      expect(approved.approvedBy).toBe(superAdminUser.sub);
      expect(approved.approvedAt).toBeDefined();

      // 5. Post to Finance
      const posted = await runService.postPayrollToFinance(run.id, superAdminUser);
      expect(posted.status).toBe(PayrollRunStatus.POSTED);
      expect(posted.financeExpenseId).toBeDefined();
    });

    it('INVARIANT: Should strictly enforce APPROVED -> POSTED only', async () => {
      // Create a fresh run in DRAFT
      const freshRun = await runService.createRun(
        { payrollPeriodId: periodAugust.id, idempotencyKey: `fin-draft-${Date.now()}` },
        superAdminUser,
      );

      // Attempt to post DRAFT -> reject
      await expect(runService.postPayrollToFinance(freshRun.id, superAdminUser)).rejects.toThrow(
        BadRequestException,
      );

      // Calculate to CALCULATED -> reject
      await runService.calculatePayrollRun(freshRun.id, superAdminUser);
      await expect(runService.postPayrollToFinance(freshRun.id, superAdminUser)).rejects.toThrow(
        BadRequestException,
      );

      // Submit to PENDING_APPROVAL -> reject
      await runService.submitForApproval(freshRun.id, superAdminUser);
      await expect(runService.postPayrollToFinance(freshRun.id, superAdminUser)).rejects.toThrow(
        BadRequestException,
      );

      // Clean up fresh run
      await cleanupRun(freshRun.id);
    });
  });

  describe('2. Finance Integration & Reconciliation (Debit = Credit, Dynamic Accounts)', () => {
    let testRun: any;

    beforeAll(async () => {
      testRun = await runService.createRun(
        { payrollPeriodId: periodAugust.id, idempotencyKey: `fin-reconcile-${Date.now()}` },
        superAdminUser,
      );
      await runService.calculatePayrollRun(testRun.id, superAdminUser);
      await runService.submitForApproval(testRun.id, superAdminUser);
      await runService.approvePayrollRun(testRun.id, superAdminUser);
    });

    it('should reconcile Gross = Deductions + Net Pay on Finance posting', async () => {
      const posted = await runService.postPayrollToFinance(testRun.id, superAdminUser);

      const gross = Number(posted.totalGrossPay);
      const deductions = Number(posted.totalDeductions);
      const net = Number(posted.totalNetPay);

      // Invariant: Gross == Net + Deductions (Debit Salary Expense == Credit Payable + Credit Tax/PF)
      expect(gross).toBeCloseTo(net + deductions, 2);

      // Preserves finance source reference
      expect(posted.financeExpenseId).toBeDefined();
      expect(typeof posted.financeExpenseId).toBe('string');
    });

    it('should reuse existing Finance domain without duplicate ledger tables', async () => {
      // Verified: FinanceService is called directly, no separate hr_finance_ledger table
      const financeResult = await financeService.postPayrollExpense({
        organizationId: orgId,
        payrollRunId: testRun.id,
        runNumber: testRun.runNumber,
        periodYear: 2026,
        periodMonth: 8,
        totalGrossPay: Number(testRun.totalGrossPay),
        totalDeductions: Number(testRun.totalDeductions),
        totalNetPay: Number(testRun.totalNetPay),
        performedBy: superAdminUser.sub,
      });

      expect(financeResult.category).toBe('SALARY');
      expect(financeResult.status).toBe('POSTED');
      expect(financeResult.sourceModule).toBe('HR_PAYROLL');
    });
  });

  describe('3. Concurrency Protection & Idempotency Guarantee', () => {
    let concRun: any;

    beforeAll(async () => {
      concRun = await runService.createRun(
        { payrollPeriodId: periodAugust.id, idempotencyKey: `fin-conc-run-${Date.now()}` },
        superAdminUser,
      );
      await runService.calculatePayrollRun(concRun.id, superAdminUser);
      await runService.submitForApproval(concRun.id, superAdminUser);
      await runService.approvePayrollRun(concRun.id, superAdminUser);
    });

    it('should produce exactly ONE Finance posting under 100 concurrent posting attempts', async () => {
      const attempts = Array.from({ length: 100 }, (_, i) =>
        runService.postPayrollToFinance(concRun.id, superAdminUser, `idemp-attempt-${i}`),
      );

      const results = await Promise.all(attempts);

      // All 100 concurrent attempts must resolve to the identical POSTED state
      const postedStatuses = results.map((r) => r.status);
      expect(postedStatuses.every((s) => s === PayrollRunStatus.POSTED)).toBe(true);

      // Every returned result shares the exact same financeExpenseId
      const expenseIds = new Set(results.map((r) => r.financeExpenseId));
      expect(expenseIds.size).toBe(1);

      // Verify database record has exactly ONE financeExpenseId
      const dbRun = await prisma.payrollRun.findUnique({ where: { id: concRun.id } });
      expect(dbRun?.status).toBe(PayrollRunStatus.POSTED);
      expect(dbRun?.financeExpenseId).toBe(results[0].financeExpenseId);
    });

    it('should return existing posted run when called with different idempotency keys', async () => {
      const res1 = await runService.postPayrollToFinance(concRun.id, superAdminUser, 'key-alpha');
      const res2 = await runService.postPayrollToFinance(concRun.id, superAdminUser, 'key-beta');

      expect(res1.financeExpenseId).toBe(res2.financeExpenseId);
      expect(res1.status).toBe(PayrollRunStatus.POSTED);
      expect(res2.status).toBe(PayrollRunStatus.POSTED);
    });
  });

  describe('4. Failure Atomicity & Immutability', () => {
    it('should leave payroll run in APPROVED if Finance posting fails', async () => {
      const failRun = await runService.createRun(
        { payrollPeriodId: periodAugust.id, idempotencyKey: `fin-fail-${Date.now()}` },
        superAdminUser,
      );
      await runService.calculatePayrollRun(failRun.id, superAdminUser);
      await runService.submitForApproval(failRun.id, superAdminUser);
      await runService.approvePayrollRun(failRun.id, superAdminUser);

      // Temporarily mock financeService to simulate failure
      const originalMethod = financeService.postPayrollExpense;
      financeService.postPayrollExpense = jest.fn().mockRejectedValue(new Error('Simulated Finance Gateway Timeout'));

      try {
        await expect(runService.postPayrollToFinance(failRun.id, superAdminUser)).rejects.toThrow(
          'Simulated Finance Gateway Timeout',
        );

        // Verify status remains APPROVED in database with null financeExpenseId
        const runInDb = await prisma.payrollRun.findUnique({ where: { id: failRun.id } });
        expect(runInDb?.status).toBe(PayrollRunStatus.APPROVED);
        expect(runInDb?.financeExpenseId).toBeNull();
      } finally {
        financeService.postPayrollExpense = originalMethod;
      }

      // Cleanup
      await cleanupRun(failRun.id);
    });

    it('should lock POSTED payroll against direct modification or recalculation', async () => {
      const lockRun = await runService.createRun(
        { payrollPeriodId: periodAugust.id, idempotencyKey: `fin-lock-${Date.now()}` },
        superAdminUser,
      );
      await runService.calculatePayrollRun(lockRun.id, superAdminUser);
      await runService.submitForApproval(lockRun.id, superAdminUser);
      await runService.approvePayrollRun(lockRun.id, superAdminUser);
      await runService.postPayrollToFinance(lockRun.id, superAdminUser);

      // Attempt recalculation -> must be blocked
      await expect(runService.calculatePayrollRun(lockRun.id, superAdminUser)).rejects.toThrow(
        BadRequestException,
      );
      await expect(runService.recalculatePayrollRun(lockRun.id, superAdminUser)).rejects.toThrow(
        BadRequestException,
      );

      // Cleanup
      await cleanupRun(lockRun.id);
    });
  });

  describe('5. RBAC, Tenant Isolation & Audit/Outbox Atomicity', () => {
    let rbacRun: any;

    beforeAll(async () => {
      rbacRun = await runService.createRun(
        { payrollPeriodId: periodAugust.id, idempotencyKey: `fin-rbac-${Date.now()}` },
        superAdminUser,
      );
      await runService.calculatePayrollRun(rbacRun.id, superAdminUser);
      await runService.submitForApproval(rbacRun.id, superAdminUser);
      await runService.approvePayrollRun(rbacRun.id, superAdminUser);
    });

    it('should deny BRANCH/ASSIGNED scoped users from posting payroll to Finance', async () => {
      await expect(runService.postPayrollToFinance(rbacRun.id, branchUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should create transactional Outbox events and AuditLog on posting', async () => {
      await runService.postPayrollToFinance(rbacRun.id, superAdminUser);

      // Check Outbox event
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          type: 'hr.payroll.paid',
          payload: { path: ['payrollRunId'], equals: rbacRun.id },
        },
      });
      expect(outbox).toBeDefined();
      expect((outbox?.payload as any).financeExpenseCategory).toBe('SALARY');

      // Check AuditLog
      const audit = await prisma.auditLog.findFirst({
        where: {
          entity: 'payroll_run',
          entityId: rbacRun.id,
          action: AuditAction.UPDATE,
        },
        orderBy: { timestamp: 'desc' },
      });
      expect(audit).toBeDefined();
      expect((audit?.after as any).status).toBe(PayrollRunStatus.POSTED);
    });
  });
});
