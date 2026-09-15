import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { PaymentMethodService } from './payment-methods.service';
import { PaymentMethodController } from './payment-methods.controller';

@Module({
  imports: [IdentityModule],
  controllers: [PaymentMethodController],
  providers: [PaymentMethodService],
  exports: [PaymentMethodService]
})
export class PaymentMethodModule {}
