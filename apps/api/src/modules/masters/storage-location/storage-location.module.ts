import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { StorageLocationService } from './storage-location.service';
import { StorageLocationController } from './storage-location.controller';

@Module({
  imports: [IdentityModule],
  controllers: [StorageLocationController],
  providers: [StorageLocationService],
})
export class StorageLocationModule {}
