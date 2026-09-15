import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { VehicleService } from './vehicles.service';
import { VehicleController } from './vehicles.controller';

@Module({
  imports: [IdentityModule],
  controllers: [VehicleController],
  providers: [VehicleService],
  exports: [VehicleService]
})
export class VehicleModule {}
