import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors, Query, Request } from '@nestjs/common';
import { PaymentMethodService } from './payment-methods.service';
import { CreatePaymentMethodDto } from './dto/create-payment-methods.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-methods.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { AuditInterceptor } from '../../../common/interceptors/audit.interceptor';

import { RolesGuard } from '../../../common/guards/roles.guard';

@ApiTags('PaymentMethod (Advanced Masters)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, RolesGuard)
@Controller('masters/payment-methods')
export class PaymentMethodController {
  constructor(private readonly service: PaymentMethodService) {}

  @Post()
  @RequirePermissions('masters:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Create new PaymentMethod' })
  async create(@Body() createDto: CreatePaymentMethodDto, @Request() req) {
    const data = await this.service.create(createDto, req.user?.sub);
    return { success: true, message: 'PaymentMethod created successfully', data };
  }

  @Get()
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'List PaymentMethod with pagination and search' })
  async findAll(@Query() query: any) {
    const data = await this.service.findAll(query);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'Get PaymentMethod by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.service.findById(id);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('masters:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Update PaymentMethod' })
  async update(@Param('id') id: string, @Body() updateDto: UpdatePaymentMethodDto, @Request() req) {
    const data = await this.service.update(id, updateDto, req.user?.sub);
    return { success: true, message: 'PaymentMethod updated successfully', data };
  }

  @Delete(':id')
  @RequirePermissions('masters:delete')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Soft delete PaymentMethod' })
  async remove(@Param('id') id: string, @Request() req) {
    const data = await this.service.remove(id, req.user?.sub);
    return { success: true, message: 'PaymentMethod deleted successfully', data };
  }
}
