import { PartialType } from '@nestjs/swagger';
import { CreateProductAttributeValueDto } from './create-product-attribute-value.dto';

export class UpdateProductAttributeValueDto extends PartialType(CreateProductAttributeValueDto) {}
