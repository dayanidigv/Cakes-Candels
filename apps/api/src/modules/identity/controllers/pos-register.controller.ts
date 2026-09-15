import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { POSRegisterService } from '../services/pos-register.service';
import { AuthGuard } from '../../../common/guards';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CreatePOSRegisterDto } from '../dto/create-pos-register.dto';
import { UpdatePOSRegisterDto } from '../dto/update-pos-register.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';

@ApiTags('POS Registers')
@ApiBearerAuth()
@Controller('pos-registers')
@UseGuards(AuthGuard)
export class POSRegisterController {
  constructor(private readonly posRegisterService: POSRegisterService) {}

  @Get()
  @ApiOperation({ summary: 'Get all POS registers' })
  async findAll(@CurrentUser() user: any): Promise<any> {
    return this.posRegisterService.findAll(user.organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get POS register by UUID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any): Promise<any> {
    return this.posRegisterService.findOne(id, user.organizationId);
  }

  @Post()
  @ApiOperation({ summary: 'Create new POS register' })
  async create(@Body() dto: CreatePOSRegisterDto): Promise<any> {
    return this.posRegisterService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update POS register by UUID' })
  async update(@Param('id') id: string, @Body() dto: UpdatePOSRegisterDto, @CurrentUser() user: any): Promise<any> {
    return this.posRegisterService.update(id, user.organizationId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete POS register by UUID' })
  async remove(@Param('id') id: string, @CurrentUser() user: any): Promise<any> {
    return this.posRegisterService.remove(id, user.organizationId);
  }
}
