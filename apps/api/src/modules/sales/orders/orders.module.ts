import { Module, forwardRef } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PricingService } from './pricing.service';
import { OrdersController } from './orders.controller';
import { PromotionsModule } from '../promotions/promotions.module';
import { InventoryModule } from '../../inventory/inventory.module';
import { PosShiftService } from '../pos/pos-shift.service';
import { PosOfflineService } from '../pos/pos-offline.service';
import { PaymentsService } from '../payments/payments.service';
import { LoyaltyService } from '../crm/loyalty.service';
import { CustomCakesService } from '../custom-cakes/custom-cakes.service';

@Module({
  imports: [forwardRef(() => PromotionsModule), InventoryModule],
  controllers: [OrdersController],
  providers: [OrdersService, PricingService, PosShiftService, PosOfflineService, PaymentsService, LoyaltyService, CustomCakesService],
  exports: [OrdersService, PricingService, PosShiftService, PosOfflineService, PaymentsService, LoyaltyService, CustomCakesService],
})
export class OrdersModule {}
