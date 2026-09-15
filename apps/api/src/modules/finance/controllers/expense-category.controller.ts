import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { BranchScopeGuard } from '../../../common/guards/branch-scope.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequestingUser } from '../services/posting-engine.service';
import { ExpenseService } from '../services/expense.service';
import { CreateExpenseCategoryMappingDto } from '../dto/create-expense-category.dto';

@ApiTags('Finance — Expense Category Mappings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BranchScopeGuard, PermissionsGuard)
@Controller('finance/expense-categories')
export class ExpenseCategoryController {
  constructor(private readonly expenseService: ExpenseService) {}

  @Post()
  @RequirePermissions('finance:expense:create')
  @ApiOperation({ summary: 'Create an expense category mapping with default COA account' })
  async createCategory(
    @Body() dto: CreateExpenseCategoryMappingDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.expenseService.createCategoryMapping(dto, user);
    return { success: true, message: 'Expense category created successfully', data };
  }

  @Get()
  @RequirePermissions('finance:expense:read')
  @ApiOperation({ summary: 'Get active expense category mappings for organization' })
  async getCategories(@CurrentUser() user: RequestingUser) {
    const data = await this.expenseService.getCategoryMappings(user);
    return { success: true, data };
  }
}
