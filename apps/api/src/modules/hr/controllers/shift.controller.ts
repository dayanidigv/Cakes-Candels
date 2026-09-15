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
import { ShiftService } from '../services/shift.service';
import type { RequestingUser } from '../services/employee.service';
import { CreateShiftDto, UpdateShiftDto, AssignShiftDto } from '../dto/shift.dto';

@ApiTags('HR — Shifts & Rostering')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BranchScopeGuard, PermissionsGuard)
@Controller('hr/shifts')
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) {}

  @Get()
  @RequirePermissions('hr:employee:read')
  @ApiOperation({ summary: 'List all active shifts in organization' })
  async getShifts(@CurrentUser() user: RequestingUser) {
    const data = await this.shiftService.findAllShifts(user);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('hr:employee:read')
  @ApiOperation({ summary: 'Get shift definition by ID' })
  async getShift(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.shiftService.getShiftById(id, user);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('hr:employee:write')
  @ApiOperation({ summary: 'Create a new shift definition' })
  async createShift(
    @Body() dto: CreateShiftDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.shiftService.createShift(dto, user);
    return { success: true, message: 'Shift created successfully', data };
  }

  @Patch(':id')
  @RequirePermissions('hr:employee:write')
  @ApiOperation({ summary: 'Update shift definition' })
  async updateShift(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShiftDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.shiftService.updateShift(id, dto, user);
    return { success: true, message: 'Shift updated successfully', data };
  }

  @Post('assignments/:employeeId')
  @RequirePermissions('hr:employee:write')
  @ApiOperation({ summary: 'Assign shift to employee with effective dates' })
  async assignShift(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: AssignShiftDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.shiftService.assignShiftToEmployee(employeeId, dto, user);
    return { success: true, message: 'Shift assigned to employee successfully', data };
  }

  @Get('assignments/:employeeId/current')
  @RequirePermissions('hr:employee:read')
  @ApiOperation({ summary: 'Get current effective shift for employee' })
  async getCurrentShift(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.shiftService.getEmployeeCurrentShift(employeeId, user);
    return { success: true, data };
  }
}
