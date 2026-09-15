import { IsDateString, IsInt, IsNotEmpty, IsString, IsUUID, Min, Max } from 'class-validator';

export class CreateFiscalPeriodDto {
  @IsNotEmpty()
  @IsUUID()
  fiscalYearId: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(12)
  periodNumber: number;

  @IsNotEmpty()
  @IsString()
  name: string; // e.g. "April 2026"

  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @IsNotEmpty()
  @IsDateString()
  endDate: string;
}
