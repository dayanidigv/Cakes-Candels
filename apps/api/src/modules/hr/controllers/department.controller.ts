import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { BranchScopeGuard } from '../../../common/guards/branch-scope.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { DepartmentService } from '../services/department.service';
import type { RequestingUser } from '../services/employee.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from '../dto/department.dto';

@ApiTags('HR — Departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BranchScopeGuard, PermissionsGuard)
@Controller('hr/departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get()
  @RequirePermissions('hr:employee:read')
  @ApiOperation({ summary: 'List all departments in organization' })
  async getDepartments(@CurrentUser() user: RequestingUser) {
    const data = await this.departmentService.findAll(user);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('hr:employee:read')
  @ApiOperation({ summary: 'Get department details' })
  async getDepartment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.departmentService.findById(id, user);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('hr:employee:write')
  @ApiOperation({ summary: 'Create department' })
  async createDepartment(
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.departmentService.create(dto, user);
    return { success: true, message: 'Department created successfully', data };
  }

  @Patch(':id')
  @RequirePermissions('hr:employee:write')
  @ApiOperation({ summary: 'Update department' })
  async updateDepartment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.departmentService.update(id, dto, user);
    return { success: true, message: 'Department updated successfully', data };
  }
}
