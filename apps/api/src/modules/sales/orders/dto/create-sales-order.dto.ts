import { IsUUID, IsInt, IsOptional, ValidateNested, ArrayMinSize, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSalesOrderItemDto {
  @IsUUID()
  variantId: string;

  @IsInt() // Using Int for simplicity in this DTO, but could be number if decimal QTY allowed
  quantity: number;
}

export class CreateSalesOrderDto {
  @IsUUID()
  customerId: string;

  @IsUUID()
  branchId: string;

  @ValidateNested({ each: true })
  @Type(() => CreateSalesOrderItemDto)
  @ArrayMinSize(1)
  items: CreateSalesOrderItemDto[];

  @IsString()
  @IsOptional()
  couponCode?: string;

  @IsString()
  @IsOptional()
  channel?: 'STOREFRONT' | 'POS' | 'CUSTOM';

  @IsString()
  @IsOptional()
  fulfillmentType?: 'PICKUP' | 'DELIVERY' | 'DINE_IN';

  @IsUUID()
  @IsOptional()
  posShiftId?: string;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}
