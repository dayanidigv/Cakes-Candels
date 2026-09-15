import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectExpenseDto {
  @ApiProperty({ description: 'Rejection justification memo' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
