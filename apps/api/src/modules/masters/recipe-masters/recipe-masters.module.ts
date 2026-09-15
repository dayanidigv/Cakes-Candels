import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { RecipeMasterService } from './recipe-masters.service';
import { RecipeMasterController } from './recipe-masters.controller';

@Module({
  imports: [IdentityModule],
  controllers: [RecipeMasterController],
  providers: [RecipeMasterService],
  exports: [RecipeMasterService]
})
export class RecipeMasterModule {}
