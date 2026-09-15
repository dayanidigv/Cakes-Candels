import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { AccountController } from './controllers/account.controller';
import { AccountService } from './services/account.service';
import { FiscalCalendarController } from './controllers/fiscal-calendar.controller';
import { FiscalCalendarService } from './services/fiscal-calendar.service';
import { JournalController } from './controllers/journal.controller';
import { JournalService } from './services/journal.service';
import { FinancePostingEngine } from './services/posting-engine.service';
import { ExpenseController } from './controllers/expense.controller';
import { ExpenseCategoryController } from './controllers/expense-category.controller';
import { ExpenseService } from './services/expense.service';
import { ExpensePostingService } from './services/expense-posting.service';

@Module({
  imports: [IdentityModule],
  controllers: [
    FinanceController,
    AccountController,
    FiscalCalendarController,
    JournalController,
    ExpenseController,
    ExpenseCategoryController,
  ],
  providers: [
    FinanceService,
    AccountService,
    FiscalCalendarService,
    JournalService,
    FinancePostingEngine,
    ExpenseService,
    ExpensePostingService,
  ],
  exports: [
    FinanceService,
    AccountService,
    FiscalCalendarService,
    JournalService,
    FinancePostingEngine,
    ExpenseService,
    ExpensePostingService,
  ],
})
export class FinanceModule {}
