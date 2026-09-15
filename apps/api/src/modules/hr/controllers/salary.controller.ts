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
import { SalaryComponentService, SalaryStructureService } from '../services/salary.service';
import type { RequestingUser } from '../services/employee.service';
import {
  CreateSalaryComponentDto,
  UpdateSalaryComponentDto,
  CreateSalaryStructureDto,
  UpdateSalaryStructureDto,
  ResolveSalaryQueryDto,
} from '../dto/salary.dto';

@ApiTags('HR — Salary & Compensation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BranchScopeGuard, PermissionsGuard)
@Controller('hr/salary')
export class SalaryController {
  constructor(
    private readonly salaryComponentService: SalaryComponentService,
    private readonly salaryStructureService: SalaryStructureService,
  ) {}

  // ─── SALARY COMPONENTS ─────────────────────────────────────────────────────

  @Get('components')
  @RequirePermissions('hr:payroll:read')
  @ApiOperation({ summary: 'List all salary earning and deduction components' })
  async getComponents(@CurrentUser() user: RequestingUser) {
    const data = await this.salaryComponentService.findAll(user);
    return { success: true, data };
  }

  @Get('components/:id')
  @RequirePermissions('hr:payroll:read')
  @ApiOperation({ summary: 'Get salary component by ID' })
  async getComponent(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.salaryComponentService.findById(id, user);
    return { success: true, data };
  }

  @Post('components')
  @RequirePermissions('hr:payroll:run')
  @ApiOperation({ summary: 'Create a new salary component' })
  async createComponent(
    @Body() dto: CreateSalaryComponentDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.salaryComponentService.create(dto, user);
    return { success: true, message: 'Salary component created successfully', data };
  }

  @Patch('components/:id')
  @RequirePermissions('hr:payroll:run')
  @ApiOperation({ summary: 'Update salary component configuration' })
  async updateComponent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSalaryComponentDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.salaryComponentService.update(id, dto, user);
    return { success: true, message: 'Salary component updated successfully', data };
  }

  // ─── SALARY STRUCTURES ─────────────────────────────────────────────────────

  @Post('structures')
  @RequirePermissions('hr:payroll:run')
  @ApiOperation({ summary: 'Assign effective-dated salary structure to employee' })
  async createSalaryStructure(
    @Body() dto: CreateSalaryStructureDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.salaryStructureService.createSalaryStructure(dto, user);
    return { success: true, message: 'Salary structure assigned successfully', data };
  }

  @Get('structures/history/:employeeId')
  @RequirePermissions('hr:payroll:read')
  @ApiOperation({ summary: 'Get complete salary structure history for employee' })
  async getSalaryHistory(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.salaryStructureService.getSalaryStructureHistory(employeeId, user);
    return { success: true, data };
  }

  @Get('resolve/:employeeId')
  @RequirePermissions('hr:payroll:read')
  @ApiOperation({ summary: 'Authoritative calculation resolver: get applicable salary for target date' })
  async resolveSalary(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: ResolveSalaryQueryDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.salaryStructureService.resolveEmployeeSalary(employeeId, query.targetDate, user);
    return { success: true, data };
  }

  @Patch('structures/:id')
  @RequirePermissions('hr:payroll:run')
  @ApiOperation({ summary: 'Update specific salary structure' })
  async updateSalaryStructure(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSalaryStructureDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.salaryStructureService.updateSalaryStructure(id, dto, user);
    return { success: true, message: 'Salary structure updated successfully', data };
  }
}
