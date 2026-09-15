import { PayrollRunStatus, EmploymentType, AttendanceStatus, LeaveRequestStatus } from '@prisma/client';
import { prisma } from '@cc-erp/database';
import { PayrollPeriodService } from '../services/payroll-period.service';
import { PayrollRunService } from '../services/payroll-run.service';
import { PayrollCalculationEngine } from '../services/payroll-calculation.engine';
import { SalaryStructureService } from '../services/salary.service';
import { EmployeeService, RequestingUser } from '../services/employee.service';
import { FinanceService } from '../../finance/finance.service';

describe('Phase 3C — Payroll Run Lifecycle & Execution Specification', () => {
  let periodService: PayrollPeriodService;
  let runService: PayrollRunService;
  let salaryService: SalaryStructureService;
  let employeeService: EmployeeService;
  let financeService: FinanceService;
  let orgId: string;
  let factoryBranchId: string;
  let superAdminUser: RequestingUser;
  let testPeriod: any;
  let testEmp: any;

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
      scope: 'GLOBAL',
      roles: ['SUPER_ADMIN'],
    };

    // Create test period for April 2026 (30 days)
    testPeriod = await periodService.createPeriod(
      { year: 2026, month: 4 },
      superAdminUser,
    );

    // Create active employee with salary structure
    testEmp = await employeeService.createEmployee(
      {
        employeeCode: `EMP-RUN-${Date.now()}`,
        firstName: 'Run',
        lastName: 'Tester',
        phone: '+919999944441',
        dateOfJoining: '2026-01-01',
        assignedBranchId: factoryBranchId,
        employmentType: EmploymentType.FULL_TIME,
      },
      superAdminUser,
    );
    await employeeService.activateEmployee(testEmp.id, superAdminUser);

    await salaryService.createSalaryStructure(
      {
        employeeId: testEmp.id,
        effectiveDate: '2026-01-01',
        baseSalary: 30000,
        hra: 12000,
        conveyance: 3000,
        specialAllowance: 5000,
      },
      superAdminUser,
    );

    // Add 26 attendance records and 2 approved leave days
    for (let d = 1; d <= 26; d++) {
      const dayStr = d.toString().padStart(2, '0');
      await prisma.attendanceLog.create({
        data: {
          organizationId: orgId,
          branchId: factoryBranchId,
          employeeId: testEmp.id,
          workDate: new Date(`2026-04-${dayStr}T00:00:00.000Z`),
          checkInTime: new Date(`2026-04-${dayStr}T09:00:00.000Z`),
          checkOutTime: new Date(`2026-04-${dayStr}T18:00:00.000Z`),
          hoursWorked: 8,
          overtimeHours: d <= 5 ? 2 : 0, // Total 10 hours overtime
          status: AttendanceStatus.FINALIZED,
        },
      });
    }

    // Add 2 approved leave days
    const leaveType = await prisma.leaveType.findFirst({ where: { organizationId: orgId } });
    if (leaveType) {
      await prisma.leaveRequest.create({
        data: {
          organizationId: orgId,
          employeeId: testEmp.id,
          leaveTypeId: leaveType.id,
          startDate: new Date('2026-04-27T00:00:00.000Z'),
          endDate: new Date('2026-04-28T00:00:00.000Z'),
          totalDays: 2,
          reason: 'Medical Leave',
          status: LeaveRequestStatus.APPROVED,
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.payrollDetail.deleteMany({ where: { payrollItem: { employeeId: testEmp.id } } });
    await prisma.payrollItem.deleteMany({ where: { employeeId: testEmp.id } });
    await prisma.payrollRun.deleteMany({ where: { payrollPeriodId: testPeriod.id } });
    await prisma.payrollPeriod.delete({ where: { id: testPeriod.id } });
    await prisma.attendanceLog.deleteMany({ where: { employeeId: testEmp.id } });
    await prisma.leaveRequest.deleteMany({ where: { employeeId: testEmp.id } });
    await prisma.salaryStructure.deleteMany({ where: { employeeId: testEmp.id } });
    await prisma.employee.delete({ where: { id: testEmp.id } });
    await prisma.$disconnect();
  });

  it('Gate 1: Should execute full Payroll Run lifecycle through CALCULATED state', async () => {
    // 1. Create Run in DRAFT
    const run = await runService.createRun(
      { payrollPeriodId: testPeriod.id },
      superAdminUser,
    );

    expect(run.id).toBeDefined();
    expect(run.status).toBe(PayrollRunStatus.DRAFT);

    // 2. Calculate Run -> transitions to CALCULATED
    const calculatedRun = await runService.calculatePayrollRun(run.id, superAdminUser);
    expect(calculatedRun.status).toBe(PayrollRunStatus.CALCULATED);
    expect(calculatedRun.totalEmployees).toBeGreaterThanOrEqual(1);
    expect(Number(calculatedRun.totalNetPay)).toBeGreaterThan(0);

    // Verify Outbox Event
    const outbox = await prisma.outboxEvent.findFirst({
      where: { type: 'hr.payroll.calculated' },
      orderBy: { createdAt: 'desc' },
    });
    expect(outbox).toBeDefined();

    // Verify PayrollItems & Details exist
    const items = await runService.getRunItems(run.id, superAdminUser);
    const empItem = items.find((i) => i.employeeId === testEmp.id);
    expect(empItem).toBeDefined();
    expect(Number(empItem?.grossPay)).toBe(48541.67);
    expect(Number(empItem?.netPay)).toBe(46541.67);
    expect(empItem?.details.length).toBeGreaterThan(0);

    // 3. Submit for Approval -> transitions to PENDING_APPROVAL
    const submitted = await runService.submitForApproval(run.id, superAdminUser);
    expect(submitted.status).toBe(PayrollRunStatus.PENDING_APPROVAL);
  });

  it('Gate 2: Recalculation Safety — Recalculating a run must cleanly replace details without orphans', async () => {
    const run = await prisma.payrollRun.findFirst({ where: { payrollPeriodId: testPeriod.id } });
    if (!run) throw new Error('No run found');

    // Reset to CALCULATED to simulate recalculation request
    await prisma.payrollRun.update({
      where: { id: run.id },
      data: { status: PayrollRunStatus.CALCULATED },
    });

    const recalculated = await runService.recalculatePayrollRun(run.id, superAdminUser);
    expect(recalculated.status).toBe(PayrollRunStatus.CALCULATED);

    // Verify no duplicate items
    const items = await runService.getRunItems(run.id, superAdminUser);
    const empItems = items.filter((i) => i.employeeId === testEmp.id);
    expect(empItems.length).toBe(1);
  });
});
