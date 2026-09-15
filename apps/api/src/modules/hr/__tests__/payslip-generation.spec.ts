import { PayrollRunStatus, EmploymentType, PayslipStatus } from '@prisma/client';
import { prisma } from '@cc-erp/database';
import { PayrollPeriodService } from '../services/payroll-period.service';
import { PayrollRunService } from '../services/payroll-run.service';
import { PayrollCalculationEngine } from '../services/payroll-calculation.engine';
import { SalaryStructureService } from '../services/salary.service';
import { EmployeeService, RequestingUser } from '../services/employee.service';
import { FinanceService } from '../../finance/finance.service';
import { PayslipService } from '../services/payslip.service';
import { BadRequestException } from '@nestjs/common';

describe('Phase 3E — Payslip Generation & State Machine Specification', () => {
  let periodService: PayrollPeriodService;
  let runService: PayrollRunService;
  let salaryService: SalaryStructureService;
  let employeeService: EmployeeService;
  let financeService: FinanceService;
  let payslipService: PayslipService;
  let orgId: string;
  let factoryBranchId: string;
  let superAdminUser: RequestingUser;
  let periodJan27: any;
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

    // Clean up Jan 2027 period
    const existing = await prisma.payrollPeriod.findMany({
      where: { organizationId: orgId, year: 2027, month: 1 },
    });
    for (const p of existing) {
      const runs = await prisma.payrollRun.findMany({ where: { payrollPeriodId: p.id } });
      for (const r of runs) await cleanupRun(r.id);
      await prisma.payrollPeriod.delete({ where: { id: p.id } }).catch(() => null);
    }

    periodJan27 = await periodService.createPeriod(
      {
        year: 2027,
        month: 1,
        startDate: '2027-01-01T00:00:00.000Z',
        endDate: '2027-01-31T23:59:59.999Z',
      },
      superAdminUser,
    );

    // Create 2 test employees
    const empCode1 = `EMP-SLIP1-${Date.now().toString().slice(-4)}`;
    emp1 = await employeeService.createEmployee(
      {
        employeeCode: empCode1,
        firstName: 'Slip',
        lastName: 'One',
        phone: `+9191${Date.now().toString().slice(-8)}`,
        assignedBranchId: factoryBranchId,
        employmentType: EmploymentType.FULL_TIME,
        dateOfJoining: '2027-01-01',
      },
      superAdminUser,
    );
    await employeeService.activateEmployee(emp1.id, superAdminUser);
    await salaryService.createSalaryStructure(
      {
        employeeId: emp1.id,
        effectiveDate: '2027-01-01',
        baseSalary: 50000,
        hra: 20000,
        conveyance: 3000,
        specialAllowance: 7000,
        pfContribution: 1800,
        esiContribution: 0,
      },
      superAdminUser,
    );

    const empCode2 = `EMP-SLIP2-${Date.now().toString().slice(-4)}`;
    emp2 = await employeeService.createEmployee(
      {
        employeeCode: empCode2,
        firstName: 'Slip',
        lastName: 'Two',
        phone: `+9192${Date.now().toString().slice(-8)}`,
        assignedBranchId: factoryBranchId,
        employmentType: EmploymentType.FULL_TIME,
        dateOfJoining: '2027-01-01',
      },
      superAdminUser,
    );
    await employeeService.activateEmployee(emp2.id, superAdminUser);
    await salaryService.createSalaryStructure(
      {
        employeeId: emp2.id,
        effectiveDate: '2027-01-01',
        baseSalary: 40000,
        hra: 16000,
        conveyance: 2000,
        specialAllowance: 5000,
        pfContribution: 1800,
        esiContribution: 0,
      },
      superAdminUser,
    );

    // Attendance
    for (let day = 1; day <= 20; day++) {
      const dayStr = day.toString().padStart(2, '0');
      await prisma.attendanceLog.createMany({
        data: [
          {
            organizationId: orgId,
            branchId: factoryBranchId,
            employeeId: emp1.id,
            workDate: new Date(`2027-01-${dayStr}T00:00:00.000Z`),
            checkInTime: new Date(`2027-01-${dayStr}T09:00:00.000Z`),
            checkOutTime: new Date(`2027-01-${dayStr}T18:00:00.000Z`),
            hoursWorked: 9,
            status: 'CHECKED_OUT',
            source: 'POS',
          },
          {
            organizationId: orgId,
            branchId: factoryBranchId,
            employeeId: emp2.id,
            workDate: new Date(`2027-01-${dayStr}T00:00:00.000Z`),
            checkInTime: new Date(`2027-01-${dayStr}T09:00:00.000Z`),
            checkOutTime: new Date(`2027-01-${dayStr}T18:00:00.000Z`),
            hoursWorked: 9,
            status: 'CHECKED_OUT',
            source: 'POS',
          },
        ],
      });
    }
  }, 30000);

  afterAll(async () => {
    if (periodJan27?.id) {
      const runs = await prisma.payrollRun.findMany({ where: { payrollPeriodId: periodJan27.id } });
      for (const r of runs) await cleanupRun(r.id);
      await prisma.payrollPeriod.delete({ where: { id: periodJan27.id } }).catch(() => null);
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

  describe('1. Generation Invariants & Pre-requisites', () => {
    it('should reject payslip generation from non-POSTED/PAID payroll runs', async () => {
      const draftRun = await runService.createRun(
        { payrollPeriodId: periodJan27.id, idempotencyKey: `ps-gen-draft-${Date.now()}` },
        superAdminUser,
      );

      // Attempt generation on DRAFT
      await expect(payslipService.generatePayslipsForRun(draftRun.id, superAdminUser)).rejects.toThrow(
        BadRequestException,
      );

      // Attempt generation on CALCULATED
      await runService.calculatePayrollRun(draftRun.id, superAdminUser);
      await expect(payslipService.generatePayslipsForRun(draftRun.id, superAdminUser)).rejects.toThrow(
        BadRequestException,
      );

      // Attempt generation on PENDING_APPROVAL
      await runService.submitForApproval(draftRun.id, superAdminUser);
      await expect(payslipService.generatePayslipsForRun(draftRun.id, superAdminUser)).rejects.toThrow(
        BadRequestException,
      );

      // Attempt generation on APPROVED (must post to finance first)
      await runService.approvePayrollRun(draftRun.id, superAdminUser);
      await expect(payslipService.generatePayslipsForRun(draftRun.id, superAdminUser)).rejects.toThrow(
        BadRequestException,
      );

      await cleanupRun(draftRun.id);
    });

    it('should successfully generate immutable payslips once payroll run is POSTED', async () => {
      const postRun = await runService.createRun(
        { payrollPeriodId: periodJan27.id, idempotencyKey: `ps-gen-post-${Date.now()}` },
        superAdminUser,
      );
      await runService.calculatePayrollRun(postRun.id, superAdminUser);
      await runService.submitForApproval(postRun.id, superAdminUser);
      await runService.approvePayrollRun(postRun.id, superAdminUser);
      await runService.postPayrollToFinance(postRun.id, superAdminUser);

      const payslips = await payslipService.generatePayslipsForRun(postRun.id, superAdminUser);
      expect(payslips.length).toBeGreaterThanOrEqual(2);

      for (const slip of payslips) {
        expect(slip.status).toBe(PayslipStatus.GENERATED);
        expect(slip.pdfHash).toBeDefined();
        expect(slip.pdfHash.length).toBe(64); // SHA-256
        expect(slip.payslipNumber).toMatch(/^PS-202701-/);
      }

      await cleanupRun(postRun.id);
    });
  });

  describe('2. State Machine Transitions: GENERATED -> APPROVED -> ISSUED', () => {
    let testRun: any;
    let payslips: any[];

    beforeAll(async () => {
      testRun = await runService.createRun(
        { payrollPeriodId: periodJan27.id, idempotencyKey: `ps-sm-${Date.now()}` },
        superAdminUser,
      );
      await runService.calculatePayrollRun(testRun.id, superAdminUser);
      await runService.submitForApproval(testRun.id, superAdminUser);
      await runService.approvePayrollRun(testRun.id, superAdminUser);
      await runService.postPayrollToFinance(testRun.id, superAdminUser);
      payslips = await payslipService.generatePayslipsForRun(testRun.id, superAdminUser);
    });

    afterAll(async () => {
      await cleanupRun(testRun.id);
    });

    it('should forbid direct transition from GENERATED to ISSUED (must be APPROVED first)', async () => {
      const targetSlip = payslips[0];
      await expect(payslipService.issuePayslip(targetSlip.id, superAdminUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should transition GENERATED -> APPROVED upon auditor approval', async () => {
      const targetSlip = payslips[0];
      const approved = await payslipService.approvePayslip(targetSlip.id, superAdminUser);
      expect(approved.status).toBe(PayslipStatus.APPROVED);

      // Verify idempotency of approval
      const reApproved = await payslipService.approvePayslip(targetSlip.id, superAdminUser);
      expect(reApproved.status).toBe(PayslipStatus.APPROVED);
    });

    it('should transition APPROVED -> ISSUED upon distribution dispatch', async () => {
      const targetSlip = payslips[0];
      const issued = await payslipService.issuePayslip(targetSlip.id, superAdminUser);
      expect(issued.status).toBe(PayslipStatus.ISSUED);
      expect(issued.issuedAt).toBeDefined();

      // Verify idempotency of issuance
      const reIssued = await payslipService.issuePayslip(targetSlip.id, superAdminUser);
      expect(reIssued.status).toBe(PayslipStatus.ISSUED);
    });

    it('should support bulk approval and bulk issuance across an entire payroll run', async () => {
      const bulkApproved = await payslipService.approvePayslipsForRun(testRun.id, superAdminUser);
      expect(bulkApproved.every((s) => s.status === PayslipStatus.APPROVED || s.status === PayslipStatus.ISSUED)).toBe(true);

      const bulkIssued = await payslipService.issuePayslipsForRun(testRun.id, superAdminUser);
      expect(bulkIssued.every((s) => s.status === PayslipStatus.ISSUED)).toBe(true);
    });
  });
});
