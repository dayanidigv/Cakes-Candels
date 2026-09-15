import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, IsBoolean, Matches } from 'class-validator';
import { AccountType, AccountCategory, BalanceType } from '@prisma/client';

export class CreateAccountDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^[0-9A-Z_-]{2,20}$/, { message: 'Account code must be 2-20 alphanumeric characters (or dashes/underscores)' })
  code: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsEnum(AccountType)
  type: AccountType;

  @IsNotEmpty()
  @IsEnum(AccountCategory)
  category: AccountCategory;

  @IsNotEmpty()
  @IsEnum(BalanceType)
  normalBalance: BalanceType;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsBoolean()
  isPostable?: boolean;

  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;
}
