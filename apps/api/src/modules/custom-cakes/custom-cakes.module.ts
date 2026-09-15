import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { CustomCakesController } from './custom-cakes.controller';
import { CustomCakesService } from './custom-cakes.service';

@Module({
  imports: [IdentityModule],
  controllers: [CustomCakesController],
  providers: [CustomCakesService],
  exports: [CustomCakesService],
})
export class CustomCakesModule {}
