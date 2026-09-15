import { EmploymentType } from '@prisma/client';
import { prisma } from '@cc-erp/database';
import { ShiftService } from '../services/shift.service';
import { EmployeeService, RequestingUser } from '../services/employee.service';

describe('Phase 3A — Shift Service & Rostering Specification', () => {
  let shiftService: ShiftService;
  let employeeService: EmployeeService;
  let orgId: string;
  let branchId: string;
  let superAdminUser: RequestingUser;

  beforeAll(async () => {
    shiftService = new ShiftService();
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
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('Gate 1: Should create ShiftMaster and assign effectively to Employee', async () => {
    const shiftCode = `SHF-NIGHT-${Date.now()}`;
    const shift = await shiftService.createShift(
      {
        code: shiftCode,
        name: 'Night Baking Shift',
        startTime: '22:00',
        endTime: '06:00',
        gracePeriodMinutes: 10,
        breakDurationMinutes: 45,
      },
      superAdminUser,
    );

    expect(shift.id).toBeDefined();
    expect(shift.startTime).toBe('22:00');

    // Create employee
    const emp = await employeeService.createEmployee(
      {
        employeeCode: `EMP-SHF-${Date.now()}`,
        firstName: 'Shift',
        lastName: 'Worker',
        phone: '+919999911116',
        dateOfJoining: new Date().toISOString(),
        assignedBranchId: branchId,
      },
      superAdminUser,
    );

    // Assign shift
    const assignment = await shiftService.assignShiftToEmployee(
      emp.id,
      {
        shiftMasterId: shift.id,
        effectiveFrom: new Date().toISOString(),
      },
      superAdminUser,
    );

    expect(assignment.id).toBeDefined();
    expect(assignment.shiftMasterId).toBe(shift.id);

    // Fetch current shift
    const currentShift = await shiftService.getEmployeeCurrentShift(emp.id, superAdminUser);
    expect(currentShift?.shiftMasterId).toBe(shift.id);

    await prisma.employeeShift.deleteMany({ where: { employeeId: emp.id } });
    await prisma.employee.delete({ where: { id: emp.id } });
    await prisma.shiftMaster.delete({ where: { id: shift.id } });
  });
});
