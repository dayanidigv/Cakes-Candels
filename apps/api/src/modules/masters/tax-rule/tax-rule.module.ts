import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { TaxRuleService } from './tax-rule.service';
import { TaxRuleController } from './tax-rule.controller';

@Module({
  imports: [IdentityModule],
  controllers: [TaxRuleController],
  providers: [TaxRuleService],
})
export class TaxRuleModule {}
