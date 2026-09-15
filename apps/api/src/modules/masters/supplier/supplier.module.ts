import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { SupplierService } from './supplier.service';
import { SupplierController } from './supplier.controller';

@Module({
  imports: [IdentityModule],
  controllers: [SupplierController],
  providers: [SupplierService],
})
export class SupplierModule {}
