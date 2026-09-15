import { PayrollRunStatus, EmploymentType } from '@prisma/client';
import { prisma } from '@cc-erp/database';
import { PayrollPeriodService } from '../services/payroll-period.service';
import { PayrollRunService } from '../services/payroll-run.service';
import { PayrollCalculationEngine } from '../services/payroll-calculation.engine';
import { SalaryStructureService } from '../services/salary.service';
import { EmployeeService, RequestingUser } from '../services/employee.service';
import { FinanceService } from '../../finance/finance.service';
import { BadRequestException } from '@nestjs/common';

describe('Phase 3D — Payroll Finance Mathematical Reconciliation Suite', () => {
  let periodService: PayrollPeriodService;
  let runService: PayrollRunService;
  let salaryService: SalaryStructureService;
  let employeeService: EmployeeService;
  let financeService: FinanceService;
  let orgId: string;
  let factoryBranchId: string;
  let superAdminUser: RequestingUser;
  let periodDec: any;
  let emp1: any;
  let emp2: any;

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

    // Clean up Dec 2026 period
    const existing = await prisma.payrollPeriod.findMany({
      where: { organizationId: orgId, year: 2026, month: 12 },
    });
    for (const p of existing) {
      const runs = await prisma.payrollRun.findMany({ where: { payrollPeriodId: p.id } });
      for (const r of runs) await cleanupRun(r.id);
      await prisma.payrollPeriod.delete({ where: { id: p.id } }).catch(() => null);
    }

    periodDec = await periodService.createPeriod(
      {
        year: 2026,
        month: 12,
        startDate: '2026-12-01T00:00:00.000Z',
        endDate: '2026-12-31T23:59:59.999Z',
      },
      superAdminUser,
    );

    // Create Employee 1
    const empCode1 = `EMP-REC1-${Date.now().toString().slice(-4)}`;
    emp1 = await employeeService.createEmployee(
      {
        employeeCode: empCode1,
        firstName: 'Reconcile',
        lastName: 'One',
        phone: `+9195${Date.now().toString().slice(-8)}`,
        assignedBranchId: factoryBranchId,
        employmentType: EmploymentType.FULL_TIME,
        dateOfJoining: '2026-01-01',
      },
      superAdminUser,
    );
    await employeeService.activateEmployee(emp1.id, superAdminUser);
    await salaryService.createSalaryStructure(
      {
        employeeId: emp1.id,
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

    // Create Employee 2
    const empCode2 = `EMP-REC2-${Date.now().toString().slice(-4)}`;
    emp2 = await employeeService.createEmployee(
      {
        employeeCode: empCode2,
        firstName: 'Reconcile',
        lastName: 'Two',
        phone: `+9194${Date.now().toString().slice(-8)}`,
        assignedBranchId: factoryBranchId,
        employmentType: EmploymentType.FULL_TIME,
        dateOfJoining: '2026-01-01',
      },
      superAdminUser,
    );
    await employeeService.activateEmployee(emp2.id, superAdminUser);
    await salaryService.createSalaryStructure(
      {
        employeeId: emp2.id,
        effectiveDate: '2026-01-01',
        baseSalary: 40000,
        hra: 16000,
        conveyance: 3000,
        specialAllowance: 6000,
        pfContribution: 1800,
        esiContribution: 0,
      },
      superAdminUser,
    );

    // 22 days attendance for both
    for (let day = 1; day <= 22; day++) {
      const dayStr = day.toString().padStart(2, '0');
      await prisma.attendanceLog.createMany({
        data: [
          {
            organizationId: orgId,
            branchId: factoryBranchId,
            employeeId: emp1.id,
            workDate: new Date(`2026-12-${dayStr}T00:00:00.000Z`),
            checkInTime: new Date(`2026-12-${dayStr}T09:00:00.000Z`),
            checkOutTime: new Date(`2026-12-${dayStr}T18:00:00.000Z`),
            hoursWorked: 9,
            status: 'CHECKED_OUT',
            source: 'POS',
          },
          {
            organizationId: orgId,
            branchId: factoryBranchId,
            employeeId: emp2.id,
            workDate: new Date(`2026-12-${dayStr}T00:00:00.000Z`),
            checkInTime: new Date(`2026-12-${dayStr}T09:00:00.000Z`),
            checkOutTime: new Date(`2026-12-${dayStr}T18:00:00.000Z`),
            hoursWorked: 9,
            status: 'CHECKED_OUT',
            source: 'POS',
          },
        ],
      });
    }
  });

  afterAll(async () => {
    if (periodDec?.id) {
      const runs = await prisma.payrollRun.findMany({ where: { payrollPeriodId: periodDec.id } });
      for (const r of runs) await cleanupRun(r.id);
      await prisma.payrollPeriod.delete({ where: { id: periodDec.id } }).catch(() => null);
    }
    if (emp1?.id) {
      await prisma.attendanceLog.deleteMany({ where: { employeeId: emp1.id } });
      await prisma.salaryStructure.deleteMany({ where: { employeeId: emp1.id } });
      await prisma.employee.delete({ where: { id: emp1.id } }).catch(() => null);
    }
    if (emp2?.id) {
      await prisma.attendanceLog.deleteMany({ where: { employeeId: emp2.id } });
      await prisma.salaryStructure.deleteMany({ where: { employeeId: emp2.id } });
      await prisma.employee.delete({ where: { id: emp2.id } }).catch(() => null);
    }
  });

  describe('1. Summation and Item-Level Reconciliation', () => {
    let reconRun: any;

    beforeAll(async () => {
      reconRun = await runService.createRun(
        { payrollPeriodId: periodDec.id, idempotencyKey: `p-recon-${Date.now()}` },
        superAdminUser,
      );
      await runService.calculatePayrollRun(reconRun.id, superAdminUser);
      await runService.submitForApproval(reconRun.id, superAdminUser);
      await runService.approvePayrollRun(reconRun.id, superAdminUser);
    });

    afterAll(async () => {
      await cleanupRun(reconRun.id);
    });

    it('17. should ensure PayrollRun totals precisely match sum of PayrollItems', async () => {
      const items = await prisma.payrollItem.findMany({ where: { payrollRunId: reconRun.id } });
      expect(items.length).toBeGreaterThanOrEqual(2);

      const sumGross = items.reduce((acc, it) => acc + Number(it.grossPay), 0);
      const sumDeductions = items.reduce((acc, it) => acc + Number(it.pfDeduction) + Number(it.esiDeduction) + Number(it.taxDeduction) + Number(it.otherDeductions), 0);
      const sumNet = items.reduce((acc, it) => acc + Number(it.netPay), 0);

      const dbRun = await prisma.payrollRun.findUnique({ where: { id: reconRun.id } });
      expect(Number(dbRun?.totalGrossPay)).toBeCloseTo(sumGross, 2);
      expect(Number(dbRun?.totalDeductions)).toBeCloseTo(sumDeductions, 2);
      expect(Number(dbRun?.totalNetPay)).toBeCloseTo(sumNet, 2);
    });

    it('18. should verify Gross reconciliation: SUM(grossPay) == run.totalGrossPay', async () => {
      const dbRun = await prisma.payrollRun.findUnique({
        where: { id: reconRun.id },
        include: { items: true },
      });
      const itemGrossSum = dbRun!.items.reduce((s, i) => s + Number(i.grossPay), 0);
      expect(Number(dbRun!.totalGrossPay)).toBeCloseTo(itemGrossSum, 2);
    });

    it('19. should verify Deduction reconciliation: SUM(deductions) == run.totalDeductions', async () => {
      const dbRun = await prisma.payrollRun.findUnique({
        where: { id: reconRun.id },
        include: { items: true },
      });
      const itemDedSum = dbRun!.items.reduce(
        (s, i) => s + Number(i.pfDeduction) + Number(i.esiDeduction) + Number(i.taxDeduction) + Number(i.otherDeductions),
        0,
      );
      expect(Number(dbRun!.totalDeductions)).toBeCloseTo(itemDedSum, 2);
    });

    it('20. should verify Net reconciliation: SUM(netPay) == run.totalNetPay', async () => {
      const dbRun = await prisma.payrollRun.findUnique({
        where: { id: reconRun.id },
        include: { items: true },
      });
      const itemNetSum = dbRun!.items.reduce((s, i) => s + Number(i.netPay), 0);
      expect(Number(dbRun!.totalNetPay)).toBeCloseTo(itemNetSum, 2);
    });

    it('21. should ensure Finance debit = Finance credit (Gross = Net + Deductions)', async () => {
      const posted = await runService.postPayrollToFinance(reconRun.id, superAdminUser);
      const gross = Number(posted.totalGrossPay);
      const deductions = Number(posted.totalDeductions);
      const net = Number(posted.totalNetPay);

      expect(gross).toBeCloseTo(net + deductions, 2);
    });
  });

  describe('2. Corruption Rejection', () => {
    it('should reject posting if payroll totals are artificially corrupted or unbalanced', async () => {
      const corruptRun = await runService.createRun(
        { payrollPeriodId: periodDec.id, idempotencyKey: `p-corrupt-${Date.now()}` },
        superAdminUser,
      );
      await runService.calculatePayrollRun(corruptRun.id, superAdminUser);
      await runService.submitForApproval(corruptRun.id, superAdminUser);
      await runService.approvePayrollRun(corruptRun.id, superAdminUser);

      // Corrupt totalNetPay directly in DB to break Gross = Net + Deductions
      await prisma.payrollRun.update({
        where: { id: corruptRun.id },
        data: { totalNetPay: 999999.99 },
      });

      await expect(runService.postPayrollToFinance(corruptRun.id, superAdminUser)).rejects.toThrow(
        BadRequestException,
      );

      await cleanupRun(corruptRun.id);
    });
  });
});
