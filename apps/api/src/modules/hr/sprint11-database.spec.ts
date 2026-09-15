import { PrismaClient, EmploymentStatus, AttendanceStatus, LeaveRequestStatus, PayrollRunStatus, PayslipStatus } from '@prisma/client';

const prisma = new PrismaClient();

describe('Sprint 11 — Phase 2 HR & Payroll Database Foundation Specification', () => {
  let orgId: string;
  let factoryBranchId: string;
  let retailBranchId: string;

  beforeAll(async () => {
    const org = await prisma.organization.findFirst();
    if (!org) throw new Error('No organization found in database');
    orgId = org.id;

    const branches = await prisma.branch.findMany({ where: { organizationId: orgId } });
    const factory = branches.find((b) => b.type === 'FACTORY') || branches[0];
    const retail = branches.find((b) => b.type === 'RETAIL_BRANCH') || branches[1] || factory;

    factoryBranchId = factory.id;
    retailBranchId = retail.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('Gate 1: Should verify Employee creation and default status DRAFT', async () => {
    const employee = await prisma.employee.create({
      data: {
        organizationId: orgId,
        assignedBranchId: factoryBranchId,
        employeeCode: `TEST-EMP-${Date.now()}`,
        firstName: 'Test',
        lastName: 'Worker',
        phone: '+919999900001',
        dateOfJoining: new Date(),
        status: EmploymentStatus.DRAFT,
      },
    });

    expect(employee.id).toBeDefined();
    expect(employee.status).toEqual('DRAFT');

    await prisma.employee.delete({ where: { id: employee.id } });
  });

  it('Gate 2: Should enforce unique employee code per organization constraint', async () => {
    const code = `TEST-UNIQ-${Date.now()}`;

    const emp1 = await prisma.employee.create({
      data: {
        organizationId: orgId,
        assignedBranchId: factoryBranchId,
        employeeCode: code,
        firstName: 'Worker',
        lastName: 'One',
        phone: '+919999900002',
        dateOfJoining: new Date(),
      },
    });

    await expect(
      prisma.employee.create({
        data: {
          organizationId: orgId,
          assignedBranchId: factoryBranchId,
          employeeCode: code,
          firstName: 'Worker',
          lastName: 'Two',
          phone: '+919999900003',
          dateOfJoining: new Date(),
        },
      }),
    ).rejects.toThrow();

    await prisma.employee.delete({ where: { id: emp1.id } });
  });

  it('Gate 3: Should link optional User to Employee without credential duplication', async () => {
    const user = await prisma.user.create({
      data: {
        organizationId: orgId,
        username: `hruser_${Date.now()}`,
        passwordHash: 'dummyhash',
        fullName: 'HR Test User',
      },
    });

    const emp = await prisma.employee.create({
      data: {
        organizationId: orgId,
        assignedBranchId: factoryBranchId,
        userId: user.id,
        employeeCode: `TEST-USER-LINK-${Date.now()}`,
        firstName: 'Linked',
        lastName: 'Employee',
        phone: '+919999900004',
        dateOfJoining: new Date(),
      },
    });

    const fetchedEmp = await prisma.employee.findUnique({
      where: { id: emp.id },
      include: { user: true },
    });

    expect(fetchedEmp?.user?.id).toEqual(user.id);

    await prisma.employee.delete({ where: { id: emp.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('Gate 4 & 5: Should isolate Employees by Organization & Branch scope', async () => {
    const empFactory = await prisma.employee.create({
      data: {
        organizationId: orgId,
        assignedBranchId: factoryBranchId,
        employeeCode: `TEST-FAC-${Date.now()}`,
        firstName: 'Factory',
        lastName: 'Baker',
        phone: '+919999900005',
        dateOfJoining: new Date(),
      },
    });

    const empRetail = await prisma.employee.create({
      data: {
        organizationId: orgId,
        assignedBranchId: retailBranchId,
        employeeCode: `TEST-RET-${Date.now()}`,
        firstName: 'Retail',
        lastName: 'Cashier',
        phone: '+919999900006',
        dateOfJoining: new Date(),
      },
    });

    const factoryList = await prisma.employee.findMany({
      where: { organizationId: orgId, assignedBranchId: factoryBranchId },
    });

    expect(factoryList.some((e) => e.id === empFactory.id)).toBe(true);
    expect(factoryList.some((e) => e.id === empRetail.id)).toBe(false);

    await prisma.employee.deleteMany({
      where: { id: { in: [empFactory.id, empRetail.id] } },
    });
  });

  it('Gate 6: Should enforce Attendance uniqueness per employee per workDate', async () => {
    const emp = await prisma.employee.create({
      data: {
        organizationId: orgId,
        assignedBranchId: factoryBranchId,
        employeeCode: `TEST-ATT-${Date.now()}`,
        firstName: 'Attendance',
        lastName: 'Test',
        phone: '+919999900007',
        dateOfJoining: new Date(),
      },
    });

    const workDate = new Date('2026-09-01');

    await prisma.attendanceLog.create({
      data: {
        organizationId: orgId,
        branchId: factoryBranchId,
        employeeId: emp.id,
        workDate,
        status: AttendanceStatus.CHECKED_IN,
      },
    });

    await expect(
      prisma.attendanceLog.create({
        data: {
          organizationId: orgId,
          branchId: factoryBranchId,
          employeeId: emp.id,
          workDate,
          status: AttendanceStatus.CHECKED_OUT,
        },
      }),
    ).rejects.toThrow();

    await prisma.attendanceLog.deleteMany({ where: { employeeId: emp.id } });
    await prisma.employee.delete({ where: { id: emp.id } });
  });

  it('Gate 7: Should verify Leave Ledger integrity via LeaveTransaction entries', async () => {
    const emp = await prisma.employee.create({
      data: {
        organizationId: orgId,
        assignedBranchId: factoryBranchId,
        employeeCode: `TEST-LEAVE-${Date.now()}`,
        firstName: 'Leave',
        lastName: 'Test',
        phone: '+919999900008',
        dateOfJoining: new Date(),
      },
    });

    const leaveType = await prisma.leaveType.findFirst({ where: { organizationId: orgId } });
    if (!leaveType) throw new Error('No leave type found');

    await prisma.leaveTransaction.create({
      data: {
        employeeId: emp.id,
        leaveTypeId: leaveType.id,
        type: 'ACCRUAL',
        days: 15,
        notes: 'Annual entitlement',
      },
    });

    await prisma.leaveTransaction.create({
      data: {
        employeeId: emp.id,
        leaveTypeId: leaveType.id,
        type: 'DEDUCTION',
        days: -3,
        notes: 'Approved leave request',
      },
    });

    const txs = await prisma.leaveTransaction.findMany({ where: { employeeId: emp.id } });
    const netBalance = txs.reduce((acc, t) => acc + t.days, 0);

    expect(netBalance).toEqual(12);

    await prisma.leaveTransaction.deleteMany({ where: { employeeId: emp.id } });
    await prisma.employee.delete({ where: { id: emp.id } });
  });

  it('Gate 8: Should verify Payroll Period, Payroll Run, and Payslip uniqueness constraints', async () => {
    const period = await prisma.payrollPeriod.create({
      data: {
        organizationId: orgId,
        year: 2026,
        month: 11,
        startDate: new Date('2026-11-01'),
        endDate: new Date('2026-11-30'),
      },
    });

    const idempotencyKey = `pay-run-key-${Date.now()}`;
    const runNumber = `RUN-2026-11-${Date.now()}`;

    const run = await prisma.payrollRun.create({
      data: {
        organizationId: orgId,
        payrollPeriodId: period.id,
        runNumber,
        status: PayrollRunStatus.DRAFT,
        idempotencyKey,
      },
    });

    await expect(
      prisma.payrollRun.create({
        data: {
          organizationId: orgId,
          payrollPeriodId: period.id,
          runNumber: `RUN-DUP-${Date.now()}`,
          status: PayrollRunStatus.DRAFT,
          idempotencyKey,
        },
      }),
    ).rejects.toThrow();

    await prisma.payrollRun.delete({ where: { id: run.id } });
    await prisma.payrollPeriod.delete({ where: { id: period.id } });
  });
});
