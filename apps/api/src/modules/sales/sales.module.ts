import { Module } from '@nestjs/common';
import { CustomersModule } from './customers/customers.module';
import { OrdersModule } from './orders/orders.module';
import { BillingModule } from './billing/billing.module';
import { CrmModule } from './crm/crm.module';

@Module({
  imports: [CustomersModule, OrdersModule, BillingModule, CrmModule],
  exports: [CrmModule],
})
export class SalesModule {}
