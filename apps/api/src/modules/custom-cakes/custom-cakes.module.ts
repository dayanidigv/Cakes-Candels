import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OrdersModule } from '../sales/orders/orders.module';
import { CustomCakesController } from './custom-cakes.controller';

@Module({
  imports: [IdentityModule, OrdersModule],
  controllers: [CustomCakesController],
})
export class CustomCakesModule {}
