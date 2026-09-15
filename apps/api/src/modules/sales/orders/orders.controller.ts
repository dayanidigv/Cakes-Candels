import { Controller, Post, Body, Param, Patch, UseGuards, UseInterceptors, Req } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { AuditInterceptor } from '../../../common/interceptors/audit.interceptor';
import { SalesOrderStatus } from '@cc-erp/database';

@Controller('sales/orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(AuditInterceptor)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @RequirePermissions('sales:write')
  async create(@Req() req: any, @Body() createOrderDto: CreateSalesOrderDto) {
    const userId = req.user?.sub;
    const organizationId = req.user?.organizationId;
    return this.ordersService.createOrder(userId, organizationId, createOrderDto);
  }

  @Patch(':id/status')
  @RequirePermissions('sales:write')
  updateStatus(@Param('id') id: string, @Body('status') status: SalesOrderStatus) {
    return this.ordersService.transitionStatus(id, status);
  }
}
