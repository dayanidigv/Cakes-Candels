import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, IsUUID, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSupplierItemDto {

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty()
  supplierId: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  itemCode: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  itemName: string;

  @IsOptional()
  @IsUUID()
  @ApiProperty({ required: false })
  futureProductId?: string;

  @IsNumber()
  @Min(0)
  @ApiProperty()
  purchasePrice: number;

  @IsInt()
  @Min(0)
  @ApiProperty()
  leadTimeDays: number;

  @IsNumber()
  @Min(0)
  @ApiProperty()
  moq: number;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false, default: true })
  isActive?: boolean;
}
