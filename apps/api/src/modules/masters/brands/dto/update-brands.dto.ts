import { PartialType } from '@nestjs/swagger';
import { CreateBrandDto } from './create-brands.dto';

export class UpdateBrandDto extends PartialType(CreateBrandDto) {}
