import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'admin', description: 'Username to send reset token for' })
  @IsString()
  @IsNotEmpty()
  username!: string;
}
