import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { NotificationTemplateService } from './notification-templates.service';
import { NotificationTemplateController } from './notification-templates.controller';

@Module({
  imports: [IdentityModule],
  controllers: [NotificationTemplateController],
  providers: [NotificationTemplateService],
  exports: [NotificationTemplateService]
})
export class NotificationTemplateModule {}
