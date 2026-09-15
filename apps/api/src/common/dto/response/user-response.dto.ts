import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BranchSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}

export class UserResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() username!: string;
  @ApiProperty() fullName!: string;
  @ApiPropertyOptional() email?: string | null;
  @ApiProperty() status!: string;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() branchId!: string;
  @ApiPropertyOptional({ type: BranchSummaryDto }) branch?: BranchSummaryDto | null;
  @ApiProperty({ type: [String] }) roles!: string[];
  @ApiPropertyOptional({ type: [String] }) permissions?: string[];
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class UserListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() username!: string;
  @ApiProperty() fullName!: string;
  @ApiPropertyOptional() email?: string | null;
  @ApiProperty() status!: string;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() branchId!: string;
  @ApiPropertyOptional({ type: BranchSummaryDto }) branch?: BranchSummaryDto | null;
  @ApiProperty({ type: [String] }) roles!: string[];
  @ApiProperty() createdAt!: Date;
}

export class CreateUserResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() username!: string;
  @ApiProperty() fullName!: string;
}
