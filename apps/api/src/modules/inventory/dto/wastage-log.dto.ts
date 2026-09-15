import { IsString, IsUUID, IsOptional, IsNumber, IsPositive } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateWastageLogDto {
  @ApiProperty({ description: 'Variant ID' })
  @IsUUID()
  variantId: string;

  @ApiProperty({ description: 'Branch/Location ID' })
  @IsUUID()
  locationId: string;

  @ApiProperty({ description: 'Quantity wasted' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({ description: 'Reason code (from ReasonMaster, e.g. SPOILAGE, EXPIRED)' })
  @IsString()
  reasonCode: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ApproveWastageDto {
  @ApiPropertyOptional({ description: 'Optional approval note' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectWastageDto {
  @ApiProperty({ description: 'Reason for rejection' })
  @IsString()
  rejectionNote: string;
}
