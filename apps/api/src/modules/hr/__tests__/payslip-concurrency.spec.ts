import { EmploymentType, PayslipStatus } from '@prisma/client';
import { prisma } from '@cc-erp/database';
import { PayrollPeriodService } from '../services/payroll-period.service';
import { PayrollRunService } from '../services/payroll-run.service';
import { PayrollCalculationEngine } from '../services/payroll-calculation.engine';
import { SalaryStructureService } from '../services/salary.service';
import { EmployeeService, RequestingUser } from '../services/employee.service';
import { FinanceService } from '../../finance/finance.service';
import { PayslipService } from '../services/payslip.service';

describe('Phase 3E — Payslip Concurrency & Exactly-Once Idempotency Suite', () => {
  let periodService: PayrollPeriodService;
  let runService: PayrollRunService;
  let salaryService: SalaryStructureService;
  let employeeService: EmployeeService;
  let financeService: FinanceService;
  let payslipService: PayslipService;
  let orgId: string;
  let factoryBranchId: string;
  let superAdminUser: RequestingUser;
  let periodFeb27: any;
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
    payslipService = new PayslipService();

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
      roles: ['SUPER_ADMIN', 'HR_DIRECTOR'],
      scope: 'GLOBAL',
    };

    // Clean up Feb 2027 period
    const existing = await prisma.payrollPeriod.findMany({
      where: { organizationId: orgId, year: 2027, month: 2 },
    });
    for (const p of existing) {
      const runs = await prisma.payrollRun.findMany({ where: { payrollPeriodId: p.id } });
      for (const r of runs) await cleanupRun(r.id);
      await prisma.payrollPeriod.delete({ where: { id: p.id } }).catch(() => null);
    }

    periodFeb27 = await periodService.createPeriod(
      {
        year: 2027,
        month: 2,
        startDate: '2027-02-01T00:00:00.000Z',
        endDate: '2027-02-28T23:59:59.999Z',
      },
      superAdminUser,
    );

    const empCode = `EMP-PSCONC-${Date.now().toString().slice(-4)}`;
    concEmp = await employeeService.createEmployee(
      {
        employeeCode: empCode,
        firstName: 'Payslip',
        lastName: 'Concurrency',
        phone: `+9190${Date.now().toString().slice(-8)}`,
        assignedBranchId: factoryBranchId,
        employmentType: EmploymentType.FULL_TIME,
        dateOfJoining: '2027-01-01',
      },
      superAdminUser,
    );
    await employeeService.activateEmployee(concEmp.id, superAdminUser);
    await salaryService.createSalaryStructure(
      {
        employeeId: concEmp.id,
        effectiveDate: '2027-01-01',
        baseSalary: 60000,
        hra: 24000,
        conveyance: 5000,
        specialAllowance: 11000,
        pfContribution: 1800,
        esiContribution: 0,
      },
      superAdminUser,
    );

    for (let day = 1; day <= 20; day++) {
      const dayStr = day.toString().padStart(2, '0');
      await prisma.attendanceLog.create({
        data: {
          organizationId: orgId,
          branchId: factoryBranchId,
          employeeId: concEmp.id,
          workDate: new Date(`2027-02-${dayStr}T00:00:00.000Z`),
          checkInTime: new Date(`2027-02-${dayStr}T09:00:00.000Z`),
          checkOutTime: new Date(`2027-02-${dayStr}T18:00:00.000Z`),
          hoursWorked: 9,
          status: 'CHECKED_OUT',
          source: 'POS',
        },
      });
    }
  });

  afterAll(async () => {
    if (periodFeb27?.id) {
      const runs = await prisma.payrollRun.findMany({ where: { payrollPeriodId: periodFeb27.id } });
      for (const r of runs) await cleanupRun(r.id);
      await prisma.payrollPeriod.delete({ where: { id: periodFeb27.id } }).catch(() => null);
    }
    if (concEmp?.id) {
      await prisma.attendanceLog.deleteMany({ where: { employeeId: concEmp.id } });
      await prisma.salaryStructure.deleteMany({ where: { employeeId: concEmp.id } });
      await prisma.employee.delete({ where: { id: concEmp.id } }).catch(() => null);
    }
  });

  describe('1. 100 Concurrent Payslip Generation Requests', () => {
    let concRun: any;

    beforeAll(async () => {
      concRun = await runService.createRun(
        { payrollPeriodId: periodFeb27.id, idempotencyKey: `ps-conc-gen-${Date.now()}` },
        superAdminUser,
      );
      await runService.calculatePayrollRun(concRun.id, superAdminUser);
      await runService.submitForApproval(concRun.id, superAdminUser);
      await runService.approvePayrollRun(concRun.id, superAdminUser);
      await runService.postPayrollToFinance(concRun.id, superAdminUser);
    });

    afterAll(async () => {
      await cleanupRun(concRun.id);
    });

    it('should result in exactly 1 payslip per employee under 100 concurrent generation requests', async () => {
      const requests = Array.from({ length: 100 }, (_, i) =>
        payslipService.generatePayslipsForRun(concRun.id, superAdminUser, `gen-key-${i}`),
      );

      const results = await Promise.all(requests);

      expect(results.length).toBe(100);
      results.forEach((slipList) => {
        expect(slipList.length).toBeGreaterThanOrEqual(1);
        expect(slipList.every((s: any) => s.status === PayslipStatus.GENERATED)).toBe(true);
      });

      // Verify in DB that each PayrollItem has exactly ONE payslip
      const dbSlips = await prisma.payslip.findMany({
        where: { payrollItem: { payrollRunId: concRun.id } },
      });
      const uniquePayrollItemIds = new Set(dbSlips.map((s) => s.payrollItemId));
      expect(dbSlips.length).toBe(uniquePayrollItemIds.size);
    });
  });

  describe('2. 100 Concurrent Payslip Issuance Requests', () => {
    let issueRun: any;
    let singleSlip: any;

    beforeAll(async () => {
      issueRun = await runService.createRun(
        { payrollPeriodId: periodFeb27.id, idempotencyKey: `ps-conc-iss-${Date.now()}` },
        superAdminUser,
      );
      await runService.calculatePayrollRun(issueRun.id, superAdminUser);
      await runService.submitForApproval(issueRun.id, superAdminUser);
      await runService.approvePayrollRun(issueRun.id, superAdminUser);
      await runService.postPayrollToFinance(issueRun.id, superAdminUser);
      const slips = await payslipService.generatePayslipsForRun(issueRun.id, superAdminUser);
      singleSlip = slips[0];
      await payslipService.approvePayslip(singleSlip.id, superAdminUser);
    });

    afterAll(async () => {
      await cleanupRun(issueRun.id);
    });

    it('should transition exactly once to ISSUED under 100 concurrent issue requests', async () => {
      const issueRequests = Array.from({ length: 100 }, () =>
        payslipService.issuePayslip(singleSlip.id, superAdminUser),
      );

      const issueResponses = await Promise.all(issueRequests);

      expect(issueResponses.length).toBe(100);
      issueResponses.forEach((res) => {
        expect(res.status).toBe(PayslipStatus.ISSUED);
        expect(res.id).toBe(singleSlip.id);
      });

      const finalSlip = await prisma.payslip.findUnique({ where: { id: singleSlip.id } });
      expect(finalSlip?.status).toBe(PayslipStatus.ISSUED);
    });
  });
});
