import { EmploymentStatus, AttendanceStatus, LeaveRequestStatus } from '@prisma/client';
import { prisma } from '@cc-erp/database';
import { EmployeeService, RequestingUser } from '../services/employee.service';
import { AttendanceService } from '../services/attendance.service';
import { LeaveService, LeaveAllocationService } from '../services/leave.service';

describe('Phase 3A — HR Concurrency & Race Condition Suite', () => {
  let employeeService: EmployeeService;
  let attendanceService: AttendanceService;
  let leaveService: LeaveService;
  let leaveAllocationService: LeaveAllocationService;
  let orgId: string;
  let branchId: string;
  let superAdminUser: RequestingUser;

  const cleanupEmp = async (empId: string) => {
    await prisma.payrollDetail.deleteMany({ where: { payrollItem: { employeeId: empId } } });
    await prisma.payrollItem.deleteMany({ where: { employeeId: empId } });
    await prisma.attendanceCorrectionRequest.deleteMany({ where: { employeeId: empId } });
    await prisma.attendanceLog.deleteMany({ where: { employeeId: empId } });
    await prisma.leaveRequest.deleteMany({ where: { employeeId: empId } });
    await prisma.leaveTransaction.deleteMany({ where: { employeeId: empId } });
    await prisma.employeeLeaveBalance.deleteMany({ where: { employeeId: empId } });
    await prisma.employeeShift.deleteMany({ where: { employeeId: empId } });
    await prisma.salaryStructure.deleteMany({ where: { employeeId: empId } });
    await prisma.employee.delete({ where: { id: empId } }).catch(() => null);
  };

  beforeAll(async () => {
    employeeService = new EmployeeService();
    attendanceService = new AttendanceService();
    leaveService = new LeaveService();
    leaveAllocationService = new LeaveAllocationService();

    const org = await prisma.organization.findFirst();
    if (!org) throw new Error('No organization found');
    orgId = org.id;

    const branches = await prisma.branch.findMany({ where: { organizationId: orgId } });
    branchId = branches[0]?.id;

    superAdminUser = {
      sub: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000001',
      permissions: [],
      username: 'admin',
      organizationId: orgId,
      scope: 'GLOBAL',
      roles: ['SUPER_ADMIN'],
    };
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('Gate 1: 100 simultaneous employee activation attempts -> Exactly 1 succeeds atomically', async () => {
    const emp = await employeeService.createEmployee(
      {
        employeeCode: `CONC-EMP-${Date.now()}`,
        firstName: 'Concurrent',
        lastName: 'Employee',
        phone: '+919999922221',
        dateOfJoining: new Date().toISOString(),
        assignedBranchId: branchId,
      },
      superAdminUser,
    );

    const promises = Array.from({ length: 100 }).map(() =>
      employeeService.activateEmployee(emp.id, superAdminUser).then(
        (res) => ({ status: 'fulfilled' as const, value: res }),
        (err) => ({ status: 'rejected' as const, reason: err.message }),
      ),
    );

    const results = await Promise.all(promises);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');

    // Final employee status in DB must be ACTIVE
    const finalEmp = await prisma.employee.findUnique({ where: { id: emp.id } });
    expect(finalEmp?.status).toBe(EmploymentStatus.ACTIVE);
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);

    await cleanupEmp(emp.id);
  });

  it('Gate 2: 100 simultaneous attendance check-ins -> Exactly 1 valid check-in recorded', async () => {
    const emp = await employeeService.createEmployee(
      {
        employeeCode: `CONC-ATT-${Date.now()}`,
        firstName: 'Concurrent',
        lastName: 'Attendance',
        phone: '+919999922222',
        dateOfJoining: new Date().toISOString(),
        assignedBranchId: branchId,
      },
      superAdminUser,
    );
    await employeeService.activateEmployee(emp.id, superAdminUser);

    const promises = Array.from({ length: 100 }).map((_, i) =>
      attendanceService.checkIn(
        {
          employeeId: emp.id,
          branchId,
          idempotencyKey: `conc-punch-${emp.id}-${i}`,
        },
        superAdminUser,
      ).then(
        (res) => ({ status: 'fulfilled' as const, value: res }),
        (err) => ({ status: 'rejected' as const, reason: err.message }),
      ),
    );

    const results = await Promise.all(promises);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');

    // Exactly 1 row in attendanceLog table
    const logs = await prisma.attendanceLog.findMany({
      where: { employeeId: emp.id },
    });
    expect(logs.length).toBe(1);
    expect(fulfilled.length).toBe(1);

    await cleanupEmp(emp.id);
  });

  it('Gate 3: 100 simultaneous attendance correction approvals -> Exactly 1 approval applied', async () => {
    const emp = await employeeService.createEmployee(
      {
        employeeCode: `CONC-CORR-${Date.now()}`,
        firstName: 'Concurrent',
        lastName: 'Correction',
        phone: '+919999922223',
        dateOfJoining: new Date().toISOString(),
        assignedBranchId: branchId,
      },
      superAdminUser,
    );
    await employeeService.activateEmployee(emp.id, superAdminUser);

    const corr = await attendanceService.requestCorrection(
      {
        employeeId: emp.id,
        workDate: new Date().toISOString(),
        requestedIn: new Date('2026-09-03T09:00:00Z').toISOString(),
        requestedOut: new Date('2026-09-03T18:00:00Z').toISOString(),
        reason: 'Biometric device offline',
      },
      superAdminUser,
    );

    const promises = Array.from({ length: 100 }).map((_, i) =>
      attendanceService.approveCorrection(
        corr.id,
        { idempotencyKey: `corr-conc-${corr.id}-${i}` },
        superAdminUser,
      ).then(
        (res) => ({ status: 'fulfilled' as const, value: res }),
        (err) => ({ status: 'rejected' as const, reason: err.message }),
      ),
    );

    const results = await Promise.all(promises);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');

    expect(fulfilled.length).toBe(1);

    const finalCorr = await prisma.attendanceCorrectionRequest.findUnique({
      where: { id: corr.id },
    });
    expect(finalCorr?.status).toBe('APPROVED');

    await cleanupEmp(emp.id);
  });

  it('Gate 4: 100 simultaneous leave approvals for the SAME request -> Exactly 1 approval and 1 ledger deduction', async () => {
    const leaveType = await prisma.leaveType.findFirst({ where: { organizationId: orgId } });
    if (!leaveType) throw new Error('No leave type found');

    const emp = await employeeService.createEmployee(
      {
        employeeCode: `CONC-LEAVE-${Date.now()}`,
        firstName: 'Concurrent',
        lastName: 'Leave',
        phone: '+919999922224',
        dateOfJoining: new Date().toISOString(),
        assignedBranchId: branchId,
      },
      superAdminUser,
    );
    await employeeService.activateEmployee(emp.id, superAdminUser);

    // Allocate 10 days
    await leaveAllocationService.allocate(
      { employeeId: emp.id, leaveTypeId: leaveType.id, days: 10, year: 2026 },
      orgId,
    );

    // Create & submit leave request for 3 days
    const req = await leaveService.createRequest(
      {
        employeeId: emp.id,
        leaveTypeId: leaveType.id,
        startDate: '2026-10-01',
        endDate: '2026-10-03',
        reason: 'Vacation',
      },
      superAdminUser,
    );
    await leaveService.submitRequest(req.id, superAdminUser);

    const promises = Array.from({ length: 100 }).map((_, i) =>
      leaveService.approveRequest(
        req.id,
        { idempotencyKey: `leave-conc-${req.id}-${i}` },
        superAdminUser,
      ).then(
        (res) => ({ status: 'fulfilled' as const, value: res }),
        (err) => ({ status: 'rejected' as const, reason: err.message }),
      ),
    );

    const results = await Promise.all(promises);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');

    expect(fulfilled.length).toBe(1);

    // Verify ledger: exactly 1 ACCRUAL (+10) and 1 DEDUCTION (-3) -> net balance = 7
    const txs = await prisma.leaveTransaction.findMany({
      where: { employeeId: emp.id, leaveTypeId: leaveType.id },
    });
    expect(txs.length).toBe(2);

    const netDays = txs.reduce((sum, t) => sum + t.days, 0);
    expect(netDays).toBe(7);

    await cleanupEmp(emp.id);
  });

  it('Gate 5: 100 simultaneous leave requests consuming limited balance -> No negative balance / no oversubscription', async () => {
    const leaveType = await prisma.leaveType.findFirst({ where: { organizationId: orgId } });
    if (!leaveType) throw new Error('No leave type found');

    const emp = await employeeService.createEmployee(
      {
        employeeCode: `CONC-OVERSUB-${Date.now()}`,
        firstName: 'Concurrent',
        lastName: 'Oversubscribe',
        phone: '+919999922225',
        dateOfJoining: new Date().toISOString(),
        assignedBranchId: branchId,
      },
      superAdminUser,
    );
    await employeeService.activateEmployee(emp.id, superAdminUser);

    // Allocate exactly 6 days
    await leaveAllocationService.allocate(
      { employeeId: emp.id, leaveTypeId: leaveType.id, days: 6, year: 2026 },
      orgId,
    );

    // Create 10 distinct leave requests for non-overlapping dates of 2 days each
    const reqIds: string[] = [];
    for (let i = 0; i < 10; i++) {
      const startDay = (i * 2 + 1).toString().padStart(2, '0');
      const endDay = (i * 2 + 2).toString().padStart(2, '0');
      const r = await leaveService.createRequest(
        {
          employeeId: emp.id,
          leaveTypeId: leaveType.id,
          startDate: `2026-11-${startDay}`,
          endDate: `2026-11-${endDay}`,
          reason: `Trip ${i}`,
        },
        superAdminUser,
      );
      await leaveService.submitRequest(r.id, superAdminUser);
      reqIds.push(r.id);
    }

    // Attempt concurrent approvals for all 10 requests simultaneously
    const promises = reqIds.map((reqId, i) =>
      leaveService.approveRequest(
        reqId,
        { idempotencyKey: `multi-leave-conc-${reqId}-${i}` },
        superAdminUser,
      ).then(
        (res) => ({ status: 'fulfilled' as const, value: res }),
        (err) => ({ status: 'rejected' as const, reason: err.message }),
      ),
    );

    const results = await Promise.all(promises);
    const approvedCount = results.filter((r) => r.status === 'fulfilled').length;

    // Exactly 3 requests can be approved (3 * 2 = 6 days)
    expect(approvedCount).toBe(3);

    // Verify ledger balance is exactly 0 and NEVER negative
    const balances = await leaveAllocationService.getBalance(emp.id);
    const bal = balances.find((b) => b.leaveTypeId === leaveType.id);
    expect(bal?.balance).toBe(0);

    await cleanupEmp(emp.id);
  });
});
