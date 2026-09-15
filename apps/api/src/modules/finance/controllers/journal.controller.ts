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
import { FinancePostingEngine, RequestingUser } from '../services/posting-engine.service';
import { JournalService } from '../services/journal.service';
import { PostJournalCommandDto } from '../dto/post-journal.dto';
import { ReverseJournalDto } from '../dto/reverse-journal.dto';
import { QueryJournalDto } from '../dto/query-journal.dto';
import { QueryLedgerDto } from '../dto/query-ledger.dto';

@ApiTags('Finance — General Ledger & Journal Entries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BranchScopeGuard, PermissionsGuard)
@Controller('finance')
export class JournalController {
  constructor(
    private readonly postingEngine: FinancePostingEngine,
    private readonly journalService: JournalService,
  ) {}

  @Post('journals/post')
  @RequirePermissions('finance:journal:post')
  @ApiOperation({ summary: 'Post a balanced double-entry journal entry' })
  async postJournal(@Body() dto: PostJournalCommandDto, @CurrentUser() user: RequestingUser) {
    const result = await this.postingEngine.post(dto, user);
    return {
      success: true,
      message: result.isReplay ? 'Journal already posted (idempotent replay)' : 'Journal posted successfully',
      data: result.journal,
    };
  }

  @Get('journals')
  @RequirePermissions('finance:journal:read')
  @ApiOperation({ summary: 'Query and list paginated journal entries' })
  async listJournals(@Query() query: QueryJournalDto, @CurrentUser() user: RequestingUser) {
    const data = await this.journalService.listJournals(user, query);
    return { success: true, ...data };
  }

  @Get('journals/:id')
  @RequirePermissions('finance:journal:read')
  @ApiOperation({ summary: 'Get journal entry details by ID' })
  async getJournalById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestingUser) {
    const data = await this.journalService.getJournalById(id, user);
    return { success: true, data };
  }

  @Post('journals/:id/reverse')
  @RequirePermissions('finance:journal:reverse')
  @ApiOperation({ summary: 'Reverse a posted journal entry' })
  async reverseJournal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReverseJournalDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.journalService.reverseJournal(id, dto, user);
    return { success: true, message: 'Journal reversed successfully', data };
  }

  @Get('accounts/:id/ledger')
  @RequirePermissions('finance:coa:read')
  @ApiOperation({ summary: 'Get General Ledger account drill-down with running balance' })
  async getAccountLedger(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryLedgerDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.journalService.getAccountLedger(id, user, query);
    return { success: true, data };
  }
}
