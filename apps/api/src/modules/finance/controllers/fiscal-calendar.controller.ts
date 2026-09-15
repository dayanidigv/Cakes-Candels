import {
  Controller,
  Get,
  Post,
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
import { FiscalCalendarService, RequestingUser } from '../services/fiscal-calendar.service';
import { CreateFiscalYearDto } from '../dto/create-fiscal-year.dto';
import { CreateFiscalPeriodDto } from '../dto/create-fiscal-period.dto';
import { ReopenPeriodDto } from '../dto/reopen-period.dto';

@ApiTags('Finance — Fiscal Calendar & Periods')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BranchScopeGuard, PermissionsGuard)
@Controller('finance')
export class FiscalCalendarController {
  constructor(private readonly fiscalCalendarService: FiscalCalendarService) {}

  // ─── FISCAL YEARS ──────────────────────────────────────────────────────────

  @Post('fiscal-years')
  @RequirePermissions('finance:period:create')
  @ApiOperation({ summary: 'Create a new Fiscal Year' })
  async createFiscalYear(@Body() dto: CreateFiscalYearDto, @CurrentUser() user: RequestingUser) {
    const data = await this.fiscalCalendarService.createFiscalYear(dto, user);
    return { success: true, message: 'Fiscal Year created successfully', data };
  }

  @Get('fiscal-years')
  @RequirePermissions('finance:period:read')
  @ApiOperation({ summary: 'List Fiscal Years and their Periods' })
  async getFiscalYears(@CurrentUser() user: RequestingUser) {
    const data = await this.fiscalCalendarService.getFiscalYears(user);
    return { success: true, data };
  }

  // ─── FISCAL PERIODS ────────────────────────────────────────────────────────

  @Post('fiscal-periods')
  @RequirePermissions('finance:period:create')
  @ApiOperation({ summary: 'Create a Fiscal Period inside a Fiscal Year' })
  async createFiscalPeriod(@Body() dto: CreateFiscalPeriodDto, @CurrentUser() user: RequestingUser) {
    const data = await this.fiscalCalendarService.createFiscalPeriod(dto, user);
    return { success: true, message: 'Fiscal Period created successfully', data };
  }

  @Get('fiscal-years/:id/periods')
  @RequirePermissions('finance:period:read')
  @ApiOperation({ summary: 'Get Periods for a specific Fiscal Year' })
  async getFiscalPeriods(
    @Param('id', ParseUUIDPipe) fiscalYearId: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.fiscalCalendarService.getFiscalPeriods(fiscalYearId, user);
    return { success: true, data };
  }

  @Post('fiscal-periods/:id/close')
  @RequirePermissions('finance:period:close')
  @ApiOperation({ summary: 'Close a Fiscal Period (CAS: OPEN -> CLOSED)' })
  async closePeriod(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestingUser) {
    const data = await this.fiscalCalendarService.closePeriod(id, user);
    return { success: true, message: 'Fiscal Period closed successfully', data };
  }

  @Post('fiscal-periods/:id/reopen')
  @RequirePermissions('finance:period:reopen')
  @ApiOperation({ summary: 'Reopen a closed Fiscal Period (Requires finance:period:reopen permission)' })
  async reopenPeriod(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReopenPeriodDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.fiscalCalendarService.reopenPeriod(id, dto, user);
    return { success: true, message: 'Fiscal Period reopened successfully', data };
  }

  @Post('fiscal-periods/:id/lock')
  @RequirePermissions('finance:period:lock')
  @ApiOperation({ summary: 'Permanently Lock a closed Fiscal Period' })
  async lockPeriod(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestingUser) {
    const data = await this.fiscalCalendarService.lockPeriod(id, user);
    return { success: true, message: 'Fiscal Period locked permanently', data };
  }
}
