import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Header,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { BranchScopeGuard } from '../../../common/guards/branch-scope.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PayslipService } from '../services/payslip.service';
import type { RequestingUser } from '../services/employee.service';
import { GeneratePayslipsDto, QueryPayslipDto } from '../dto/payslip.dto';

@ApiTags('HR — Payslips & Payroll Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BranchScopeGuard, PermissionsGuard)
@Controller('hr/payslips')
export class PayslipController {
  constructor(private readonly payslipService: PayslipService) {}

  @Post('generate')
  @RequirePermissions('hr:payroll:run')
  @ApiOperation({ summary: 'Generate immutable payslips from a POSTED or PAID payroll run' })
  async generatePayslips(
    @Body() dto: GeneratePayslipsDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.payslipService.generatePayslipsForRun(
      dto.payrollRunId,
      user,
      dto.idempotencyKey,
    );
    return { success: true, message: 'Payslips generated successfully', data };
  }

  @Post(':id/approve')
  @RequirePermissions('hr:payroll:approve')
  @ApiOperation({ summary: 'Approve a single generated payslip' })
  async approvePayslip(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.payslipService.approvePayslip(id, user);
    return { success: true, message: 'Payslip approved successfully', data };
  }

  @Post('runs/:runId/approve')
  @RequirePermissions('hr:payroll:approve')
  @ApiOperation({ summary: 'Bulk approve all payslips for a payroll run' })
  async approveRunPayslips(
    @Param('runId', ParseUUIDPipe) runId: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.payslipService.approvePayslipsForRun(runId, user);
    return { success: true, message: 'Run payslips approved successfully', data };
  }

  @Post(':id/issue')
  @RequirePermissions('hr:payroll:run')
  @ApiOperation({ summary: 'Issue an approved payslip to employee portal' })
  async issuePayslip(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.payslipService.issuePayslip(id, user);
    return { success: true, message: 'Payslip issued successfully', data };
  }

  @Post('runs/:runId/issue')
  @RequirePermissions('hr:payroll:run')
  @ApiOperation({ summary: 'Bulk issue all approved payslips for a payroll run' })
  async issueRunPayslips(
    @Param('runId', ParseUUIDPipe) runId: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.payslipService.issuePayslipsForRun(runId, user);
    return { success: true, message: 'Run payslips issued successfully', data };
  }

  @Get('my-payslips')
  @ApiOperation({ summary: 'Employee Self-Service: Get my issued payslips' })
  async getMyPayslips(@CurrentUser() user: RequestingUser) {
    const data = await this.payslipService.getMyPayslips(user);
    return { success: true, data };
  }

  @Get()
  @RequirePermissions('hr:payroll:read')
  @ApiOperation({ summary: 'List payslips for organization or branch' })
  async listPayslips(
    @Query() query: QueryPayslipDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.payslipService.listPayslips(user, query);
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payslip summary and details' })
  async getPayslip(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.payslipService.getPayslip(id, user);
    return { success: true, data };
  }

  @Get(':id/document')
  @ApiOperation({ summary: 'Get verified document payload for printable rendering' })
  async getPayslipDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.payslipService.renderPayslipDocument(id, user);
    return { success: true, data };
  }

  @Get(':id/pdf')
  @Header('Content-Type', 'text/html')
  @ApiOperation({ summary: 'Render printable A4 HTML payslip view' })
  async renderPayslipHtml(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestingUser,
    @Res() res: Response,
  ) {
    const doc = await this.payslipService.renderPayslipDocument(id, user);
    res.setHeader('Content-Disposition', `inline; filename="${doc.filename}"`);
    res.setHeader('X-Payslip-Hash', doc.pdfHash);
    return res.send(doc.html);
  }
}
