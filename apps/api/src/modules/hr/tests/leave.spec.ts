import { LeaveRequestStatus, EmploymentType } from '@prisma/client';
import { prisma } from '@cc-erp/database';
import {
  LeaveService,
  LeaveTypeService,
  LeavePolicyService,
  LeaveAllocationService,
} from '../services/leave.service';
import { EmployeeService, RequestingUser } from '../services/employee.service';

describe('Phase 3A — Leave Foundation & Ledger Source-of-Truth Specification', () => {
  let leaveService: LeaveService;
  let leaveTypeService: LeaveTypeService;
  let leavePolicyService: LeavePolicyService;
  let leaveAllocationService: LeaveAllocationService;
  let employeeService: EmployeeService;
  let orgId: string;
  let branchId: string;
  let superAdminUser: RequestingUser;
  let activeEmp: any;
  let leaveType: any;

  beforeAll(async () => {
    leaveService = new LeaveService();
    leaveTypeService = new LeaveTypeService();
    leavePolicyService = new LeavePolicyService();
    leaveAllocationService = new LeaveAllocationService();
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
        employeeCode: `EMP-LV-${Date.now()}`,
        firstName: 'Leave',
        lastName: 'Tester',
        phone: '+919999911118',
        dateOfJoining: new Date().toISOString(),
        assignedBranchId: branchId,
      },
      superAdminUser,
    );
    await employeeService.activateEmployee(activeEmp.id, superAdminUser);

    leaveType = await leaveTypeService.create(
      {
        code: `LV-PL-${Date.now()}`,
        name: 'Annual Paid Leave',
        annualDays: 15,
        isCarryForward: true,
      },
      orgId,
    );

    await leavePolicyService.create(
      {
        leaveTypeId: leaveType.id,
        maxContinuousDays: 10,
        noticeDaysRequired: 2,
        encashable: true,
      },
      orgId,
    );
  });

  afterAll(async () => {
    await prisma.leaveRequest.deleteMany({ where: { employeeId: activeEmp.id } });
    await prisma.leaveTransaction.deleteMany({ where: { employeeId: activeEmp.id } });
    await prisma.employeeLeaveBalance.deleteMany({ where: { employeeId: activeEmp.id } });
    await prisma.employee.delete({ where: { id: activeEmp.id } });
    await prisma.leavePolicy.deleteMany({ where: { leaveTypeId: leaveType.id } });
    await prisma.leaveType.delete({ where: { id: leaveType.id } });
    await prisma.$disconnect();
  });

  it('Gate 1: Should allocate leave balance via LeaveTransaction ledger (ACCRUAL)', async () => {
    await leaveAllocationService.allocate(
      {
        employeeId: activeEmp.id,
        leaveTypeId: leaveType.id,
        year: 2026,
        days: 15,
      },
      orgId,
    );

    // Ledger balance should now equal 15
    const balances = await leaveAllocationService.getBalance(activeEmp.id);
    const plBalance = balances.find((b) => b.leaveTypeId === leaveType.id);
    expect(plBalance?.balance).toBe(15);
  });

  it('Gate 2: Should execute full leave request workflow (DRAFT -> SUBMITTED -> APPROVED -> CANCELLED)', async () => {
    const startDate = '2026-10-01';
    const endDate = '2026-10-03'; // 3 days

    // 1. Create Draft
    const req = await leaveService.createRequest(
      {
        employeeId: activeEmp.id,
        leaveTypeId: leaveType.id,
        startDate,
        endDate,
        reason: 'Family Vacation',
      },
      superAdminUser,
    );
    expect(req.status).toBe(LeaveRequestStatus.DRAFT);
    expect(req.totalDays).toBe(3);

    // 2. Submit
    const submitted = await leaveService.submitRequest(req.id, superAdminUser);
    expect(submitted.status).toBe(LeaveRequestStatus.SUBMITTED);

    // 3. Approve -> Should create DEDUCTION ledger entry (-3 days)
    const approved = await leaveService.approveRequest(req.id, {}, superAdminUser);
    expect(approved.status).toBe(LeaveRequestStatus.APPROVED);

    const balanceAfterApprove = await leaveAllocationService.getBalance(activeEmp.id);
    const currentPL = balanceAfterApprove.find((b) => b.leaveTypeId === leaveType.id);
    expect(currentPL?.balance).toBe(12);

    // 4. Overlapping request rejection check
    const overlapReq = await leaveService.createRequest(
      {
        employeeId: activeEmp.id,
        leaveTypeId: leaveType.id,
        startDate: '2026-10-02',
        endDate: '2026-10-04',
        reason: 'Overlapping leave',
      },
      superAdminUser,
    );
    await leaveService.submitRequest(overlapReq.id, superAdminUser);
    await expect(
      leaveService.approveRequest(overlapReq.id, {}, superAdminUser),
    ).rejects.toThrow(/overlapping/);

    // 5. Cancel -> Should reverse deduction via ADJUSTMENT ledger entry (+3 days)
    const cancelled = await leaveService.cancelRequest(req.id, {}, superAdminUser);
    expect(cancelled.status).toBe(LeaveRequestStatus.CANCELLED);

    const balanceAfterCancel = await leaveAllocationService.getBalance(activeEmp.id);
    const restoredPL = balanceAfterCancel.find((b) => b.leaveTypeId === leaveType.id);
    expect(restoredPL?.balance).toBe(15);
  });
});
