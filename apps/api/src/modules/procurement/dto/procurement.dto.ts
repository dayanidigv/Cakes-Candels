import { IsString, IsNotEmpty, IsNumber, IsOptional, IsUUID, Min, ValidateNested, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class POItemDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  variantId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  quantity: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  supplierId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({ type: [POItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => POItemDto)
  items: POItemDto[];

  @ApiProperty()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateGrnItemDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  variantId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  quantity: number;

  @ApiProperty({ required: false, example: 'LOT-2026-001' })
  @IsString()
  @IsOptional()
  batchNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  manufacturedAt?: string | Date;

  @ApiProperty({ required: false })
  @IsOptional()
  expiresAt?: string | Date;
}

export class CreateGrnDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  poId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  supplierInvoice: string;

  @ApiProperty({ required: false, description: 'Optional unique key to ensure idempotency' })
  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @ApiProperty({ type: [CreateGrnItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGrnItemDto)
  items: CreateGrnItemDto[];

  @ApiProperty()
  @IsString()
  @IsOptional()
  notes?: string;
}
