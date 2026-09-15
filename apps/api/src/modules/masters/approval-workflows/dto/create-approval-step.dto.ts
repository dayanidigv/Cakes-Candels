import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, IsUUID, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApprovalStepDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  stepOrder: number;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  requiredRoleId: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
