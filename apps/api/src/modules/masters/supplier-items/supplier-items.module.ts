import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { SupplierItemService } from './supplier-items.service';
import { SupplierItemController } from './supplier-items.controller';

@Module({
  imports: [IdentityModule],
  controllers: [SupplierItemController],
  providers: [SupplierItemService],
  exports: [SupplierItemService]
})
export class SupplierItemModule {}
