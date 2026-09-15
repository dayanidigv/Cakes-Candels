import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { OrganizationService } from '../services/organization.service';
import { AuthGuard } from '../../../common/guards';
import { CreateOrganizationDto } from '../dto/create-organization.dto';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
@UseGuards(AuthGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  @ApiOperation({ summary: 'Get all organizations' })
  async findAll(): Promise<any> {
    return this.organizationService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organization by UUID' })
  async findOne(@Param('id') id: string): Promise<any> {
    return this.organizationService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new organization' })
  async create(@Body() dto: CreateOrganizationDto): Promise<any> {
    return this.organizationService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update organization by UUID' })
  async update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto): Promise<any> {
    return this.organizationService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete (deactivate) organization by UUID' })
  async remove(@Param('id') id: string): Promise<any> {
    return this.organizationService.remove(id);
  }
}
