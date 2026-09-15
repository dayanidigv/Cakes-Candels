import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { ReasonMasterService } from './reason-masters.service';
import { ReasonMasterController } from './reason-masters.controller';

@Module({
  imports: [IdentityModule],
  controllers: [ReasonMasterController],
  providers: [ReasonMasterService],
  exports: [ReasonMasterService]
})
export class ReasonMasterModule {}
