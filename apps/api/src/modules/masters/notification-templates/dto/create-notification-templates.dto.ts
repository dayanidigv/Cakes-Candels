import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNotificationTemplateDto {

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  type: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  eventName: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  subject?: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  bodyTemplate: string;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false, default: true })
  isActive?: boolean;
}
