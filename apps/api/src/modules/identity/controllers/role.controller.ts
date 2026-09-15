import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { RoleService } from '../services/role.service';
import { AuthGuard } from '../../../common/guards';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
@UseGuards(AuthGuard)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @ApiOperation({ summary: 'Get all system roles' })
  async findAll(): Promise<any> {
    return this.roleService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get role by UUID' })
  async findOne(@Param('id') id: string): Promise<any> {
    return this.roleService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new role and link permissions' })
  async create(@Body() dto: CreateRoleDto): Promise<any> {
    return this.roleService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update role details and permissions' })
  async update(@Param('id') id: string, @Body() dto: UpdateRoleDto): Promise<any> {
    return this.roleService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete role by UUID (blocked if assigned)' })
  async remove(@Param('id') id: string): Promise<any> {
    return this.roleService.remove(id);
  }
}
