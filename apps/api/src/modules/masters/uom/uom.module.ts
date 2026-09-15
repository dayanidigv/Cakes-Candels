import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { UomService } from './uom.service';
import { UomController } from './uom.controller';

@Module({
  imports: [IdentityModule],
  controllers: [UomController],
  providers: [UomService],
})
export class UomModule {}
