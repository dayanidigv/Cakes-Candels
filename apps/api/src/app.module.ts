import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module';
import { LoggerModule } from './common/logger/logger.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { SharedModule } from './modules/shared/shared.module';
import { IdentityModule } from './modules/identity/identity.module';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { TaxRuleModule } from './modules/masters/tax-rule/tax-rule.module';
import { UomModule } from './modules/masters/uom/uom.module';
import { CategoryModule } from './modules/masters/category/category.module';
import { BrandModule } from './modules/masters/brand/brand.module';
import { SupplierModule } from './modules/masters/supplier/supplier.module';
import { StorageLocationModule } from './modules/masters/storage-location/storage-location.module';
import { ProductAttributeModule } from './modules/masters/product-attributes/product-attributes.module';
import { RecipeMasterModule } from './modules/masters/recipe-masters/recipe-masters.module';
import { SupplierItemModule } from './modules/masters/supplier-items/supplier-items.module';
import { NumberSeriesModule } from './modules/masters/number-series/number-series.module';
import { ApprovalWorkflowModule } from './modules/masters/approval-workflows/approval-workflows.module';
import { NotificationTemplateModule } from './modules/masters/notification-templates/notification-templates.module';
import { ReasonMasterModule } from './modules/masters/reason-masters/reason-masters.module';
import { PaymentMethodModule } from './modules/masters/payment-methods/payment-methods.module';
import { VehicleModule } from './modules/masters/vehicles/vehicles.module';
import { DesignationModule } from './modules/masters/designations/designations.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ProductsModule } from './modules/masters/products/products.module';
import { VariantsModule } from './modules/masters/variants/variants.module';
import { ProductionModule } from './modules/production/production.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { SalesModule } from './modules/sales/sales.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { CrmModule } from './modules/crm/crm.module';
import { HrModule } from './modules/hr/hr.module';
import { FinanceModule } from './modules/finance/finance.module';
import { LogisticsModule } from './modules/logistics/logistics.module';
import { CustomCakesModule } from './modules/custom-cakes/custom-cakes.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'global',
          ttl: 60000,   // 60 seconds window
          limit: 100,   // 100 requests per window
        },
      ],
    }),
    PinoLoggerModule.forRoot({
      pinoHttp: {
        transport: process.env.NODE_ENV !== 'production' ? {
          target: 'pino-pretty',
          options: {
            singleLine: true,
            colorize: true
          }
        } : undefined,
        genReqId: (req: any) => req.headers['x-request-id'] || randomUUID(),
        customProps: (req: any) => ({
          user: req.user ? req.user.id : 'anonymous'
        }),
        serializers: {
          req: (req: any) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip
          }),
          res: (res: any) => ({
            statusCode: res.statusCode
          })
        }
      }
    }),
    SharedModule,
    IdentityModule,
    TaxRuleModule,
    UomModule,
    CategoryModule,
    BrandModule,
    SupplierModule,
    StorageLocationModule,
    ProductAttributeModule, 
    RecipeMasterModule, 
    SupplierItemModule, 
    NumberSeriesModule, 
    ApprovalWorkflowModule, 
    NotificationTemplateModule, 
    ReasonMasterModule, 
    PaymentMethodModule, 
    VehicleModule, 
    DesignationModule,
    InventoryModule,
    ProductsModule,
    VariantsModule,
    ProductionModule,
    ProcurementModule,
    SalesModule,
    DashboardModule,
    CrmModule,
    HrModule,
    FinanceModule,
    LogisticsModule,
    CustomCakesModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule {}
