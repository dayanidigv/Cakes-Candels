import { Controller, Post, Body, UseGuards, UseInterceptors } from '@nestjs/common';
import { PromotionValidationService } from './promotion-validation.service';
import { ValidatePromotionDto } from './promotion-validation.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { AuditInterceptor } from '../../../common/interceptors/audit.interceptor';
import { PricingService } from '../orders/pricing.service';
import { Decimal } from '@prisma/client/runtime/library';

@Controller('sales/promotions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(AuditInterceptor)
export class PromotionsController {
  constructor(
    private readonly validationService: PromotionValidationService,
    private readonly pricingService: PricingService
  ) {}

  @Post('validate')
  @RequirePermissions('sales:read') // Reading promotion status / validation
  async validateCoupon(@Body() dto: ValidatePromotionDto) {
    // Re-resolve pricing to get authoritative subtotal for validation
    // The controller acts as the orchestrator to ensure frontend can't dictate totals
    const pricingResult = await this.pricingService.resolveOrderPricing(
      dto.branchId, 
      dto.items.map(i => ({ variantId: i.variantId, quantity: i.quantity }))
      // We explicitly omit the couponCode here to get the raw cart subtotal
    );

    const validationContext = {
      promotionCode: dto.couponCode,
      customerId: dto.customerId,
      branchId: dto.branchId,
      subtotal: pricingResult.subtotal,
      items: dto.items, // includes productId, categoryId
    };

    return this.validationService.validate(validationContext);
  }
}
