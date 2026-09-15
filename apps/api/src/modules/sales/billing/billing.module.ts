import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { OrdersModule } from '../orders/orders.module'; // exports PricingService
import { InventoryModule } from '../../inventory/inventory.module'; // exports InventoryService

@Module({
  imports: [OrdersModule, InventoryModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
