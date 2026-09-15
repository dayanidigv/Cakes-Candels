import { PartialType } from '@nestjs/swagger';
import { CreateRecipeVersionDto } from './create-recipe-version.dto';

export class UpdateRecipeVersionDto extends PartialType(CreateRecipeVersionDto) {}
