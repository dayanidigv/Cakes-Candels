import { PartialType } from '@nestjs/swagger';
import { CreateNotificationTemplateDto } from './create-notification-templates.dto';

export class UpdateNotificationTemplateDto extends PartialType(CreateNotificationTemplateDto) {}
