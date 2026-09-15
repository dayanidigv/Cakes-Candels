import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class CreateFiscalYearDto {
  @IsNotEmpty()
  @IsString()
  name: string; // e.g. "FY 2026-2027"

  @IsNotEmpty()
  @IsDateString()
  startDate: string; // e.g. "2026-04-01"

  @IsNotEmpty()
  @IsDateString()
  endDate: string; // e.g. "2027-03-31"
}
