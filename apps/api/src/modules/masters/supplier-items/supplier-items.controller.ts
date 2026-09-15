import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors, Query, Request } from '@nestjs/common';
import { SupplierItemService } from './supplier-items.service';
import { CreateSupplierItemDto } from './dto/create-supplier-items.dto';
import { UpdateSupplierItemDto } from './dto/update-supplier-items.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { AuditInterceptor } from '../../../common/interceptors/audit.interceptor';

import { RolesGuard } from '../../../common/guards/roles.guard';

@ApiTags('SupplierItem (Advanced Masters)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, RolesGuard)
@Controller('masters/supplier-items')
export class SupplierItemController {
  constructor(private readonly service: SupplierItemService) {}

  @Post()
  @RequirePermissions('masters:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Create new SupplierItem' })
  async create(@Body() createDto: CreateSupplierItemDto, @Request() req) {
    const data = await this.service.create(createDto, req.user?.sub);
    return { success: true, message: 'SupplierItem created successfully', data };
  }

  @Get()
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'List SupplierItem with pagination and search' })
  async findAll(@Query() query: any) {
    const data = await this.service.findAll(query);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'Get SupplierItem by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.service.findById(id);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('masters:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Update SupplierItem' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateSupplierItemDto, @Request() req) {
    const data = await this.service.update(id, updateDto, req.user?.sub);
    return { success: true, message: 'SupplierItem updated successfully', data };
  }

  @Delete(':id')
  @RequirePermissions('masters:delete')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Soft delete SupplierItem' })
  async remove(@Param('id') id: string, @Request() req) {
    const data = await this.service.remove(id, req.user?.sub);
    return { success: true, message: 'SupplierItem deleted successfully', data };
  }
}
