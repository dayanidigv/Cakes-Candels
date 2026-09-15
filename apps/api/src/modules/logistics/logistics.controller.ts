import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LogisticsService } from './logistics.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthorizationContext } from '../../common/interfaces/authorization-context.interface';

@ApiTags('Logistics & Dispatch')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('logistics')
export class LogisticsController {
  constructor(private readonly service: LogisticsService) {}

  // ─── DISPATCHES ─────────────────────────────────────────────────────────────

  @Post('dispatches')
  @ApiOperation({ summary: 'Create a new outbound dispatch sheet — status starts at PACKED' })
  async createDispatch(
    @CurrentUser() ctx: AuthorizationContext,
    @Body() body: {
      vehicleId?: string;
      driverUserId?: string;
      fromBranchId: string;
      toBranchId: string;
      expectedDeliveryAt?: string;
      items: Array<{ variantId: string; quantityDispatched: number; batchId?: string }>;
    },
  ) {
    const data = await this.service.createDispatch(body, ctx);
    return { success: true, message: 'Dispatch created', data };
  }

  @Get('dispatches')
  @ApiOperation({ summary: 'List all dispatches with optional filters' })
  async getDispatches(
    @CurrentUser() ctx: AuthorizationContext,
    @Query('status') status?: string,
    @Query('fromBranchId') fromBranchId?: string,
    @Query('toBranchId') toBranchId?: string,
  ) {
    const data = await this.service.getAllDispatches(ctx, status, fromBranchId, toBranchId);
    return { success: true, data };
  }

  @Get('dispatches/:id')
  @ApiOperation({ summary: 'Get dispatch details by ID' })
  async getDispatch(@CurrentUser() ctx: AuthorizationContext, @Param('id') id: string) {
    const data = await this.service.getDispatchById(id, ctx);
    return { success: true, data };
  }

  @Patch('dispatches/:id/dispatch')
  @ApiOperation({ summary: 'Transition: PACKED -> DISPATCHED (Executes TRANSFER_OUT)' })
  async dispatchShipment(@CurrentUser() ctx: AuthorizationContext, @Param('id') id: string, @Body() body: { notes?: string }) {
    const data = await this.service.dispatchShipment(id, ctx, body.notes);
    return { success: true, message: `Status advanced to ${data?.status}`, data };
  }

  @Patch('dispatches/:id/in-transit')
  @ApiOperation({ summary: 'Transition: DISPATCHED -> ON_THE_WAY' })
  async markInTransit(@CurrentUser() ctx: AuthorizationContext, @Param('id') id: string, @Body() body: { notes?: string }) {
    const data = await this.service.markInTransit(id, ctx, body.notes);
    return { success: true, message: `Status advanced to ${data?.status}`, data };
  }

  @Patch('dispatches/:id/arrived')
  @ApiOperation({ summary: 'Transition: ON_THE_WAY -> REACHED_BRANCH' })
  async markArrived(@CurrentUser() ctx: AuthorizationContext, @Param('id') id: string, @Body() body: { notes?: string }) {
    const data = await this.service.markArrived(id, ctx, body.notes);
    return { success: true, message: `Status advanced to ${data?.status}`, data };
  }

  @Patch('dispatches/:id/receive')
  @ApiOperation({ summary: 'Record branch receipt with per-item quantity confirmations and damage logs' })
  async receiveDispatch(
    @CurrentUser() ctx: AuthorizationContext,
    @Param('id') id: string,
    @Body() body: { items: Array<{ itemId: string; quantityReceived: number; damageNotes?: string }> },
  ) {
    const data = await this.service.receiveDispatch(id, ctx, body.items);
    return { success: true, message: 'Dispatch received and stock updated', data };
  }
}
