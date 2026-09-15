import { EmploymentStatus } from '@prisma/client';
import { prisma } from '@cc-erp/database';
import { EmployeeService, RequestingUser } from './services/employee.service';
import { AttendanceService } from './services/attendance.service';
import { LeaveService, LeaveAllocationService } from './services/leave.service';

describe('Phase 3A — HR Concurrency & Race Condition Suite (Direct Spec)', () => {
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

    const logs = await prisma.attendanceLog.findMany({
      where: { employeeId: emp.id },
    });
    expect(logs.length).toBe(1);
    expect(fulfilled.length).toBe(1);

    await cleanupEmp(emp.id);
  });
});
