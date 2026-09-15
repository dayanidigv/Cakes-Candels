import { AttendanceStatus } from '@prisma/client';
import { prisma } from '@cc-erp/database';
import { AttendanceService } from '../services/attendance.service';
import { EmployeeService, RequestingUser } from '../services/employee.service';

describe('Phase 3A — Attendance Foundation Specification', () => {
  let attendanceService: AttendanceService;
  let employeeService: EmployeeService;
  let orgId: string;
  let branchId: string;
  let superAdminUser: RequestingUser;
  let activeEmp: any;

  beforeAll(async () => {
    attendanceService = new AttendanceService();
    employeeService = new EmployeeService();

    const org = await prisma.organization.findFirst();
    if (!org) throw new Error('No organization found');
    orgId = org.id;

    const branch = await prisma.branch.findFirst({ where: { organizationId: orgId } });
    if (!branch) throw new Error('No branch found');
    branchId = branch.id;

    superAdminUser = {
      sub: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000001',
      permissions: [],
      username: 'admin',
      organizationId: orgId,
      scope: 'GLOBAL',
      roles: ['SUPER_ADMIN'],
    };

    activeEmp = await employeeService.createEmployee(
      {
        employeeCode: `EMP-ATT-${Date.now()}`,
        firstName: 'Attendance',
        lastName: 'Tester',
        phone: '+919999911117',
        dateOfJoining: new Date().toISOString(),
        assignedBranchId: branchId,
      },
      superAdminUser,
    );
    await employeeService.activateEmployee(activeEmp.id, superAdminUser);
  });

  afterAll(async () => {
    await prisma.attendanceCorrectionRequest.deleteMany({ where: { employeeId: activeEmp.id } });
    await prisma.attendanceLog.deleteMany({ where: { employeeId: activeEmp.id } });
    await prisma.employee.delete({ where: { id: activeEmp.id } });
    await prisma.$disconnect();
  });

  it('Gate 1: Should execute Check-In -> Check-Out -> Finalize lifecycle with backend timestamps', async () => {
    const key = `att-key-${Date.now()}`;
    const checkIn = await attendanceService.checkIn(
      {
        employeeId: activeEmp.id,
        branchId,
        idempotencyKey: key,
      },
      superAdminUser,
    );

    expect(checkIn.id).toBeDefined();
    expect(checkIn.status).toBe(AttendanceStatus.CHECKED_IN);
    expect(checkIn.checkInTime).toBeDefined();

    // Check-out
    const checkOut = await attendanceService.checkOut(checkIn.id, {}, superAdminUser);
    expect(checkOut.status).toBe(AttendanceStatus.CHECKED_OUT);
    expect(checkOut.checkOutTime).toBeDefined();

    // Finalize
    const finalized = await attendanceService.finalizeAttendance(checkIn.id, superAdminUser);
    expect(finalized.status).toBe(AttendanceStatus.FINALIZED);

    // Cannot check out finalized attendance
    await expect(
      attendanceService.checkOut(checkIn.id, {}, superAdminUser),
    ).rejects.toThrow();
  });

  it('Gate 2: Should execute Attendance Correction workflow and update log', async () => {
    const correction = await attendanceService.requestCorrection(
      {
        employeeId: activeEmp.id,
        workDate: new Date().toISOString(),
        requestedIn: new Date(Date.now() - 8 * 3600000).toISOString(),
        requestedOut: new Date().toISOString(),
        reason: 'Biometric device offline during shift',
      },
      superAdminUser,
    );

    expect(correction.id).toBeDefined();
    expect(correction.status).toBe('PENDING');

    const approved = await attendanceService.approveCorrection(correction.id, {}, superAdminUser);
    expect(approved.status).toBe('APPROVED');
  });
});
