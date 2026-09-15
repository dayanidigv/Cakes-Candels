import { Module, forwardRef } from '@nestjs/common';
import { PromotionsRepository } from './promotions.repository';
import { PromotionValidationService } from './promotion-validation.service';
import { PromotionUsageService } from './promotion-usage.service';
import { PromotionsController } from './promotions.controller';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [forwardRef(() => OrdersModule)],
  controllers: [PromotionsController],
  providers: [PromotionsRepository, PromotionValidationService, PromotionUsageService],
  exports: [PromotionsRepository, PromotionValidationService, PromotionUsageService],
})
export class PromotionsModule {}

