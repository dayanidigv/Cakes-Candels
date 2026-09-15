import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { BranchScopeGuard } from '../../../common/guards/branch-scope.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AccountService, RequestingUser } from '../services/account.service';
import { CreateAccountDto } from '../dto/create-account.dto';
import { UpdateAccountDto } from '../dto/update-account.dto';
import { AccountType, AccountCategory } from '@prisma/client';

@ApiTags('Finance — Chart of Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BranchScopeGuard, PermissionsGuard)
@Controller('finance/accounts')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Post()
  @RequirePermissions('finance:coa:create')
  @ApiOperation({ summary: 'Create an Account in Chart of Accounts' })
  async createAccount(@Body() dto: CreateAccountDto, @CurrentUser() user: RequestingUser) {
    const data = await this.accountService.createAccount(dto, user);
    return { success: true, message: 'Account created successfully', data };
  }

  @Get()
  @RequirePermissions('finance:coa:read')
  @ApiOperation({ summary: 'List Chart of Accounts with filters' })
  async listAccounts(
    @CurrentUser() user: RequestingUser,
    @Query('type') type?: AccountType,
    @Query('category') category?: AccountCategory,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    const data = await this.accountService.listAccounts(user, {
      type,
      category,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      search,
    });
    return { success: true, data };
  }

  @Get('tree')
  @RequirePermissions('finance:coa:read')
  @ApiOperation({ summary: 'Get hierarchical Chart of Accounts tree' })
  async getAccountTree(@CurrentUser() user: RequestingUser) {
    const data = await this.accountService.getAccountTree(user);
    return { success: true, data };
  }

  @Post('seed-system')
  @RequirePermissions('finance:coa:create')
  @ApiOperation({ summary: 'Idempotently seed standard bakery Chart of Accounts' })
  async seedSystemAccounts(@CurrentUser() user: RequestingUser) {
    const data = await this.accountService.seedSystemAccounts(user.organizationId, user.id);
    return { success: true, message: 'System Chart of Accounts seeded successfully', data };
  }

  @Get(':id')
  @RequirePermissions('finance:coa:read')
  @ApiOperation({ summary: 'Get Account by ID' })
  async getAccountById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestingUser) {
    const data = await this.accountService.getAccountById(id, user);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('finance:coa:update')
  @ApiOperation({ summary: 'Update Account metadata' })
  async updateAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.accountService.updateAccount(id, dto, user);
    return { success: true, message: 'Account updated successfully', data };
  }

  @Post(':id/activate')
  @RequirePermissions('finance:coa:activate')
  @ApiOperation({ summary: 'Activate Account' })
  async activateAccount(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestingUser) {
    const data = await this.accountService.activateAccount(id, user);
    return { success: true, message: 'Account activated', data };
  }

  @Post(':id/deactivate')
  @RequirePermissions('finance:coa:deactivate')
  @ApiOperation({ summary: 'Deactivate Account' })
  async deactivateAccount(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestingUser) {
    const data = await this.accountService.deactivateAccount(id, user);
    return { success: true, message: 'Account deactivated', data };
  }
}
