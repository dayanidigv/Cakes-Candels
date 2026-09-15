import { IsString, IsOptional, Length, IsEnum, IsArray, IsUUID, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RoleType } from '@cc-erp/database';

export class UpdateRoleDto {
  @ApiPropertyOptional({ description: 'The unique role name', minLength: 2, maxLength: 100 })
  @IsString()
  @IsOptional()
  @Length(2, 100)
  name?: string;

  @ApiPropertyOptional({ enum: RoleType, description: 'Role template type' })
  @IsEnum(RoleType)
  @IsOptional()
  type?: RoleType;

  @ApiPropertyOptional({ description: 'Description of role permissions and access rights', maxLength: 500 })
  @IsString()
  @IsOptional()
  @Length(0, 500)
  description?: string;

  @ApiPropertyOptional({ description: 'Is active status flag' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Assigned Permission UUIDs list' })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  permissionIds?: string[];
}
