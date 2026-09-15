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
import { AttendanceService } from '../services/attendance.service';
import type { RequestingUser } from '../services/employee.service';
import {
  CheckInDto,
  CheckOutDto,
  ScheduleAttendanceDto,
  AttendanceCorrectionRequestDto,
  ApproveCorrectionDto,
  RejectCorrectionDto,
} from '../dto/attendance.dto';

@ApiTags('HR — Attendance & Punches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BranchScopeGuard, PermissionsGuard)
@Controller('hr/attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  @RequirePermissions('hr:attendance:read')
  @ApiOperation({ summary: 'Get attendance logs for date/branch' })
  async getAttendance(
    @CurrentUser() user: RequestingUser,
    @Query('date') date?: string,
    @Query('branchId') branchId?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    const data = await this.attendanceService.findAll(user, { date, branchId, employeeId });
    return { success: true, data };
  }

  @Post('schedule')
  @RequirePermissions('hr:attendance:write')
  @ApiOperation({ summary: 'Schedule an employee for a shift roster' })
  async scheduleAttendance(
    @Body() dto: ScheduleAttendanceDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.attendanceService.scheduleAttendance(dto, user);
    return { success: true, message: 'Attendance scheduled successfully', data };
  }

  @Post('check-in')
  @RequirePermissions('hr:attendance:write')
  @ApiOperation({ summary: 'Record employee check-in punch (backend timestamp authoritative)' })
  async checkIn(
    @Body() dto: CheckInDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.attendanceService.checkIn(dto, user);
    return { success: true, message: 'Check-in recorded successfully', data };
  }

  @Patch(':id/check-out')
  @RequirePermissions('hr:attendance:write')
  @ApiOperation({ summary: 'Record employee check-out punch and compute hours worked' })
  async checkOut(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckOutDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.attendanceService.checkOut(id, dto, user);
    return { success: true, message: 'Check-out recorded successfully', data };
  }

  @Patch(':id/finalize')
  @RequirePermissions('hr:attendance:write')
  @ApiOperation({ summary: 'Finalize and lock attendance record for payroll' })
  async finalizeAttendance(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.attendanceService.finalizeAttendance(id, user);
    return { success: true, message: 'Attendance finalized successfully', data };
  }

  @Post('corrections')
  @RequirePermissions('hr:attendance:write')
  @ApiOperation({ summary: 'Submit an attendance correction request' })
  async requestCorrection(
    @Body() dto: AttendanceCorrectionRequestDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.attendanceService.requestCorrection(dto, user);
    return { success: true, message: 'Correction request submitted', data };
  }

  @Patch('corrections/:id/approve')
  @RequirePermissions('hr:attendance:correct')
  @ApiOperation({ summary: 'Approve attendance correction request' })
  async approveCorrection(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveCorrectionDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.attendanceService.approveCorrection(id, dto, user);
    return { success: true, ...data };
  }

  @Patch('corrections/:id/reject')
  @RequirePermissions('hr:attendance:correct')
  @ApiOperation({ summary: 'Reject attendance correction request' })
  async rejectCorrection(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectCorrectionDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.attendanceService.rejectCorrection(id, dto, user);
    return { success: true, message: 'Correction request rejected', data };
  }
}
