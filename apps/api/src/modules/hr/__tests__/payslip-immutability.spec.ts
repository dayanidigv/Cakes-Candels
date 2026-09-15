import { EmploymentType, PayslipStatus } from '@prisma/client';
import { prisma } from '@cc-erp/database';
import { PayrollPeriodService } from '../services/payroll-period.service';
import { PayrollRunService } from '../services/payroll-run.service';
import { PayrollCalculationEngine } from '../services/payroll-calculation.engine';
import { SalaryStructureService } from '../services/salary.service';
import { EmployeeService, RequestingUser } from '../services/employee.service';
import { FinanceService } from '../../finance/finance.service';
import { PayslipService } from '../services/payslip.service';
import { BadRequestException } from '@nestjs/common';

describe('Phase 3E — Payslip Immutability & Snapshot Protection Suite', () => {
  let periodService: PayrollPeriodService;
  let runService: PayrollRunService;
  let salaryService: SalaryStructureService;
  let employeeService: EmployeeService;
  let financeService: FinanceService;
  let payslipService: PayslipService;
  let orgId: string;
  let factoryBranchId: string;
  let superAdminUser: RequestingUser;
  let periodApr27: any;
  let immEmp: any;
  let postedRun: any;
  let issuedSlip: any;

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

    // Clean up Apr 2027 period
    const existing = await prisma.payrollPeriod.findMany({
      where: { organizationId: orgId, year: 2027, month: 4 },
    });
    for (const p of existing) {
      const runs = await prisma.payrollRun.findMany({ where: { payrollPeriodId: p.id } });
      for (const r of runs) await cleanupRun(r.id);
      await prisma.payrollPeriod.delete({ where: { id: p.id } }).catch(() => null);
    }

    periodApr27 = await periodService.createPeriod(
      {
        year: 2027,
        month: 4,
        startDate: '2027-04-01T00:00:00.000Z',
        endDate: '2027-04-30T23:59:59.999Z',
      },
      superAdminUser,
    );

    const empCode = `EMP-IMM-${Date.now().toString().slice(-4)}`;
    immEmp = await employeeService.createEmployee(
      {
        employeeCode: empCode,
        firstName: 'Immutability',
        lastName: 'Tester',
        phone: `+9187${Date.now().toString().slice(-8)}`,
        assignedBranchId: factoryBranchId,
        employmentType: EmploymentType.FULL_TIME,
        dateOfJoining: '2027-01-01',
      },
      superAdminUser,
    );
    await employeeService.activateEmployee(immEmp.id, superAdminUser);
    await salaryService.createSalaryStructure(
      {
        employeeId: immEmp.id,
        effectiveDate: '2027-01-01',
        baseSalary: 60000,
        hra: 24000,
        conveyance: 5000,
        specialAllowance: 10000,
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
          employeeId: immEmp.id,
          workDate: new Date(`2027-04-${dayStr}T00:00:00.000Z`),
          checkInTime: new Date(`2027-04-${dayStr}T09:00:00.000Z`),
          checkOutTime: new Date(`2027-04-${dayStr}T18:00:00.000Z`),
          hoursWorked: 9,
          status: 'CHECKED_OUT',
          source: 'POS',
        },
      });
    }

    postedRun = await runService.createRun(
      { payrollPeriodId: periodApr27.id, idempotencyKey: `ps-imm-run-${Date.now()}` },
      superAdminUser,
    );
    await runService.calculatePayrollRun(postedRun.id, superAdminUser);
    await runService.submitForApproval(postedRun.id, superAdminUser);
    await runService.approvePayrollRun(postedRun.id, superAdminUser);
    await runService.postPayrollToFinance(postedRun.id, superAdminUser);
    const slips = await payslipService.generatePayslipsForRun(postedRun.id, superAdminUser);
    issuedSlip = slips[0];
    await payslipService.approvePayslip(issuedSlip.id, superAdminUser);
    await payslipService.issuePayslip(issuedSlip.id, superAdminUser);
  });

  afterAll(async () => {
    if (periodApr27?.id) {
      const runs = await prisma.payrollRun.findMany({ where: { payrollPeriodId: periodApr27.id } });
      for (const r of runs) await cleanupRun(r.id);
      await prisma.payrollPeriod.delete({ where: { id: periodApr27.id } }).catch(() => null);
    }
    if (immEmp?.id) {
      await prisma.attendanceLog.deleteMany({ where: { employeeId: immEmp.id } });
      await prisma.salaryStructure.deleteMany({ where: { employeeId: immEmp.id } });
      await prisma.employee.delete({ where: { id: immEmp.id } }).catch(() => null);
    }
  });

  it('should lock payroll run against recalculation after payslips are issued', async () => {
    await expect(runService.calculatePayrollRun(postedRun.id, superAdminUser)).rejects.toThrow(
      BadRequestException,
    );
    await expect(runService.recalculatePayrollRun(postedRun.id, superAdminUser)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should preserve original pdfHash and payslipNumber upon subsequent generation attempts', async () => {
    const reGenSlips = await payslipService.generatePayslipsForRun(postedRun.id, superAdminUser);
    const reGenSlip = reGenSlips.find((s: any) => s.id === issuedSlip.id);

    expect(reGenSlip).toBeDefined();
    expect(reGenSlip.pdfHash).toBe(issuedSlip.pdfHash);
    expect(reGenSlip.payslipNumber).toBe(issuedSlip.payslipNumber);
    expect(reGenSlip.status).toBe(PayslipStatus.ISSUED);
  });
});
