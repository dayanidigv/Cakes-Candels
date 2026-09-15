import { PartialType } from '@nestjs/swagger';
import { CreateReasonMasterDto } from './create-reason-masters.dto';

export class UpdateReasonMasterDto extends PartialType(CreateReasonMasterDto) {}
