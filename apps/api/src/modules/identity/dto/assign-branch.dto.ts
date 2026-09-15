import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty } from 'class-validator';

export class AssignBranchDto {
  @ApiProperty({ example: 'uuid-of-branch' })
  @IsUUID()
  @IsNotEmpty()
  branchId!: string;
}
