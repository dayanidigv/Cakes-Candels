import { PartialType } from '@nestjs/swagger';
import { CreateRecipeMasterDto } from './create-recipe-masters.dto';

export class UpdateRecipeMasterDto extends PartialType(CreateRecipeMasterDto) {}
