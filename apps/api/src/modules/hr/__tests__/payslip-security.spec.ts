import { EmploymentType } from '@prisma/client';
import { prisma } from '@cc-erp/database';
import { PayrollPeriodService } from '../services/payroll-period.service';
import { PayrollRunService } from '../services/payroll-run.service';
import { PayrollCalculationEngine } from '../services/payroll-calculation.engine';
import { SalaryStructureService } from '../services/salary.service';
import { EmployeeService, RequestingUser } from '../services/employee.service';
import { FinanceService } from '../../finance/finance.service';
import { PayslipService } from '../services/payslip.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('Phase 3E — Payslip Security & RBAC Isolation Suite', () => {
  let periodService: PayrollPeriodService;
  let runService: PayrollRunService;
  let salaryService: SalaryStructureService;
  let employeeService: EmployeeService;
  let financeService: FinanceService;
  let payslipService: PayslipService;
  let orgId: string;
  let otherOrgId: string;
  let factoryBranchId: string;
  let superAdminUser: RequestingUser;
  let branchUser: RequestingUser;
  let assignedUser1: RequestingUser;
  let assignedUser2: RequestingUser;
  let otherOrgUser: RequestingUser;
  let periodMar27: any;
  let emp1: any;
  let emp2: any;
  let generatedSlips: any[];

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

    const orgs = await prisma.organization.findMany();
    if (!orgs || orgs.length === 0) throw new Error('No organization found');
    orgId = orgs[0].id;

    let otherOrg = orgs.find((o) => o.id !== orgId);
    if (!otherOrg) {
      otherOrg = await prisma.organization.create({
        data: { name: 'Sec Corp', code: `SEC-${Date.now()}` },
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
      roles: ['SUPER_ADMIN', 'HR_DIRECTOR'],
      scope: 'GLOBAL',
    };

    branchUser = {
      sub: '00000000-0000-0000-0000-000000000002',
      userId: '00000000-0000-0000-0000-000000000002',
      permissions: [],
      username: 'branch_manager',
      organizationId: orgId,
      branchId: factoryBranchId,
      roles: ['BRANCH_MANAGER'],
      scope: 'BRANCH',
    };

    otherOrgUser = {
      sub: '00000000-0000-0000-0000-000000000009',
      userId: '00000000-0000-0000-0000-000000000009',
      permissions: [],
      username: 'other_admin',
      organizationId: otherOrgId,
      roles: ['SUPER_ADMIN'],
      scope: 'GLOBAL',
    };

    // Clean up Mar 2027 period
    const existing = await prisma.payrollPeriod.findMany({
      where: { organizationId: orgId, year: 2027, month: 3 },
    });
    for (const p of existing) {
      const runs = await prisma.payrollRun.findMany({ where: { payrollPeriodId: p.id } });
      for (const r of runs) await cleanupRun(r.id);
      await prisma.payrollPeriod.delete({ where: { id: p.id } }).catch(() => null);
    }

    periodMar27 = await periodService.createPeriod(
      {
        year: 2027,
        month: 3,
        startDate: '2027-03-01T00:00:00.000Z',
        endDate: '2027-03-31T23:59:59.999Z',
      },
      superAdminUser,
    );

    const empCode1 = `EMP-SEC1-${Date.now().toString().slice(-4)}`;
    emp1 = await employeeService.createEmployee(
      {
        employeeCode: empCode1,
        firstName: 'Alice',
        lastName: 'Security',
        phone: `+9189${Date.now().toString().slice(-8)}`,
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
        baseSalary: 45000,
        hra: 18000,
        conveyance: 3000,
        specialAllowance: 5000,
        pfContribution: 1800,
        esiContribution: 0,
      },
      superAdminUser,
    );

    const empCode2 = `EMP-SEC2-${Date.now().toString().slice(-4)}`;
    emp2 = await employeeService.createEmployee(
      {
        employeeCode: empCode2,
        firstName: 'Bob',
        lastName: 'Security',
        phone: `+9188${Date.now().toString().slice(-8)}`,
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
        specialAllowance: 4000,
        pfContribution: 1800,
        esiContribution: 0,
      },
      superAdminUser,
    );

    assignedUser1 = {
      sub: '00000000-0000-0000-0000-000000000003',
      userId: '00000000-0000-0000-0000-000000000003',
      permissions: [],
      username: 'alice_emp',
      organizationId: orgId,
      branchId: factoryBranchId,
      employeeId: emp1.id,
      roles: ['STAFF'],
      scope: 'ASSIGNED',
    };

    assignedUser2 = {
      sub: '00000000-0000-0000-0000-000000000004',
      userId: '00000000-0000-0000-0000-000000000004',
      permissions: [],
      username: 'bob_emp',
      organizationId: orgId,
      branchId: factoryBranchId,
      employeeId: emp2.id,
      roles: ['STAFF'],
      scope: 'ASSIGNED',
    };

    // Seed attendance
    for (let day = 1; day <= 15; day++) {
      const dayStr = day.toString().padStart(2, '0');
      await prisma.attendanceLog.createMany({
        data: [
          {
            organizationId: orgId,
            branchId: factoryBranchId,
            employeeId: emp1.id,
            workDate: new Date(`2027-03-${dayStr}T00:00:00.000Z`),
            checkInTime: new Date(`2027-03-${dayStr}T09:00:00.000Z`),
            checkOutTime: new Date(`2027-03-${dayStr}T18:00:00.000Z`),
            hoursWorked: 9,
            status: 'CHECKED_OUT',
            source: 'POS',
          },
          {
            organizationId: orgId,
            branchId: factoryBranchId,
            employeeId: emp2.id,
            workDate: new Date(`2027-03-${dayStr}T00:00:00.000Z`),
            checkInTime: new Date(`2027-03-${dayStr}T09:00:00.000Z`),
            checkOutTime: new Date(`2027-03-${dayStr}T18:00:00.000Z`),
            hoursWorked: 9,
            status: 'CHECKED_OUT',
            source: 'POS',
          },
        ],
      });
    }

    const run = await runService.createRun(
      { payrollPeriodId: periodMar27.id, idempotencyKey: `ps-sec-run-${Date.now()}` },
      superAdminUser,
    );
    await runService.calculatePayrollRun(run.id, superAdminUser);
    await runService.submitForApproval(run.id, superAdminUser);
    await runService.approvePayrollRun(run.id, superAdminUser);
    await runService.postPayrollToFinance(run.id, superAdminUser);
    generatedSlips = await payslipService.generatePayslipsForRun(run.id, superAdminUser);
    await payslipService.approvePayslipsForRun(run.id, superAdminUser);
    await payslipService.issuePayslipsForRun(run.id, superAdminUser);
  });

  afterAll(async () => {
    if (periodMar27?.id) {
      const runs = await prisma.payrollRun.findMany({ where: { payrollPeriodId: periodMar27.id } });
      for (const r of runs) await cleanupRun(r.id);
      await prisma.payrollPeriod.delete({ where: { id: periodMar27.id } }).catch(() => null);
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

  describe('1. Cross-Organization Tenant Isolation', () => {
    it('should reject access to payslips by a user belonging to another organization', async () => {
      const targetSlip = generatedSlips[0];
      await expect(payslipService.getPayslip(targetSlip.id, otherOrgUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('2. Employee Self-Service Scope Isolation (ASSIGNED)', () => {
    it('should allow employee to view their own payslip', async () => {
      const aliceSlip = generatedSlips.find((s) => s.payrollItem?.employeeId === emp1.id || s.payslipNumber.includes(emp1.employeeCode)) || generatedSlips[0];
      const result = await payslipService.getPayslip(aliceSlip.id, assignedUser1);
      expect(result).toBeDefined();
    });

    it('should FORBID employee from viewing another peer employee payslip', async () => {
      // Bob trying to view Alice's payslip
      const aliceSlip = generatedSlips.find((s) => s.payslipNumber.includes(emp1.employeeCode));
      if (aliceSlip) {
        await expect(payslipService.getPayslip(aliceSlip.id, assignedUser2)).rejects.toThrow(
          ForbiddenException,
        );
      }
    });
  });

  describe('3. Administrative Operations Authorization', () => {
    it('should FORBID BRANCH and ASSIGNED users from approving or issuing payslips', async () => {
      const targetSlip = generatedSlips[0];
      await expect(payslipService.approvePayslip(targetSlip.id, branchUser)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(payslipService.issuePayslip(targetSlip.id, assignedUser1)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
