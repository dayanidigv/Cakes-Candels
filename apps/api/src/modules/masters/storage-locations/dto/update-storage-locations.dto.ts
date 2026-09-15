import { PartialType } from '@nestjs/swagger';
import { CreateStorageLocationDto } from './create-storage-locations.dto';

export class UpdateStorageLocationDto extends PartialType(CreateStorageLocationDto) {}
