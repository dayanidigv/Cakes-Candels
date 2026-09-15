import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ReopenPeriodDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(10, { message: 'Reopening reason must be at least 10 characters long for audit compliance' })
  reason: string;
}
