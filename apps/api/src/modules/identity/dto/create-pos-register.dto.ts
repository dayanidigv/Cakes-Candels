import { IsString, Length, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePOSRegisterDto {
  @ApiProperty({ description: 'Branch UUID reference' })
  @IsUUID()
  branchId: string;

  @ApiProperty({ description: 'The unique name of the POS register', minLength: 2, maxLength: 100 })
  @IsString()
  @Length(2, 100)
  name: string;

  @ApiProperty({ description: 'Device unique MAC or identifier', minLength: 2, maxLength: 200 })
  @IsString()
  @Length(2, 200)
  deviceIdentifier: string;
}
