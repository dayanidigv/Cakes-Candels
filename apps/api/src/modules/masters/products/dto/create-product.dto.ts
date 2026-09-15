import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, IsUUID, IsEnum, Min, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum ProductType {
  STANDARD = 'STANDARD',
  VARIANT_PARENT = 'VARIANT_PARENT'
}

export class CreateVariantDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  sku: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  barcode?: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  name: string;

  @IsNumber()
  @Min(0)
  @ApiProperty()
  costPrice: number;

  @IsNumber()
  @Min(0)
  @ApiProperty()
  mrp: number;

  @IsNumber()
  @Min(0)
  @ApiProperty()
  sellingPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false })
  reorderLevel?: number;
}

export class CreateProductDto {
  @IsEnum(ProductType)
  @ApiProperty({ enum: ProductType })
  type: ProductType;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  sku?: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  name: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  description?: string;

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty()
  categoryId: string;

  @IsOptional()
  @IsUUID()
  @ApiProperty({ required: false })
  brandId?: string;

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty()
  taxRuleId: string;

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty()
  uomId: string;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false, default: true })
  isPerishable?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({ required: false })
  shelfLifeDays?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  @ApiProperty({ type: [CreateVariantDto] })
  variants: CreateVariantDto[];
}
