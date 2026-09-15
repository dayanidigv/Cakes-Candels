import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/procurement.dto';

@ApiTags('Procurement - PO (Sprint 6)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('procurement/po')
export class PurchaseOrdersController {
  constructor(private readonly service: PurchaseOrdersService) {}

  @Post()
  @RequirePermissions('procurement:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Create Purchase Order' })
  async createPurchaseOrder(@Body() dto: CreatePurchaseOrderDto, @Request() req) {
    const data = await this.service.createPurchaseOrder(dto, req.user?.sub);
    return { success: true, message: 'Purchase Order created', data };
  }

  @Get()
  @RequirePermissions('procurement:read')
  @ApiOperation({ summary: 'List Purchase Orders' })
  async getPurchaseOrders(@Query() query: any) {
    const data = await this.service.getPurchaseOrders(query);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('procurement:read')
  @ApiOperation({ summary: 'Get Purchase Order by ID' })
  async getPurchaseOrderById(@Param('id') id: string) {
    const data = await this.service.getPurchaseOrderById(id);
    return { success: true, data };
  }

  @Patch(':id/approve')
  @RequirePermissions('procurement:approve')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Approve Purchase Order' })
  async approvePurchaseOrder(@Param('id') id: string, @Request() req) {
    const data = await this.service.approvePurchaseOrder(id, req.user?.sub);
    return { success: true, message: 'Purchase Order approved', data };
  }
}
