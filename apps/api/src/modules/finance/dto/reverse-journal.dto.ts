import { IsDateString, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class ReverseJournalDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(10, { message: 'Reversal reason must be at least 10 characters for audit compliance' })
  reason: string;

  @IsOptional()
  @IsDateString()
  postingDate?: string; // Optional: defaults to current date or original posting date
}
