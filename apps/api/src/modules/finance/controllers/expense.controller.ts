import {
  Controller,
  Get,
  Post,
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
import { RequestingUser } from '../services/posting-engine.service';
import { ExpenseService } from '../services/expense.service';
import { ExpensePostingService } from '../services/expense-posting.service';
import { CreateExpenseDto } from '../dto/create-expense.dto';
import { QueryExpenseDto } from '../dto/query-expense.dto';
import { RejectExpenseDto } from '../dto/reject-expense.dto';
import { CancelExpenseDto } from '../dto/cancel-expense.dto';

@ApiTags('Finance — Expenses Subledger')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BranchScopeGuard, PermissionsGuard)
@Controller('finance/expenses')
export class ExpenseController {
  constructor(
    private readonly expenseService: ExpenseService,
    private readonly postingService: ExpensePostingService,
  ) {}

  @Post()
  @RequirePermissions('finance:expense:create')
  @ApiOperation({ summary: 'Create a draft operational expense' })
  async createExpense(@Body() dto: CreateExpenseDto, @CurrentUser() user: RequestingUser) {
    const result = await this.expenseService.createExpense(dto, user);
    return {
      success: true,
      message: result.isReplay ? 'Expense already created (idempotent replay)' : 'Expense created successfully',
      data: result.expense,
    };
  }

  @Get()
  @RequirePermissions('finance:expense:read')
  @ApiOperation({ summary: 'List and filter expenses with pagination' })
  async getExpenses(@Query() query: QueryExpenseDto, @CurrentUser() user: RequestingUser) {
    const data = await this.expenseService.getExpenses(query, user);
    return { success: true, ...data };
  }

  @Get('summary')
  @RequirePermissions('finance:expense:read')
  @ApiOperation({ summary: 'Get summary statistics of expenses by status' })
  async getExpenseSummary(@Query('branchId') branchId: string | undefined, @CurrentUser() user: RequestingUser) {
    const data = await this.expenseService.getExpenseSummary(branchId, user);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('finance:expense:read')
  @ApiOperation({ summary: 'Get details of a single expense by ID' })
  async getExpenseById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestingUser) {
    const data = await this.expenseService.getExpenseById(id, user);
    return { success: true, data };
  }

  @Post(':id/submit')
  @RequirePermissions('finance:expense:submit')
  @ApiOperation({ summary: 'Submit a draft expense for approval' })
  async submitExpense(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestingUser) {
    const data = await this.expenseService.submitExpense(id, user);
    return { success: true, message: 'Expense submitted for approval', data };
  }

  @Post(':id/approve')
  @RequirePermissions('finance:expense:approve')
  @ApiOperation({ summary: 'Approve a submitted expense' })
  async approveExpense(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestingUser) {
    const data = await this.expenseService.approveExpense(id, user);
    return { success: true, message: 'Expense approved successfully', data };
  }

  @Post(':id/reject')
  @RequirePermissions('finance:expense:reject')
  @ApiOperation({ summary: 'Reject a submitted expense' })
  async rejectExpense(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectExpenseDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.expenseService.rejectExpense(id, dto, user);
    return { success: true, message: 'Expense rejected', data };
  }

  @Post(':id/post')
  @RequirePermissions('finance:expense:post')
  @ApiOperation({ summary: 'Post an approved expense to General Ledger via FinancePostingEngine' })
  async postExpense(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestingUser) {
    const result = await this.postingService.postExpenseToGL(id, user);
    return {
      success: true,
      message: result.isReplay ? 'Expense already posted to GL (idempotent replay)' : 'Expense posted to GL successfully',
      data: result.expense,
      journal: result.journal,
    };
  }

  @Post(':id/cancel')
  @RequirePermissions('finance:expense:cancel')
  @ApiOperation({ summary: 'Cancel an unposted expense or reverse a posted expense in GL' })
  async cancelExpense(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelExpenseDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const expense = await this.expenseService.getExpenseById(id, user);
    if (expense.status === 'POSTED') {
      const result = await this.postingService.reverseExpenseGL(id, dto.reason, user);
      return {
        success: true,
        message: 'Posted expense reversed in GL and marked cancelled',
        data: result.expense,
        reversalJournal: result.reversalJournal,
      };
    } else {
      const data = await this.expenseService.cancelUnpostedExpense(id, dto.reason, user);
      return {
        success: true,
        message: 'Expense cancelled successfully',
        data,
      };
    }
  }
}
