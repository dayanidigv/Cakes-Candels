import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors, Query } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateCustomerAddressDto } from './dto/customer-address.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { AuditInterceptor } from '../../../common/interceptors/audit.interceptor';

@Controller('sales/customers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(AuditInterceptor)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @RequirePermissions('sales:write')
  create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  @Get()
  @RequirePermissions('sales:read')
  findAll(@Query('search') search?: string) {
    return this.customersService.findAll(search);
  }

  @Get(':id')
  @RequirePermissions('sales:read')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('sales:write')
  update(@Param('id') id: string, @Body() updateCustomerDto: UpdateCustomerDto) {
    return this.customersService.update(id, updateCustomerDto);
  }

  @Delete(':id')
  @RequirePermissions('sales:write')
  remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }

  @Post(':id/addresses')
  @RequirePermissions('sales:write')
  addAddress(@Param('id') id: string, @Body() createAddressDto: CreateCustomerAddressDto) {
    return this.customersService.addAddress(id, createAddressDto);
  }

  @Patch(':id/addresses/:addressId')
  @RequirePermissions('sales:write')
  updateAddress(
    @Param('id') customerId: string, 
    @Param('addressId') addressId: string, 
    @Body() updateAddressDto: Partial<CreateCustomerAddressDto>
  ) {
    return this.customersService.updateAddress(customerId, addressId, updateAddressDto);
  }

  @Delete(':id/addresses/:addressId')
  @RequirePermissions('sales:write')
  removeAddress(@Param('id') customerId: string, @Param('addressId') addressId: string) {
    return this.customersService.removeAddress(customerId, addressId);
  }
}
