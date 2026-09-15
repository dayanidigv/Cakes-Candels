import { IsString, IsNotEmpty, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductionOrderDto {
  @ApiProperty({ description: 'Branch/Factory UUID where production happens' })
  @IsUUID()
  @IsNotEmpty()
  locationId: string;

  @ApiProperty({ description: 'Finished Good Variant UUID' })
  @IsUUID()
  @IsNotEmpty()
  variantId: string;

  @ApiProperty({ description: 'Recipe Version UUID to use' })
  @IsUUID()
  @IsNotEmpty()
  recipeVersionId: string;

  @ApiProperty({ description: 'Target yield quantity' })
  @IsNumber()
  @Min(0.01)
  targetQuantity: number;

  @ApiProperty({ description: 'Optional notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class StartProductionDto {
  @ApiProperty({ description: 'Optional override notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CompleteProductionDto {
  @ApiProperty({ description: 'Actual Yield produced' })
  @IsNumber()
  @Min(0.01)
  actualYield: number;

  @ApiProperty({ required: false, example: 'BATCH-CAKE-2026-001' })
  @IsString()
  @IsOptional()
  batchNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  manufacturedAt?: string | Date;

  @ApiProperty({ required: false })
  @IsOptional()
  expiresAt?: string | Date;

  @ApiProperty({ required: false, description: 'Optional unique key for idempotency' })
  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @ApiProperty({ description: 'Optional notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
