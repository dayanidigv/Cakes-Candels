import { IsString, IsOptional, Length, IsEnum, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleType } from '@cc-erp/database';

export class CreateRoleDto {
  @ApiProperty({ description: 'The unique role name', minLength: 2, maxLength: 100 })
  @IsString()
  @Length(2, 100)
  name: string;

  @ApiProperty({ enum: RoleType, description: 'Role template type (e.g. SUPER_ADMIN, BRANCH_MANAGER)' })
  @IsEnum(RoleType)
  type: RoleType;

  @ApiPropertyOptional({ description: 'Description of role permissions and access rights', maxLength: 500 })
  @IsString()
  @IsOptional()
  @Length(0, 500)
  description?: string;

  @ApiPropertyOptional({ description: 'Assigned Permission UUIDs list' })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  permissionIds?: string[];
}
