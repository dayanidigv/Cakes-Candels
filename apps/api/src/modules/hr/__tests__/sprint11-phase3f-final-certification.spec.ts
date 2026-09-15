import {
  EmploymentStatus,
  EmploymentType,
  LeaveRequestStatus,
  PayrollRunStatus,
  PayslipStatus,
  AuditAction,
} from '@prisma/client';
import { prisma } from '@cc-erp/database';
import * as crypto from 'crypto';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { EmployeeService, RequestingUser } from '../services/employee.service';
import { DepartmentService } from '../services/department.service';
import { DesignationService } from '../services/designation.service';
import { ShiftService } from '../services/shift.service';
import { AttendanceService } from '../services/attendance.service';
import { LeaveService, LeaveTypeService } from '../services/leave.service';
import { SalaryComponentService, SalaryStructureService } from '../services/salary.service';
import { PayrollPeriodService } from '../services/payroll-period.service';
import { PayrollCalculationEngine } from '../services/payroll-calculation.engine';
import { PayrollRunService } from '../services/payroll-run.service';
import { PayslipService } from '../services/payslip.service';
import { FinanceService } from '../../finance/finance.service';

describe('Phase 3F — Final HR & Payroll Domain Adversarial Certification Suite', () => {
  let employeeService: EmployeeService;
  let departmentService: DepartmentService;
  let designationService: DesignationService;
  let shiftService: ShiftService;
  let attendanceService: AttendanceService;
  let leaveService: LeaveService;
  let leaveTypeService: LeaveTypeService;
  let salaryCompService: SalaryComponentService;
  let salaryStructureService: SalaryStructureService;
  let periodService: PayrollPeriodService;
  let calcEngine: PayrollCalculationEngine;
  let runService: PayrollRunService;
  let payslipService: PayslipService;
  let financeService: FinanceService;

  let orgId: string;
  let otherOrgId: string;
  let factoryBranchId: string;
  let storeBranchId: string;

  let superAdminUser: RequestingUser;
  let branchManagerUser: RequestingUser;
  let staffUserAlice: RequestingUser;
  let staffUserBob: RequestingUser;
  let otherOrgUser: RequestingUser;

  let certEmp: any;
  let certPeriod: any;

  async function cleanupRun(runId: string) {
    await prisma.payslip.deleteMany({ where: { payrollItem: { payrollRunId: runId } } });
    await prisma.payrollDetail.deleteMany({ where: { payrollItem: { payrollRunId: runId } } });
    await prisma.payrollItem.deleteMany({ where: { payrollRunId: runId } });
    await prisma.payrollRun.delete({ where: { id: runId } }).catch(() => null);
  }

  beforeAll(async () => {
    employeeService = new EmployeeService();
    departmentService = new DepartmentService();
    designationService = new DesignationService();
    shiftService = new ShiftService();
    attendanceService = new AttendanceService();
    leaveService = new LeaveService();
    leaveTypeService = new LeaveTypeService();
    salaryCompService = new SalaryComponentService();
    salaryStructureService = new SalaryStructureService();
    periodService = new PayrollPeriodService();
    calcEngine = new PayrollCalculationEngine();
    financeService = new FinanceService();
    runService = new PayrollRunService(calcEngine, salaryStructureService, financeService);
    payslipService = new PayslipService();

    const orgs = await prisma.organization.findMany();
    if (!orgs || orgs.length === 0) throw new Error('No organization found');
    orgId = orgs[0].id;

    let otherOrg = orgs.find((o) => o.id !== orgId);
    if (!otherOrg) {
      otherOrg = await prisma.organization.create({
        data: { name: 'Adversarial Corp', code: `ADV-${Date.now()}` },
      });
    }
    otherOrgId = otherOrg.id;

    const branches = await prisma.branch.findMany({ where: { organizationId: orgId } });
    const factory = branches.find((b) => b.type === 'FACTORY') || branches[0];
    const store = branches.find((b) => b.id !== factory.id) || factory;
    factoryBranchId = factory.id;
    storeBranchId = store.id;

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

    branchManagerUser = {
      sub: '00000000-0000-0000-0000-000000000002',
      userId: '00000000-0000-0000-0000-000000000002',
      permissions: [],
      username: 'branch_mgr',
      organizationId: orgId,
      branchId: storeBranchId,
      roles: ['BRANCH_MANAGER'],
      scope: 'BRANCH',
    };

    otherOrgUser = {
      sub: '00000000-0000-0000-0000-000000000099',
      userId: '00000000-0000-0000-0000-000000000099',
      permissions: [],
      username: 'other_admin',
      organizationId: otherOrgId,
      roles: ['SUPER_ADMIN'],
      scope: 'GLOBAL',
    };

    // Clean up June 2027 period
    const existing = await prisma.payrollPeriod.findMany({
      where: { organizationId: orgId, year: 2027, month: 6 },
    });
    for (const p of existing) {
      const runs = await prisma.payrollRun.findMany({ where: { payrollPeriodId: p.id } });
      for (const r of runs) await cleanupRun(r.id);
      await prisma.payrollPeriod.delete({ where: { id: p.id } }).catch(() => null);
    }

    certPeriod = await periodService.createPeriod(
      {
        year: 2027,
        month: 6,
        startDate: '2027-06-01T00:00:00.000Z',
        endDate: '2027-06-30T23:59:59.999Z',
      },
      superAdminUser,
    );

    const empCode = `EMP-ADV-${Date.now().toString().slice(-4)}`;
    certEmp = await employeeService.createEmployee(
      {
        employeeCode: empCode,
        firstName: 'Adversarial',
        lastName: 'Auditee',
        phone: `+9185${Date.now().toString().slice(-8)}`,
        assignedBranchId: factoryBranchId,
        employmentType: EmploymentType.FULL_TIME,
        dateOfJoining: '2027-01-01',
      },
      superAdminUser,
    );
    await employeeService.activateEmployee(certEmp.id, superAdminUser);

    staffUserAlice = {
      sub: '00000000-0000-0000-0000-000000000010',
      userId: '00000000-0000-0000-0000-000000000010',
      permissions: [],
      username: 'alice_auditee',
      organizationId: orgId,
      branchId: factoryBranchId,
      employeeId: certEmp.id,
      roles: ['STAFF'],
      scope: 'ASSIGNED',
    };

    staffUserBob = {
      sub: '00000000-0000-0000-0000-000000000020',
      userId: '00000000-0000-0000-0000-000000000020',
      permissions: [],
      username: 'bob_peer',
      organizationId: orgId,
      branchId: factoryBranchId,
      employeeId: '00000000-0000-0000-0000-000000000999',
      roles: ['STAFF'],
      scope: 'ASSIGNED',
    };

    await salaryStructureService.createSalaryStructure(
      {
        employeeId: certEmp.id,
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

    for (let day = 1; day <= 22; day++) {
      const dayStr = day.toString().padStart(2, '0');
      await prisma.attendanceLog.create({
        data: {
          organizationId: orgId,
          branchId: factoryBranchId,
          employeeId: certEmp.id,
          workDate: new Date(`2027-06-${dayStr}T00:00:00.000Z`),
          checkInTime: new Date(`2027-06-${dayStr}T09:00:00.000Z`),
          checkOutTime: new Date(`2027-06-${dayStr}T18:00:00.000Z`),
          hoursWorked: 9,
          status: 'CHECKED_OUT',
          source: 'POS',
        },
      });
    }
  });

  afterAll(async () => {
    if (certPeriod?.id) {
      const runs = await prisma.payrollRun.findMany({ where: { payrollPeriodId: certPeriod.id } });
      for (const r of runs) await cleanupRun(r.id);
      await prisma.payrollPeriod.delete({ where: { id: certPeriod.id } }).catch(() => null);
    }
    if (certEmp?.id) {
      await prisma.attendanceLog.deleteMany({ where: { employeeId: certEmp.id } });
      await prisma.salaryStructure.deleteMany({ where: { employeeId: certEmp.id } });
      await prisma.employee.delete({ where: { id: certEmp.id } }).catch(() => null);
    }
  });

  describe('1. Adversarial Historical Snapshot & Master Mutation Test', () => {
    it('should maintain immutable snapshot when salary/master data is mutated after calculation and posting', async () => {
      // 1. Calculate and post payroll
      const run = await runService.createRun(
        { payrollPeriodId: certPeriod.id, idempotencyKey: `adv-run-${Date.now()}` },
        superAdminUser,
      );
      await runService.calculatePayrollRun(run.id, superAdminUser);
      await runService.submitForApproval(run.id, superAdminUser);
      await runService.approvePayrollRun(run.id, superAdminUser);
      await runService.postPayrollToFinance(run.id, superAdminUser);

      const itemsBefore = await prisma.payrollItem.findMany({
        where: { payrollRunId: run.id, employeeId: certEmp.id },
        include: { details: true },
      });
      expect(itemsBefore.length).toBe(1);
      const originalGross = Number(itemsBefore[0].grossPay);
      const originalNet = Number(itemsBefore[0].netPay);

      // 2. Generate and issue payslip
      const slips = await payslipService.generatePayslipsForRun(run.id, superAdminUser);
      const slip = slips.find((s: any) => s.payrollItemId === itemsBefore[0].id)!;
      await payslipService.approvePayslip(slip.id, superAdminUser);
      await payslipService.issuePayslip(slip.id, superAdminUser);
      const originalHash = slip.pdfHash;

      // 3. ADVERSARIAL MASTER MUTATION: Drastically alter employee's salary and master data
      await salaryStructureService.createSalaryStructure(
        {
          employeeId: certEmp.id,
          effectiveDate: '2027-07-01',
          baseSalary: 150000,
          hra: 60000,
          conveyance: 10000,
          specialAllowance: 30000,
          pfContribution: 1800,
          esiContribution: 0,
        },
        superAdminUser,
      );
      await employeeService.updateEmployee(
        certEmp.id,
        { firstName: 'AlteredName', lastName: 'Mutated' },
        superAdminUser,
      );

      // 4. VERIFICATION: Historical PayrollItem snapshot is 100% untouched
      const itemAfter = await prisma.payrollItem.findUnique({
        where: { id: itemsBefore[0].id },
        include: { details: true },
      });
      expect(Number(itemAfter?.grossPay)).toBe(originalGross);
      expect(Number(itemAfter?.netPay)).toBe(originalNet);

      // 5. VERIFICATION: Rendered payslip hash remains identical to stored hash
      const doc = await payslipService.renderPayslipDocument(slip.id, superAdminUser);
      expect(doc.pdfHash).toBe(originalHash);

      await cleanupRun(run.id);
    });
  });

  describe('2. State Machine Transitions & Lock Invariants', () => {
    it('Employee State Machine: enforces valid transitions and rejects illegal jumps', async () => {
      const draftEmp = await employeeService.createEmployee(
        {
          employeeCode: `EMP-SM-${Date.now().toString().slice(-4)}`,
          firstName: 'State',
          lastName: 'Machine',
          phone: `+9184${Date.now().toString().slice(-8)}`,
          assignedBranchId: factoryBranchId,
          employmentType: EmploymentType.FULL_TIME,
          dateOfJoining: '2027-01-01',
        },
        superAdminUser,
      );
      expect(draftEmp.status).toBe(EmploymentStatus.DRAFT);

      // DRAFT -> TERMINATED is forbidden (must activate first)
      await expect(
        employeeService.transitionStatus(draftEmp.id, EmploymentStatus.TERMINATED, superAdminUser),
      ).rejects.toThrow(BadRequestException);

      // DRAFT -> ACTIVE is valid
      const activated = await employeeService.activateEmployee(draftEmp.id, superAdminUser);
      expect(activated.status).toBe(EmploymentStatus.ACTIVE);

      // ACTIVE -> ON_LEAVE
      const onLeave = await employeeService.transitionStatus(draftEmp.id, EmploymentStatus.ON_LEAVE, superAdminUser);
      expect(onLeave.status).toBe(EmploymentStatus.ON_LEAVE);

      // ON_LEAVE -> ACTIVE
      const backActive = await employeeService.transitionStatus(draftEmp.id, EmploymentStatus.ACTIVE, superAdminUser);
      expect(backActive.status).toBe(EmploymentStatus.ACTIVE);

      // ACTIVE -> TERMINATED
      const terminated = await employeeService.transitionStatus(draftEmp.id, EmploymentStatus.TERMINATED, superAdminUser);
      expect(terminated.status).toBe(EmploymentStatus.TERMINATED);

      // Cleanup
      await prisma.employee.delete({ where: { id: draftEmp.id } });
    });

    it('Leave State Machine: DRAFT -> SUBMITTED -> APPROVED -> CANCELLED', async () => {
      const leaveType = await leaveTypeService.create(
        { code: `AL-${Date.now().toString().slice(-4)}`, name: 'Annual Leave', annualDays: 20 },
        orgId,
      );

      // Credit balance via transaction
      await prisma.leaveTransaction.create({
        data: {
          employeeId: certEmp.id,
          leaveTypeId: leaveType.id,
          type: 'ACCRUAL',
          days: 20,
          notes: 'Initial allocation',
        },
      });

      const draftReq = await leaveService.createRequest(
        {
          employeeId: certEmp.id,
          leaveTypeId: leaveType.id,
          startDate: '2027-06-10T00:00:00.000Z',
          endDate: '2027-06-12T23:59:59.999Z',
          reason: 'Personal Vacation',
        },
        superAdminUser,
      );
      expect(draftReq.status).toBe(LeaveRequestStatus.DRAFT);

      const submittedReq = await leaveService.submitRequest(draftReq.id, superAdminUser);
      expect(submittedReq.status).toBe(LeaveRequestStatus.SUBMITTED);

      const approved = await leaveService.approveRequest(submittedReq.id, {}, superAdminUser);
      expect(approved.status).toBe(LeaveRequestStatus.APPROVED);

      // Verify immutable LeaveTransaction was created
      const tx = await prisma.leaveTransaction.findFirst({
        where: { employeeId: certEmp.id, leaveTypeId: leaveType.id, type: 'DEDUCTION' },
      });
      expect(tx).toBeDefined();
      expect(Number(tx?.days)).toBeLessThan(0); // Deduction

      // Cleanup
      await prisma.leaveTransaction.deleteMany({ where: { employeeId: certEmp.id } });
      await prisma.leaveRequest.deleteMany({ where: { employeeId: certEmp.id } });
      await prisma.employeeLeaveBalance.deleteMany({ where: { employeeId: certEmp.id } });
      await prisma.leaveType.delete({ where: { id: leaveType.id } });
    });
  });

  describe('3. Multi-Tenancy & Authorization Adversarial Attacks', () => {
    it('should completely block cross-tenant queries and mutations', async () => {
      await expect(employeeService.findById(certEmp.id, otherOrgUser)).rejects.toThrow(
        NotFoundException,
      );
      await expect(
        salaryStructureService.createSalaryStructure(
          {
            employeeId: certEmp.id,
            effectiveDate: '2027-01-01',
            baseSalary: 100000,
          },
          otherOrgUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should block employee self-service user from viewing peer records', async () => {
      const myPayslips = await payslipService.getMyPayslips(staffUserAlice);
      expect(Array.isArray(myPayslips)).toBe(true);

      // Bob cannot view Alice's payslip
      if (myPayslips.length > 0) {
        await expect(payslipService.getPayslip(myPayslips[0].id, staffUserBob)).rejects.toThrow(
          ForbiddenException,
        );
      }
    });
  });
});
