import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { BrandService } from './brand.service';
import { BrandController } from './brand.controller';

@Module({
  imports: [IdentityModule],
  controllers: [BrandController],
  providers: [BrandService],
})
export class BrandModule {}
