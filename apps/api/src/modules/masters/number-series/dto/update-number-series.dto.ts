import { PartialType } from '@nestjs/swagger';
import { CreateNumberSeriesDto } from './create-number-series.dto';

export class UpdateNumberSeriesDto extends PartialType(CreateNumberSeriesDto) {}
