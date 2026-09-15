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
import { PayrollPeriodService } from '../services/payroll-period.service';
import { PayrollRunService } from '../services/payroll-run.service';
import type { RequestingUser } from '../services/employee.service';
import {
  CreatePayrollPeriodDto,
  CreatePayrollRunDto,
  QueryPayrollRunDto,
} from '../dto/payroll.dto';

@ApiTags('HR — Payroll Engine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BranchScopeGuard, PermissionsGuard)
@Controller('hr/payroll')
export class PayrollController {
  constructor(
    private readonly periodService: PayrollPeriodService,
    private readonly runService: PayrollRunService,
  ) {}

  // ─── PERIODS ───────────────────────────────────────────────────────────────

  @Post('periods')
  @RequirePermissions('hr:payroll:run')
  @ApiOperation({ summary: 'Define a new payroll calendar period' })
  async createPeriod(
    @Body() dto: CreatePayrollPeriodDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.periodService.createPeriod(dto, user);
    return { success: true, message: 'Payroll period created successfully', data };
  }

  @Get('periods')
  @RequirePermissions('hr:payroll:read')
  @ApiOperation({ summary: 'List payroll periods for organization' })
  async listPeriods(
    @Query('year') year: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.periodService.listPeriods(user, year ? parseInt(year, 10) : undefined);
    return { success: true, data };
  }

  @Get('periods/:id')
  @RequirePermissions('hr:payroll:read')
  @ApiOperation({ summary: 'Get payroll period details' })
  async getPeriod(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.periodService.getPeriod(id, user);
    return { success: true, data };
  }

  @Patch('periods/:id/close')
  @RequirePermissions('hr:payroll:run')
  @ApiOperation({ summary: 'Close payroll period' })
  async closePeriod(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.periodService.closePeriod(id, user);
    return { success: true, message: 'Payroll period closed', data };
  }

  // ─── RUNS ──────────────────────────────────────────────────────────────────

  @Post('runs')
  @RequirePermissions('hr:payroll:run')
  @ApiOperation({ summary: 'Initialize a new payroll run for period' })
  async createRun(
    @Body() dto: CreatePayrollRunDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.runService.createRun(dto, user);
    return { success: true, message: 'Payroll run initialized', data };
  }

  @Get('runs')
  @RequirePermissions('hr:payroll:read')
  @ApiOperation({ summary: 'List payroll runs' })
  async listRuns(
    @Query() query: QueryPayrollRunDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.runService.listRuns(user, query);
    return { success: true, data };
  }

  @Get('runs/:id')
  @RequirePermissions('hr:payroll:read')
  @ApiOperation({ summary: 'Get payroll run summary' })
  async getRun(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.runService.getRun(id, user);
    return { success: true, data };
  }

  @Post('runs/:id/calculate')
  @RequirePermissions('hr:payroll:run')
  @ApiOperation({ summary: 'Execute mathematical payroll calculation engine' })
  async calculateRun(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.runService.calculatePayrollRun(id, user);
    return { success: true, message: 'Payroll calculated successfully', data };
  }

  @Post('runs/:id/recalculate')
  @RequirePermissions('hr:payroll:run')
  @ApiOperation({ summary: 'Recalculate payroll run' })
  async recalculateRun(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.runService.recalculatePayrollRun(id, user);
    return { success: true, message: 'Payroll recalculated successfully', data };
  }

  @Post('runs/:id/submit-approval')
  @RequirePermissions('hr:payroll:run')
  @ApiOperation({ summary: 'Submit calculated payroll for management approval' })
  async submitForApproval(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.runService.submitForApproval(id, user);
    return { success: true, message: 'Payroll submitted for approval', data };
  }

  @Post('runs/:id/approve')
  @RequirePermissions('hr:payroll:approve')
  @ApiOperation({ summary: 'Approve payroll run (Management/Finance sign-off)' })
  async approveRun(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.runService.approvePayrollRun(id, user);
    return { success: true, message: 'Payroll run approved', data };
  }

  @Post(['runs/:id/post-finance', 'runs/:id/post'])
  @RequirePermissions('hr:payroll:run')
  @ApiOperation({ summary: 'Post approved payroll to Finance domain (Expense / General Ledger)' })
  async postToFinance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('idempotencyKey') idempotencyKey: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.runService.postPayrollToFinance(id, user, idempotencyKey);
    return { success: true, message: 'Payroll posted to Finance domain successfully', data };
  }

  @Get('runs/:id/items')
  @RequirePermissions('hr:payroll:read')
  @ApiOperation({ summary: 'Get calculated employee payroll items and details snapshot' })
  async getRunItems(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.runService.getRunItems(id, user);
    return { success: true, data };
  }
}
