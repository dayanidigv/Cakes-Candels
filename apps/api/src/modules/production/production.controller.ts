import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor';
import { ProductionService } from './production.service';
import { CreateProductionOrderDto, StartProductionDto, CompleteProductionDto } from './dto/production-order.dto';

@ApiTags('Production (Sprint 5)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('production')
export class ProductionController {
  constructor(private readonly service: ProductionService) {}

  @Post('orders')
  @RequirePermissions('production:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Create a new planned production order' })
  async createProductionOrder(@Body() dto: CreateProductionOrderDto, @Request() req) {
    const data = await this.service.createProductionOrder(dto, req.user?.sub);
    return { success: true, message: 'Production Order created', data };
  }

  @Get('orders')
  @RequirePermissions('production:read')
  @ApiOperation({ summary: 'List production orders' })
  async getProductionOrders(@Query() query: any) {
    const data = await this.service.getProductionOrders(query);
    return { success: true, data };
  }

  @Patch('orders/:id/start')
  @RequirePermissions('production:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Start production (Consumes raw materials)' })
  async startProduction(@Param('id') id: string, @Body() dto: StartProductionDto, @Request() req) {
    const data = await this.service.startProduction(id, dto, req.user?.sub);
    return { success: true, message: 'Production started and materials consumed', data };
  }

  @Patch('orders/:id/complete')
  @RequirePermissions('production:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Complete production (Yields finished goods)' })
  async completeProduction(@Param('id') id: string, @Body() dto: CompleteProductionDto, @Request() req) {
    const data = await this.service.completeProduction(id, dto, req.user?.sub);
    return { success: true, message: 'Production completed and finished goods yielded', data };
  }
}
