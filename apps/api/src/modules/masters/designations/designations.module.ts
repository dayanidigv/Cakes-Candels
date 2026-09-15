import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { DesignationService } from './designations.service';
import { DesignationController } from './designations.controller';

@Module({
  imports: [IdentityModule],
  controllers: [DesignationController],
  providers: [DesignationService],
  exports: [DesignationService]
})
export class DesignationModule {}
