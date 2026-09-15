import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor';
import { InventoryService } from './inventory.service';
import { CreateInventoryTransactionDto } from './dto/create-inventory-transaction.dto';
import { CreateStockTransferDto, ReceiveStockTransferDto } from './dto/stock-transfer.dto';
import { CreateWastageLogDto, ApproveWastageDto, RejectWastageDto } from './dto/wastage-log.dto';

@ApiTags('Inventory (Sprint 3)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  // ─── TRANSACTIONS ───────────────────────────────────────────────────

  @Post('transactions')
  @RequirePermissions('inventory:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Post an immutable inventory transaction' })
  async postTransaction(@Body() dto: CreateInventoryTransactionDto, @Request() req) {
    const data = await this.service.postTransaction(dto, req.user?.sub);
    return { success: true, message: 'Transaction posted successfully', data };
  }

  @Get('transactions')
  @RequirePermissions('inventory:read')
  @ApiOperation({ summary: 'Get all inventory transactions with filters' })
  async getTransactions(@Query() query: any) {
    const data = await this.service.getTransactions(query);
    return { success: true, data };
  }

  // ─── STOCK LEVELS ──────────────────────────────────────────────────

  @Get('stock-levels')
  @RequirePermissions('inventory:read')
  @ApiOperation({ summary: 'Get real-time stock balances per location & product' })
  async getStockLevels(@Query() query: any) {
    const data = await this.service.getStockLevels(query);
    return { success: true, data };
  }

  // ─── STOCK TRANSFERS ───────────────────────────────────────────────

  @Post('transfers')
  @RequirePermissions('inventory:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Create a new stock transfer request (REQUESTED status)' })
  async createTransfer(@Body() dto: CreateStockTransferDto, @Request() req) {
    const data = await this.service.createTransfer(dto, req.user?.sub);
    return { success: true, message: 'Stock transfer request created', data };
  }

  @Get('transfers')
  @RequirePermissions('inventory:read')
  @ApiOperation({ summary: 'List stock transfers with status filters' })
  async getTransfers(@Query() query: any) {
    const data = await this.service.getTransfers(query);
    return { success: true, data };
  }

  @Patch('transfers/:id/dispatch')
  @RequirePermissions('inventory:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Dispatch a stock transfer (REQUESTED → IN_TRANSIT)' })
  async dispatchTransfer(@Param('id') id: string, @Request() req) {
    const data = await this.service.dispatchTransfer(id, req.user?.sub);
    return { success: true, message: 'Transfer dispatched successfully', data };
  }

  @Patch('transfers/:id/receive')
  @RequirePermissions('inventory:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Receive a stock transfer (IN_TRANSIT → RECEIVED)' })
  async receiveTransfer(@Param('id') id: string, @Body() dto: ReceiveStockTransferDto, @Request() req) {
    const data = await this.service.receiveTransfer(id, dto, req.user?.sub);
    return { success: true, message: 'Transfer received and stock updated', data };
  }

  // ─── WASTAGE LOGS ──────────────────────────────────────────────────

  @Post('wastage')
  @RequirePermissions('inventory:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Log a wastage entry (PENDING → requires approval)' })
  async logWastage(@Body() dto: CreateWastageLogDto, @Request() req) {
    const data = await this.service.logWastage(dto, req.user?.sub);
    return { success: true, message: 'Wastage logged and stock quarantined', data };
  }

  @Get('wastage')
  @RequirePermissions('inventory:read')
  @ApiOperation({ summary: 'Get wastage logs with status filter' })
  async getWastageLogs(@Query() query: any) {
    const data = await this.service.getWastageLogs(query);
    return { success: true, data };
  }

  @Patch('wastage/:id/approve')
  @RequirePermissions('inventory:approve')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Approve wastage (PENDING → APPROVED) — Owner/Manager only' })
  async approveWastage(@Param('id') id: string, @Body() dto: ApproveWastageDto, @Request() req) {
    const data = await this.service.approveWastage(id, dto, req.user?.sub);
    return { success: true, message: 'Wastage approved and write-off posted', data };
  }

  @Patch('wastage/:id/reject')
  @RequirePermissions('inventory:approve')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Reject wastage (PENDING → REJECTED) — stock restored' })
  async rejectWastage(@Param('id') id: string, @Body() dto: RejectWastageDto, @Request() req) {
    const data = await this.service.rejectWastage(id, dto, req.user?.sub);
    return { success: true, message: 'Wastage rejected and stock restored', data };
  }

  // ─── DASHBOARD ───────────────────────────────────────────────────────

  @Get('dashboard/metrics')
  @RequirePermissions('inventory:read')
  @ApiOperation({ summary: 'Get aggregated inventory dashboard metrics' })
  async getDashboardMetrics() {
    const data = await this.service.getDashboardMetrics();
    return { success: true, data };
  }
}
