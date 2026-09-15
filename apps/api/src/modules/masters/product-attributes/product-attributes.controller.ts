import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors, Query, Request } from '@nestjs/common';
import { ProductAttributeService } from './product-attributes.service';
import { CreateProductAttributeDto } from './dto/create-product-attributes.dto';
import { UpdateProductAttributeDto } from './dto/update-product-attributes.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { AuditInterceptor } from '../../../common/interceptors/audit.interceptor';
import { CreateProductAttributeValueDto } from './dto/create-product-attribute-value.dto';
import { UpdateProductAttributeValueDto } from './dto/update-product-attribute-value.dto';

import { RolesGuard } from '../../../common/guards/roles.guard';

@ApiTags('ProductAttribute (Advanced Masters)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, RolesGuard)
@Controller('masters/product-attributes')
export class ProductAttributeController {
  constructor(private readonly service: ProductAttributeService) {}

  @Post()
  @RequirePermissions('masters:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Create new ProductAttribute' })
  async create(@Body() createDto: CreateProductAttributeDto, @Request() req) {
    const data = await this.service.create(createDto, req.user?.sub);
    return { success: true, message: 'ProductAttribute created successfully', data };
  }

  @Get()
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'List ProductAttribute with pagination and search' })
  async findAll(@Query() query: any) {
    const data = await this.service.findAll(query);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'Get ProductAttribute by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.service.findById(id);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('masters:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Update ProductAttribute' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateProductAttributeDto, @Request() req) {
    const data = await this.service.update(id, updateDto, req.user?.sub);
    return { success: true, message: 'ProductAttribute updated successfully', data };
  }

  @Delete(':id')
  @RequirePermissions('masters:delete')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Soft delete ProductAttribute' })
  async remove(@Param('id') id: string, @Request() req) {
    const data = await this.service.remove(id, req.user?.sub);
    return { success: true, message: 'ProductAttribute deleted successfully', data };
  }

  @Post(':id/values')
  @RequirePermissions('masters:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Add a value to a ProductAttribute' })
  async addValue(@Param('id') id: string, @Body() createDto: CreateProductAttributeValueDto, @Request() req) {
    const data = await this.service.addValue(id, createDto, req.user?.sub);
    return { success: true, message: 'Value added successfully', data };
  }

  @Patch(':id/values/:valueId')
  @RequirePermissions('masters:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Update a ProductAttribute value' })
  async updateValue(@Param('id') id: string, @Param('valueId') valueId: string, @Body() updateDto: UpdateProductAttributeValueDto, @Request() req) {
    const data = await this.service.updateValue(id, valueId, updateDto, req.user?.sub);
    return { success: true, message: 'Value updated successfully', data };
  }

  @Delete(':id/values/:valueId')
  @RequirePermissions('masters:delete')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Soft delete a ProductAttribute value' })
  async removeValue(@Param('id') id: string, @Param('valueId') valueId: string, @Request() req) {
    const data = await this.service.removeValue(id, valueId, req.user?.sub);
    return { success: true, message: 'Value deleted successfully', data };
  }
}
