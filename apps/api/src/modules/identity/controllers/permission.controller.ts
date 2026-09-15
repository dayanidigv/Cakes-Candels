import { Controller, Get, UseGuards } from '@nestjs/common';
import { PermissionService } from '../services/permission.service';
import { AuthGuard } from '../../../common/guards';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';

@ApiTags('Permissions')
@ApiBearerAuth()
@Controller('permissions')
@UseGuards(AuthGuard)
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  @ApiOperation({ summary: 'Get all system permissions' })
  async findAll(): Promise<any> {
    return this.permissionService.findAll();
  }
}
