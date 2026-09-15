import { PartialType } from '@nestjs/swagger';
import { CreateDesignationDto } from './create-designations.dto';

export class UpdateDesignationDto extends PartialType(CreateDesignationDto) {}
