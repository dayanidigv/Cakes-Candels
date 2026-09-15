import { Controller, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('POS Billing')
@ApiBearerAuth()
@Controller('sales/billing')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('checkout')
  @ApiOperation({ summary: 'Process POS Checkout (Atomic Transaction)' })
  @RequirePermissions('sales:write')
  async checkout(@Req() req: any, @Body() body: {
    idempotencyKey: string;
    branchId: string;
    customerId?: string;
    paymentMode: string;
    loyaltyPointsRedeemed?: number;
    items: Array<{ variantId: string; quantity: number }>;
  }) {
    const userId = req.user?.sub;
    const organizationId = req.user?.organizationId;
    return this.billingService.processCheckout({ ...body, userId, organizationId });
  }

  @Post(':id/request-void')
  @ApiOperation({ summary: 'Request to void a completed order' })
  @RequirePermissions('sales:write')
  async requestVoid(@Req() req: any, @Param('id') id: string, @Body() body: { reason: string }) {
    const userId = req.user?.sub;
    return this.billingService.requestVoid(id, body.reason, userId);
  }

  @Post(':id/approve-void')
  @ApiOperation({ summary: 'Approve a void request and rollback transactions' })
  @RequirePermissions('sales:delete')
  async approveVoid(@Req() req: any, @Param('id') id: string) {
    const managerId = req.user?.sub;
    return this.billingService.approveVoid(id, managerId);
  }
}
