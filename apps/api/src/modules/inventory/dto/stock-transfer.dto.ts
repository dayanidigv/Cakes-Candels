import { IsString, IsUUID, IsOptional, IsArray, ValidateNested, IsNumber, IsPositive } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class StockTransferItemDto {
  @ApiProperty({ description: 'Variant ID' })
  @IsUUID()
  variantId: string;

  @ApiProperty({ description: 'Quantity requested' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantityRequested: number;
}

export class CreateStockTransferDto {
  @ApiProperty({ description: 'Source branch/location ID' })
  @IsUUID()
  fromLocationId: string;

  @ApiProperty({ description: 'Destination branch/location ID' })
  @IsUUID()
  toLocationId: string;

  @ApiPropertyOptional({ description: 'Notes or remarks' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [StockTransferItemDto], description: 'Items to transfer' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockTransferItemDto)
  items: StockTransferItemDto[];
}

export class ReceiveStockTransferDto {
  @ApiProperty({ description: 'Items received with quantities' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveItemDto)
  items: ReceiveItemDto[];

  @ApiPropertyOptional({ description: 'Notes on receipt' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReceiveItemDto {
  @ApiProperty({ description: 'Transfer Item ID' })
  @IsUUID()
  transferItemId: string;

  @ApiProperty({ description: 'Quantity actually received' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantityReceived: number;
}
