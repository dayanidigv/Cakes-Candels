import { PartialType } from '@nestjs/swagger';
import { CreateProductAttributeDto } from './create-product-attributes.dto';

export class UpdateProductAttributeDto extends PartialType(CreateProductAttributeDto) {}
