import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FinanceService } from './finance.service';

@ApiTags('Finance & Accounting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

  // ─── EXPENSES ───────────────────────────────────────────────────────────────

  @Post('expenses')
  @ApiOperation({ summary: 'Log a branch overhead expense' })
  async createExpense(
    @Request() req,
    @Body() body: { locationId: string; amount: number; category: string; description?: string },
  ) {
    const data = await this.service.createExpense({ ...body, createdBy: req.user?.sub });
    return { success: true, message: 'Expense recorded', data };
  }

  @Get('expenses')
  @ApiOperation({ summary: 'Get expenses with optional filters' })
  async getExpenses(
    @Query('locationId') locationId?: string,
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.service.getExpenses(locationId, category, startDate, endDate);
    return { success: true, data };
  }

  @Get('expenses/summary')
  @ApiOperation({ summary: 'Get expense totals grouped by category' })
  async getExpenseSummary(@Query('locationId') locationId?: string) {
    const data = await this.service.getExpenseSummary(locationId);
    return { success: true, data };
  }

  // ─── CASH REGISTERS ─────────────────────────────────────────────────────────

  @Post('cash-registers/open')
  @ApiOperation({ summary: 'Open a POS cash register for a branch' })
  async openRegister(
    @Request() req,
    @Body() body: { locationId: string; openingBalance: number },
  ) {
    const data = await this.service.openRegister(body.locationId, req.user?.sub, body.openingBalance);
    return { success: true, message: 'Register opened', data };
  }

  @Patch('cash-registers/:id/close')
  @ApiOperation({ summary: 'Submit register for closing and reconciliation' })
  async closeRegister(
    @Param('id') id: string,
    @Body() body: { closingBalance: number; notes?: string },
  ) {
    const data = await this.service.closeRegister(id, body.closingBalance, body.notes);
    return { success: true, message: 'Register marked for review', data };
  }

  @Get('cash-registers/expected-totals')
  @ApiOperation({ summary: 'Get expected totals (Cash, UPI, Card) for a location today' })
  async getRegisterExpectedTotals(
    @Query('locationId') locationId: string,
    @Query('date') date: string
  ) {
    const data = await this.service.getRegisterExpectedTotals(locationId, date);
    return { success: true, data };
  }

  @Patch('cash-registers/:id/approve-close')
  @ApiOperation({ summary: 'Manager approval for a closed register' })
  async approveCloseRegister(@Request() req, @Param('id') id: string) {
    const managerId = req.user?.sub;
    const data = await this.service.managerApproveClosing(id, managerId);
    return { success: true, message: 'Register closing approved', data };
  }

  @Get('cash-registers')
  @ApiOperation({ summary: 'Get register history for a location' })
  async getRegisters(@Query('locationId') locationId?: string) {
    const data = await this.service.getRegisters(locationId);
    return { success: true, data };
  }

  // ─── SUPPLIER LEDGER ────────────────────────────────────────────────────────

  @Get('supplier-ledger')
  @ApiOperation({ summary: 'Get outstanding supplier payables' })
  async getSupplierLedger(@Query('supplierId') supplierId?: string) {
    const data = await this.service.getSupplierLedger(supplierId);
    return { success: true, data };
  }

  // ─── KPI REPORTING ──────────────────────────────────────────────────────────

  @Get('reports/kpis')
  @ApiOperation({ summary: 'Get financial KPI report for a date range' })
  async getKPIs(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('locationId') locationId?: string,
  ) {
    if (!startDate || !endDate) {
      const today = new Date();
      startDate = startDate || new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      endDate = endDate || today.toISOString();
    }
    const data = await this.service.getKPIReport(startDate, endDate, locationId);
    return { success: true, data };
  }
}
