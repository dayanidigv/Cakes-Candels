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
import { EmployeeService, RequestingUser } from '../services/employee.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  ChangeEmployeeStatusDto,
  AssignBranchDto,
  AssignDepartmentDto,
  AssignDesignationDto,
} from '../dto/employee.dto';
import { EmploymentStatus } from '@prisma/client';

@ApiTags('HR — Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BranchScopeGuard, PermissionsGuard)
@Controller('hr/employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get()
  @RequirePermissions('hr:employee:read')
  @ApiOperation({ summary: 'List employees with pagination and filters' })
  async getEmployees(
    @CurrentUser() user: RequestingUser,
    @Query('search') search?: string,
    @Query('status') status?: EmploymentStatus,
    @Query('branchId') branchId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.employeeService.findAll(user, {
      search,
      status,
      branchId,
      departmentId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return { success: true, ...data };
  }

  @Get(':id')
  @RequirePermissions('hr:employee:read')
  @ApiOperation({ summary: 'Get employee 360 profile by ID' })
  async getEmployee(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.employeeService.findById(id, user);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('hr:employee:write')
  @ApiOperation({ summary: 'Create new draft employee record' })
  async createEmployee(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.employeeService.createEmployee(dto, user);
    return { success: true, message: 'Employee profile created successfully', data };
  }

  @Patch(':id')
  @RequirePermissions('hr:employee:write')
  @ApiOperation({ summary: 'Update employee profile fields' })
  async updateEmployee(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.employeeService.updateEmployee(id, dto, user);
    return { success: true, message: 'Employee profile updated successfully', data };
  }

  @Patch(':id/status')
  @RequirePermissions('hr:employee:write')
  @ApiOperation({ summary: 'Transition employee lifecycle status' })
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeEmployeeStatusDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.employeeService.transitionStatus(
      id,
      dto.status,
      user,
      dto.reason,
      dto.idempotencyKey,
    );
    return { success: true, message: `Employee status transitioned to ${dto.status}`, data };
  }

  @Patch(':id/assign-branch')
  @RequirePermissions('hr:employee:write')
  @ApiOperation({ summary: 'Reassign employee to branch' })
  async assignBranch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignBranchDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.employeeService.assignBranch(id, dto.branchId, user);
    return { success: true, message: 'Employee branch reassigned successfully', data };
  }

  @Patch(':id/assign-department')
  @RequirePermissions('hr:employee:write')
  @ApiOperation({ summary: 'Assign department to employee' })
  async assignDepartment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignDepartmentDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.employeeService.assignDepartment(id, dto.departmentId, user);
    return { success: true, message: 'Department assigned successfully', data };
  }

  @Patch(':id/assign-designation')
  @RequirePermissions('hr:employee:write')
  @ApiOperation({ summary: 'Assign designation to employee' })
  async assignDesignation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignDesignationDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.employeeService.assignDesignation(id, dto.designationId, user);
    return { success: true, message: 'Designation assigned successfully', data };
  }
}
