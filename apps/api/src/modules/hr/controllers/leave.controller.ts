import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { BranchScopeGuard } from '../../../common/guards/branch-scope.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import {
  LeaveService,
  LeaveTypeService,
  LeavePolicyService,
  LeaveAllocationService,
} from '../services/leave.service';
import { EmployeeService, RequestingUser } from '../services/employee.service';
import {
  CreateLeaveTypeDto,
  CreateLeavePolicyDto,
  AllocateLeaveDto,
  CreateLeaveRequestDto,
  ApproveLeaveRequestDto,
  RejectLeaveRequestDto,
  CancelLeaveRequestDto,
} from '../dto/leave.dto';
import { LeaveRequestStatus } from '@prisma/client';

@ApiTags('HR — Leave Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BranchScopeGuard, PermissionsGuard)
@Controller('hr')
export class LeaveController {
  constructor(
    private readonly leaveService: LeaveService,
    private readonly leaveTypeService: LeaveTypeService,
    private readonly leavePolicyService: LeavePolicyService,
    private readonly leaveAllocationService: LeaveAllocationService,
    private readonly employeeService: EmployeeService,
  ) {}

  // ─── LEAVE TYPES & POLICIES ─────────────────────────────────────────────────

  @Get('leave-types')
  @RequirePermissions('hr:leave:read')
  @ApiOperation({ summary: 'Get all configured leave types' })
  async getLeaveTypes(@CurrentUser() user: RequestingUser) {
    const orgId = await this.employeeService.resolveOrgId(user);
    const data = await this.leaveTypeService.findAll(orgId);
    return { success: true, data };
  }

  @Post('leave-types')
  @RequirePermissions('hr:leave:write')
  @ApiOperation({ summary: 'Create new leave type' })
  async createLeaveType(
    @Body() dto: CreateLeaveTypeDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const orgId = await this.employeeService.resolveOrgId(user);
    const data = await this.leaveTypeService.create(dto, orgId);
    return { success: true, message: 'Leave type created successfully', data };
  }

  @Get('leave-policies')
  @RequirePermissions('hr:leave:read')
  @ApiOperation({ summary: 'Get all configured leave policies' })
  async getLeavePolicies(@CurrentUser() user: RequestingUser) {
    const orgId = await this.employeeService.resolveOrgId(user);
    const data = await this.leavePolicyService.findByOrg(orgId);
    return { success: true, data };
  }

  @Post('leave-policies')
  @RequirePermissions('hr:leave:write')
  @ApiOperation({ summary: 'Create new leave policy rule' })
  async createLeavePolicy(
    @Body() dto: CreateLeavePolicyDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const orgId = await this.employeeService.resolveOrgId(user);
    const data = await this.leavePolicyService.create(dto, orgId);
    return { success: true, message: 'Leave policy created successfully', data };
  }

  // ─── LEAVE BALANCES & ALLOCATIONS ───────────────────────────────────────────

  @Get('leave-balances/:employeeId')
  @RequirePermissions('hr:leave:read')
  @ApiOperation({ summary: 'Get ledger-derived leave balance for employee' })
  async getLeaveBalance(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    const data = await this.leaveAllocationService.getBalance(employeeId);
    return { success: true, data };
  }

  @Post('leave-allocations')
  @RequirePermissions('hr:leave:write')
  @ApiOperation({ summary: 'Allocate annual leave entitlement (creates ACCRUAL ledger entry)' })
  async allocateLeave(
    @Body() dto: AllocateLeaveDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const orgId = await this.employeeService.resolveOrgId(user);
    const data = await this.leaveAllocationService.allocate(dto, orgId);
    return { success: true, ...data };
  }

  // ─── LEAVE REQUEST WORKFLOW ─────────────────────────────────────────────────

  @Get('leave-requests')
  @Get('leaves')
  @RequirePermissions('hr:leave:read')
  @ApiOperation({ summary: 'List leave requests' })
  async getLeaveRequests(
    @CurrentUser() user: RequestingUser,
    @Query('status') status?: LeaveRequestStatus,
    @Query('employeeId') employeeId?: string,
  ) {
    const data = await this.leaveService.findAll(user, { status, employeeId });
    return { success: true, data };
  }

  @Post('leave-requests')
  @RequirePermissions('hr:leave:write')
  @ApiOperation({ summary: 'Create draft leave request' })
  async createLeaveRequest(
    @Body() dto: CreateLeaveRequestDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.leaveService.createRequest(dto, user);
    return { success: true, message: 'Leave request created in DRAFT state', data };
  }

  @Patch('leave-requests/:id/submit')
  @RequirePermissions('hr:leave:write')
  @ApiOperation({ summary: 'Submit leave request for approval' })
  async submitLeaveRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.leaveService.submitRequest(id, user);
    return { success: true, message: 'Leave request submitted for approval', data };
  }

  @Patch('leave-requests/:id/approve')
  @RequirePermissions('hr:leave:approve')
  @ApiOperation({ summary: 'Approve leave request (atomic ledger deduction)' })
  async approveLeaveRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveLeaveRequestDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.leaveService.approveRequest(id, dto, user);
    return { success: true, ...data };
  }

  @Patch('leave-requests/:id/reject')
  @RequirePermissions('hr:leave:approve')
  @ApiOperation({ summary: 'Reject leave request' })
  async rejectLeaveRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectLeaveRequestDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.leaveService.rejectRequest(id, dto, user);
    return { success: true, message: 'Leave request rejected', data };
  }

  @Patch('leave-requests/:id/cancel')
  @RequirePermissions('hr:leave:write')
  @ApiOperation({ summary: 'Cancel leave request (reverses deduction if already approved)' })
  async cancelLeaveRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelLeaveRequestDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.leaveService.cancelRequest(id, dto, user);
    return { success: true, message: 'Leave request cancelled', data };
  }
}
