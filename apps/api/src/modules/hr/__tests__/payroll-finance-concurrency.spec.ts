import { PayrollRunStatus, EmploymentType } from '@prisma/client';
import { prisma } from '@cc-erp/database';
import { PayrollPeriodService } from '../services/payroll-period.service';
import { PayrollRunService } from '../services/payroll-run.service';
import { PayrollCalculationEngine } from '../services/payroll-calculation.engine';
import { SalaryStructureService } from '../services/salary.service';
import { EmployeeService, RequestingUser } from '../services/employee.service';
import { FinanceService } from '../../finance/finance.service';

describe('Phase 3D — Payroll Finance Concurrency & Exactly-Once Idempotency Suite', () => {
  let periodService: PayrollPeriodService;
  let runService: PayrollRunService;
  let salaryService: SalaryStructureService;
  let employeeService: EmployeeService;
  let financeService: FinanceService;
  let orgId: string;
  let factoryBranchId: string;
  let superAdminUser: RequestingUser;
  let periodOct: any;
  let concEmp: any;

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

    // Clean up Oct 2026 period
    const existing = await prisma.payrollPeriod.findMany({
      where: { organizationId: orgId, year: 2026, month: 10 },
    });
    for (const p of existing) {
      const runs = await prisma.payrollRun.findMany({ where: { payrollPeriodId: p.id } });
      for (const r of runs) await cleanupRun(r.id);
      await prisma.payrollPeriod.delete({ where: { id: p.id } }).catch(() => null);
    }

    periodOct = await periodService.createPeriod(
      {
        year: 2026,
        month: 10,
        startDate: '2026-10-01T00:00:00.000Z',
        endDate: '2026-10-31T23:59:59.999Z',
      },
      superAdminUser,
    );

    const empCode = `EMP-CONC-${Date.now().toString().slice(-4)}`;
    concEmp = await employeeService.createEmployee(
      {
        employeeCode: empCode,
        firstName: 'Concurrency',
        lastName: 'Worker',
        phone: `+9197${Date.now().toString().slice(-8)}`,
        assignedBranchId: factoryBranchId,
        employmentType: EmploymentType.FULL_TIME,
        dateOfJoining: '2026-01-01',
      },
      superAdminUser,
    );
    await employeeService.activateEmployee(concEmp.id, superAdminUser);

    await salaryService.createSalaryStructure(
      {
        employeeId: concEmp.id,
        effectiveDate: '2026-01-01',
        baseSalary: 75000,
        hra: 30000,
        conveyance: 5000,
        specialAllowance: 10000,
        pfContribution: 1800,
        esiContribution: 0,
      },
      superAdminUser,
    );

    // 21 present days
    for (let day = 1; day <= 21; day++) {
      const dayStr = day.toString().padStart(2, '0');
      await prisma.attendanceLog.create({
        data: {
          organizationId: orgId,
          branchId: factoryBranchId,
          employeeId: concEmp.id,
          workDate: new Date(`2026-10-${dayStr}T00:00:00.000Z`),
          checkInTime: new Date(`2026-10-${dayStr}T09:00:00.000Z`),
          checkOutTime: new Date(`2026-10-${dayStr}T18:00:00.000Z`),
          hoursWorked: 9,
          status: 'CHECKED_OUT',
          source: 'POS',
        },
      });
    }
  });

  afterAll(async () => {
    if (periodOct?.id) {
      const runs = await prisma.payrollRun.findMany({ where: { payrollPeriodId: periodOct.id } });
      for (const r of runs) await cleanupRun(r.id);
      await prisma.payrollPeriod.delete({ where: { id: periodOct.id } }).catch(() => null);
    }
    if (concEmp?.id) {
      await prisma.attendanceLog.deleteMany({ where: { employeeId: concEmp.id } });
      await prisma.salaryStructure.deleteMany({ where: { employeeId: concEmp.id } });
      await prisma.employee.delete({ where: { id: concEmp.id } }).catch(() => null);
    }
  });

  describe('1. Scenario A: 100 Concurrent Postings on the Same PayrollRun', () => {
    let concRun: any;

    beforeAll(async () => {
      concRun = await runService.createRun(
        { payrollPeriodId: periodOct.id, idempotencyKey: `p-conc-a-${Date.now()}` },
        superAdminUser,
      );
      await runService.calculatePayrollRun(concRun.id, superAdminUser);
      await runService.submitForApproval(concRun.id, superAdminUser);
      await runService.approvePayrollRun(concRun.id, superAdminUser);
    });

    afterAll(async () => {
      await cleanupRun(concRun.id);
    });

    it('should result in exactly 1 Finance posting and 100 successful resolutions', async () => {
      const requests = Array.from({ length: 100 }, (_, idx) =>
        runService.postPayrollToFinance(concRun.id, superAdminUser, `key-scenario-a-${idx}`),
      );

      const responses = await Promise.all(requests);

      // Verify all 100 responses return POSTED status
      expect(responses.length).toBe(100);
      responses.forEach((res) => {
        expect(res.status).toBe(PayrollRunStatus.POSTED);
        expect(res.financeExpenseId).toBeDefined();
      });

      // Verify all responses share the exact same single financeExpenseId
      const uniqueExpenseIds = new Set(responses.map((r) => r.financeExpenseId));
      expect(uniqueExpenseIds.size).toBe(1);

      // Verify database record has exactly ONE financeExpenseId
      const finalDbRun = await prisma.payrollRun.findUnique({ where: { id: concRun.id } });
      expect(finalDbRun?.status).toBe(PayrollRunStatus.POSTED);
      expect(finalDbRun?.financeExpenseId).toBe(responses[0].financeExpenseId);
    });
  });

  describe('2. Scenario B: 100 Requests with the EXACT SAME Idempotency Key', () => {
    let sameKeyRun: any;

    beforeAll(async () => {
      sameKeyRun = await runService.createRun(
        { payrollPeriodId: periodOct.id, idempotencyKey: `p-conc-b-${Date.now()}` },
        superAdminUser,
      );
      await runService.calculatePayrollRun(sameKeyRun.id, superAdminUser);
      await runService.submitForApproval(sameKeyRun.id, superAdminUser);
      await runService.approvePayrollRun(sameKeyRun.id, superAdminUser);
    });

    afterAll(async () => {
      await cleanupRun(sameKeyRun.id);
    });

    it('should execute once and return identical replays across 100 calls', async () => {
      const fixedKey = `fixed-idempotency-key-${Date.now()}`;
      const requests = Array.from({ length: 100 }, () =>
        runService.postPayrollToFinance(sameKeyRun.id, superAdminUser, fixedKey),
      );

      const responses = await Promise.all(requests);

      expect(responses.length).toBe(100);
      const uniqueExpenseIds = new Set(responses.map((r) => r.financeExpenseId));
      expect(uniqueExpenseIds.size).toBe(1);
    });
  });

  describe('3. Scenario C: 100 Sequential/Concurrent Requests with DIFFERENT Idempotency Keys', () => {
    let diffKeyRun: any;

    beforeAll(async () => {
      diffKeyRun = await runService.createRun(
        { payrollPeriodId: periodOct.id, idempotencyKey: `p-conc-c-${Date.now()}` },
        superAdminUser,
      );
      await runService.calculatePayrollRun(diffKeyRun.id, superAdminUser);
      await runService.submitForApproval(diffKeyRun.id, superAdminUser);
      await runService.approvePayrollRun(diffKeyRun.id, superAdminUser);
    });

    afterAll(async () => {
      await cleanupRun(diffKeyRun.id);
    });

    it('should enforce business-level exactly-once posting even with 100 different idempotency keys', async () => {
      const first = await runService.postPayrollToFinance(diffKeyRun.id, superAdminUser, 'diff-key-1');
      expect(first.status).toBe(PayrollRunStatus.POSTED);

      // Send 99 requests with completely different keys
      const subsequentRequests = Array.from({ length: 99 }, (_, i) =>
        runService.postPayrollToFinance(diffKeyRun.id, superAdminUser, `diff-key-${i + 2}`),
      );

      const subsequentResponses = await Promise.all(subsequentRequests);

      subsequentResponses.forEach((res) => {
        expect(res.status).toBe(PayrollRunStatus.POSTED);
        expect(res.financeExpenseId).toBe(first.financeExpenseId);
      });
    });
  });
});
