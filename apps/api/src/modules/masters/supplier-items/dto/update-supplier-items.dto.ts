import { PartialType } from '@nestjs/swagger';
import { CreateSupplierItemDto } from './create-supplier-items.dto';

export class UpdateSupplierItemDto extends PartialType(CreateSupplierItemDto) {}
