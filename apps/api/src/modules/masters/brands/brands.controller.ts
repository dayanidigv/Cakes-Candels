import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors, Query, Request } from '@nestjs/common';
import { BrandService } from './brands.service';
import { CreateBrandDto } from './dto/create-brands.dto';
import { UpdateBrandDto } from './dto/update-brands.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { AuditInterceptor } from '../../../common/interceptors/audit.interceptor';

@ApiTags('Brand (Master Data)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('masters/brands')
export class BrandController {
  constructor(private readonly service: BrandService) {}

  @Post()
  @RequirePermissions('masters:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Create new Brand' })
  async create(@Body() createDto: CreateBrandDto, @Request() req) {
    const data = await this.service.create(createDto, req.user?.sub);
    return { success: true, message: 'Brand created successfully', data };
  }

  @Post('import')
  @RequirePermissions('masters:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Bulk import Brand' })
  async importBulk(@Body() items: CreateBrandDto[], @Request() req) {
    const data = await this.service.importBulk(items, req.user?.sub);
    return { success: true, message: 'Bulk import processed', data };
  }

  @Get()
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'List Brand with pagination and search' })
  async findAll(@Query() query: any) {
    const data = await this.service.findAll(query);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'Get Brand by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.service.findById(id);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('masters:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Update Brand' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateBrandDto, @Request() req) {
    const data = await this.service.update(id, updateDto, req.user?.sub);
    return { success: true, message: 'Brand updated successfully', data };
  }

  @Delete(':id')
  @RequirePermissions('masters:delete')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Soft delete Brand' })
  async remove(@Param('id') id: string, @Request() req) {
    const data = await this.service.remove(id, req.user?.sub);
    return { success: true, message: 'Brand deleted successfully', data };
  }
}
