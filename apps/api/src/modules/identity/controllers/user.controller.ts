import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { UserService } from '../services/user.service';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { JwtPayload } from '../../../common/guards/jwt-auth.guard';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { AssignRoleDto } from '../dto/assign-role.dto';
import { AssignBranchDto } from '../dto/assign-branch.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'List all users (paginated)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'branchId', required: false })
  async findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('branchId') branchId?: string,
    @CurrentUser() user?: any
  ) {
    return this.userService.findAll({
      page: Number(page),
      limit: Number(limit),
      branchId,
      organizationId: user?.organizationId,
    });
  }

  @Get(':id')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.findById(id);
  }

  @Post()
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Create a new user' })
  async create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto
  ) {
    return this.userService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('users:delete')
  @ApiOperation({ summary: 'Soft-delete a user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload
  ) {
    return this.userService.softDelete(id, user.sub);
  }

  @Post(':id/roles')
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Assign a role to a user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleDto
  ) {
    return this.userService.assignRole(id, dto);
  }

  @Delete(':id/roles/:roleId')
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Remove a role from a user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'roleId', type: 'string', format: 'uuid' })
  async removeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roleId', ParseUUIDPipe) roleId: string
  ) {
    return this.userService.removeRole(id, roleId);
  }

  @Patch(':id/branch')
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Reassign user to a different branch' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async assignBranch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignBranchDto
  ) {
    return this.userService.assignBranch(id, dto);
  }
}
