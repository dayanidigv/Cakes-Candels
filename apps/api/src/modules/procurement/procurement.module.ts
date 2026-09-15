import { Module } from '@nestjs/common';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { GrnController } from './grn.controller';
import { GrnService } from './grn.service';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [InventoryModule],
  controllers: [PurchaseOrdersController, GrnController],
  providers: [PurchaseOrdersService, GrnService],
  exports: [PurchaseOrdersService, GrnService],
})
export class ProcurementModule {}
