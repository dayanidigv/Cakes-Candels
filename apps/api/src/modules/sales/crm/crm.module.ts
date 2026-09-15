import { Module } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { Customer360Service } from './customer360.service';
import { RfmEngineService } from './rfm-engine.service';
import { CustomerHealthService } from './customer-health.service';
import { CustomerClvService } from './customer-clv.service';
import { SegmentationService } from './segmentation.service';
import { AutomationEngineService } from './automation-engine.service';
import { CrmController } from './crm.controller';

@Module({
  controllers: [CrmController],
  providers: [
    LoyaltyService,
    Customer360Service,
    RfmEngineService,
    CustomerHealthService,
    CustomerClvService,
    SegmentationService,
    AutomationEngineService,
  ],
  exports: [
    LoyaltyService,
    Customer360Service,
    RfmEngineService,
    CustomerHealthService,
    CustomerClvService,
    SegmentationService,
    AutomationEngineService,
  ],
})
export class CrmModule {}
