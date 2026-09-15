import { IsUUID, IsNumber, IsPositive, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReserveStockDto {
  @ApiProperty({ description: 'Branch / Location ID where stock is reserved' })
  @IsUUID()
  branchId: string;

  @ApiProperty({ description: 'Product Variant ID' })
  @IsUUID()
  variantId: string;

  @ApiProperty({ description: 'Quantity to reserve', example: 1 })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiPropertyOptional({ description: 'Associated Sales Order ID' })
  @IsOptional()
  @IsUUID()
  salesOrderId?: string;

  @ApiPropertyOptional({ description: 'Optional Reservation notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
