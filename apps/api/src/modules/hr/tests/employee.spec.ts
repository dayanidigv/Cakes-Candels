import { EmploymentStatus, EmploymentType } from '@prisma/client';
import { prisma } from '@cc-erp/database';
import { EmployeeService, RequestingUser } from '../services/employee.service';

describe('Phase 3A — Employee Foundation Service Specification', () => {
  let employeeService: EmployeeService;
  let orgId: string;
  let factoryBranchId: string;
  let retailBranchId: string;
  let superAdminUser: RequestingUser;
  let branchManagerUser: RequestingUser;

  beforeAll(async () => {
    employeeService = new EmployeeService();

    const org = await prisma.organization.findFirst();
    if (!org) throw new Error('No organization found');
    orgId = org.id;

    const branches = await prisma.branch.findMany({ where: { organizationId: orgId } });
    const factory = branches.find((b) => b.type === 'FACTORY') || branches[0];
    const retail = branches.find((b) => b.type === 'RETAIL_BRANCH') || branches[1] || factory;

    factoryBranchId = factory.id;
    retailBranchId = retail.id;

    superAdminUser = {
      sub: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000001',
      permissions: [],
      username: 'admin',
      organizationId: orgId,
      scope: 'GLOBAL',
      roles: ['SUPER_ADMIN'],
    };

    branchManagerUser = {
      sub: '00000000-0000-0000-0000-000000000002',
      userId: '00000000-0000-0000-0000-000000000002',
      permissions: [],
      username: 'retail_manager',
      organizationId: orgId,
      branchId: retailBranchId,
      scope: 'BRANCH',
      roles: ['BRANCH_MANAGER'],
    };
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('Gate 1: Should create a new Employee in DRAFT status with audit and outbox events', async () => {
    const code = `EMP-TEST-${Date.now()}`;
    const emp = await employeeService.createEmployee(
      {
        employeeCode: code,
        firstName: 'John',
        lastName: 'Baker',
        phone: '+919999911111',
        email: `john.${Date.now()}@example.com`,
        dateOfJoining: new Date().toISOString(),
        assignedBranchId: factoryBranchId,
        employmentType: EmploymentType.FULL_TIME,
      },
      superAdminUser,
    );

    expect(emp.id).toBeDefined();
    expect(emp.status).toBe(EmploymentStatus.DRAFT);
    expect(emp.employeeCode).toBe(code);

    // Verify audit log
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: emp.id, entity: 'employee' },
      orderBy: { timestamp: 'desc' },
    });
    expect(audit).toBeDefined();

    // Verify outbox
    const outbox = await prisma.outboxEvent.findFirst({
      where: { type: 'hr.employee.created' },
      orderBy: { createdAt: 'desc' },
    });
    expect(outbox).toBeDefined();

    await prisma.employee.delete({ where: { id: emp.id } });
  });

  it('Gate 2: Should reject duplicate employeeCode within the same organization', async () => {
    const code = `EMP-DUP-${Date.now()}`;
    const emp1 = await employeeService.createEmployee(
      {
        employeeCode: code,
        firstName: 'Worker',
        lastName: 'One',
        phone: '+919999911112',
        dateOfJoining: new Date().toISOString(),
        assignedBranchId: factoryBranchId,
      },
      superAdminUser,
    );

    await expect(
      employeeService.createEmployee(
        {
          employeeCode: code,
          firstName: 'Worker',
          lastName: 'Two',
          phone: '+919999911113',
          dateOfJoining: new Date().toISOString(),
          assignedBranchId: factoryBranchId,
        },
        superAdminUser,
      ),
    ).rejects.toThrow();

    await prisma.employee.delete({ where: { id: emp1.id } });
  });

  it('Gate 3: Should enforce BRANCH scope isolation during creation and viewing', async () => {
    await expect(
      employeeService.createEmployee(
        {
          employeeCode: `EMP-CROSS-${Date.now()}`,
          firstName: 'Cross',
          lastName: 'Branch',
          phone: '+919999911114',
          dateOfJoining: new Date().toISOString(),
          assignedBranchId: factoryBranchId,
        },
        branchManagerUser,
      ),
    ).rejects.toThrow(/You can only create employees in your assigned branch/);
  });

  it('Gate 4: Should strictly enforce Employee lifecycle state machine transitions', async () => {
    const emp = await employeeService.createEmployee(
      {
        employeeCode: `EMP-STATE-${Date.now()}`,
        firstName: 'Lifecycle',
        lastName: 'Tester',
        phone: '+919999911115',
        dateOfJoining: new Date().toISOString(),
        assignedBranchId: factoryBranchId,
      },
      superAdminUser,
    );

    expect(emp.status).toBe(EmploymentStatus.DRAFT);

    // Invalid transition: DRAFT -> ON_LEAVE
    await expect(
      employeeService.transitionStatus(emp.id, EmploymentStatus.ON_LEAVE, superAdminUser),
    ).rejects.toThrow(/Invalid status transition/);

    // Valid: DRAFT -> ACTIVE
    const activated = await employeeService.activateEmployee(emp.id, superAdminUser);
    expect(activated?.status).toBe(EmploymentStatus.ACTIVE);

    // Valid: ACTIVE -> ON_LEAVE
    const onLeave = await employeeService.putOnLeave(emp.id, superAdminUser);
    expect(onLeave?.status).toBe(EmploymentStatus.ON_LEAVE);

    // Valid: ON_LEAVE -> ACTIVE
    const returned = await employeeService.returnFromLeave(emp.id, superAdminUser);
    expect(returned?.status).toBe(EmploymentStatus.ACTIVE);

    // Valid: ACTIVE -> SUSPENDED
    const suspended = await employeeService.suspendEmployee(emp.id, superAdminUser);
    expect(suspended?.status).toBe(EmploymentStatus.SUSPENDED);

    // Valid: SUSPENDED -> ACTIVE
    const reinstated = await employeeService.reinstateEmployee(emp.id, superAdminUser);
    expect(reinstated?.status).toBe(EmploymentStatus.ACTIVE);

    // Valid: ACTIVE -> RESIGNED
    const resigned = await employeeService.resignEmployee(emp.id, superAdminUser);
    expect(resigned?.status).toBe(EmploymentStatus.RESIGNED);

    // Valid: RESIGNED -> TERMINATED
    const terminated = await employeeService.terminateEmployee(emp.id, superAdminUser);
    expect(terminated?.status).toBe(EmploymentStatus.TERMINATED);

    // Terminal state: TERMINATED -> ACTIVE should fail
    await expect(
      employeeService.activateEmployee(emp.id, superAdminUser),
    ).rejects.toThrow(/Invalid status transition/);

    await prisma.employee.delete({ where: { id: emp.id } });
  });
});
