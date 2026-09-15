import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StorageLocationService } from './storage-location.service';
import { CreateStorageLocationDto } from './dto/create-storage-location.dto';
import { UpdateStorageLocationDto } from './dto/update-storage-location.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuditInterceptor } from '../../../common/interceptors/audit.interceptor';

@ApiTags('Masters - StorageLocation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('masters/storage-locations')
export class StorageLocationController {
  constructor(private readonly storageLocationService: StorageLocationService) {}

  @Post()
  @UseInterceptors(AuditInterceptor)
  @RequirePermissions('masters:write')
  @ApiOperation({ summary: 'Create StorageLocation' })
  create(@Body() createDto: CreateStorageLocationDto) {
    return this.storageLocationService.create(createDto);
  }

  @Get()
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'Get all storage-locations' })
  findAll() {
    return this.storageLocationService.findAll();
  }

  @Get(':id')
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'Get StorageLocation by ID' })
  findOne(@Param('id') id: string) {
    return this.storageLocationService.findById(id);
  }

  @Patch(':id')
  @UseInterceptors(AuditInterceptor)
  @RequirePermissions('masters:write')
  @ApiOperation({ summary: 'Update StorageLocation' })
  update(@Param('id') id: string, @Body() updateDto: UpdateStorageLocationDto) {
    return this.storageLocationService.update(id, updateDto);
  }

  @Delete(':id')
  @UseInterceptors(AuditInterceptor)
  @RequirePermissions('masters:delete')
  @ApiOperation({ summary: 'Delete StorageLocation' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.storageLocationService.remove(id, user.sub);
  }
}
