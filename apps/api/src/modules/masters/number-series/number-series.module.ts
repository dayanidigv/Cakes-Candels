import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { NumberSeriesService } from './number-series.service';
import { NumberSeriesController } from './number-series.controller';

@Module({
  imports: [IdentityModule],
  controllers: [NumberSeriesController],
  providers: [NumberSeriesService],
  exports: [NumberSeriesService]
})
export class NumberSeriesModule {}
