import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';

@Module({
  imports: [IdentityModule],
  controllers: [CategoryController],
  providers: [CategoryService],
})
export class CategoryModule {}
