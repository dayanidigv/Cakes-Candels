import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { ProductAttributeService } from './product-attributes.service';
import { ProductAttributeController } from './product-attributes.controller';

@Module({
  imports: [IdentityModule],
  controllers: [ProductAttributeController],
  providers: [ProductAttributeService],
  exports: [ProductAttributeService]
})
export class ProductAttributeModule {}
