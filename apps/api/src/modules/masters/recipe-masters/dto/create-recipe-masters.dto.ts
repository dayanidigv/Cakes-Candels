import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, IsUUID, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRecipeMasterDto {

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  name: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  description?: string;

  @IsNumber()
  @Min(0.001)
  @ApiProperty()
  yieldQuantity: number;

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty()
  uomId: string;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false, default: true })
  isActive?: boolean;
}
