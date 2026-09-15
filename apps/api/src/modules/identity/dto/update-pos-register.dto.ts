import { IsString, IsOptional, Length, IsUUID, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePOSRegisterDto {
  @ApiPropertyOptional({ description: 'Branch UUID reference' })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ description: 'The unique name of the POS register', minLength: 2, maxLength: 100 })
  @IsString()
  @IsOptional()
  @Length(2, 100)
  name?: string;

  @ApiPropertyOptional({ description: 'Device unique MAC or identifier', minLength: 2, maxLength: 200 })
  @IsString()
  @IsOptional()
  @Length(2, 200)
  deviceIdentifier?: string;

  @ApiPropertyOptional({ description: 'Is active status flag' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
