import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CancelExpenseDto {
  @ApiPropertyOptional({ description: 'Cancellation / Reversal reason' })
  @IsOptional()
  @IsString()
  reason?: string;
}
