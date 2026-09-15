import { IsString, IsNumber, IsUUID, IsOptional, IsEnum, IsPositive, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum InventoryTransactionType {
  PURCHASE_RECEIPT = 'PURCHASE_RECEIPT',
  PRODUCTION_CONSUMPTION = 'PRODUCTION_CONSUMPTION',
  PRODUCTION_OUTPUT = 'PRODUCTION_OUTPUT',
  TRANSFER_OUT = 'TRANSFER_OUT',
  TRANSFER_IN = 'TRANSFER_IN',
  SALE = 'SALE',
  SALE_RETURN = 'SALE_RETURN',
  WASTE_PENDING = 'WASTE_PENDING',
  WASTE_APPROVED = 'WASTE_APPROVED',
  ADJUSTMENT_POSITIVE = 'ADJUSTMENT_POSITIVE',
  ADJUSTMENT_NEGATIVE = 'ADJUSTMENT_NEGATIVE',
  CONVERSION_OUT = 'CONVERSION_OUT',
  CONVERSION_IN = 'CONVERSION_IN',
  OPENING_STOCK = 'OPENING_STOCK',
}

export class CreateInventoryTransactionDto {
  @ApiProperty({ description: 'Variant ID' })
  @IsUUID()
  variantId: string;

  @ApiPropertyOptional({ description: 'Batch ID' })
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @ApiPropertyOptional({ description: 'Source location ID' })
  @IsOptional()
  @IsUUID()
  fromLocationId?: string;

  @ApiPropertyOptional({ description: 'Destination location ID' })
  @IsOptional()
  @IsUUID()
  toLocationId?: string;

  @ApiProperty({ description: 'Quantity (positive decimal)' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @Min(0.0001)
  quantity: number;

  @ApiProperty({ enum: InventoryTransactionType, description: 'Transaction type' })
  @IsEnum(InventoryTransactionType)
  type: InventoryTransactionType;

  @ApiPropertyOptional({ description: 'Reference entity ID (GRN, Transfer, Order, etc.)' })
  @IsOptional()
  @IsUUID()
  referenceId?: string;

  @ApiPropertyOptional({ description: 'Reference entity type' })
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
