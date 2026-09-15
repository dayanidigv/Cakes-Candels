import { PartialType } from '@nestjs/swagger';
import { CreateVehicleDto } from './create-vehicles.dto';

export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {}
