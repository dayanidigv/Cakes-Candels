import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupplierService } from './supplier.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuditInterceptor } from '../../../common/interceptors/audit.interceptor';

@ApiTags('Masters - Supplier')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('masters/suppliers')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Post()
  @UseInterceptors(AuditInterceptor)
  @RequirePermissions('masters:write')
  @ApiOperation({ summary: 'Create Supplier' })
  create(@Body() createDto: CreateSupplierDto) {
    return this.supplierService.create(createDto);
  }

  @Get()
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'Get all suppliers' })
  findAll() {
    return this.supplierService.findAll();
  }

  @Get(':id')
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'Get Supplier by ID' })
  findOne(@Param('id') id: string) {
    return this.supplierService.findById(id);
  }

  @Patch(':id')
  @UseInterceptors(AuditInterceptor)
  @RequirePermissions('masters:write')
  @ApiOperation({ summary: 'Update Supplier' })
  update(@Param('id') id: string, @Body() updateDto: UpdateSupplierDto) {
    return this.supplierService.update(id, updateDto);
  }

  @Delete(':id')
  @UseInterceptors(AuditInterceptor)
  @RequirePermissions('masters:delete')
  @ApiOperation({ summary: 'Delete Supplier' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.supplierService.remove(id, user.sub);
  }
}
