import { IsUUID, IsString, IsArray, ValidateNested, ArrayMinSize, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class ValidatePromotionItemDto {
  @IsUUID()
  variantId: string;

  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  quantity: number;
}

export class ValidatePromotionDto {
  @IsString()
  couponCode: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsUUID()
  branchId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValidatePromotionItemDto)
  @ArrayMinSize(1)
  items: ValidatePromotionItemDto[];
}
