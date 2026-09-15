import { apiRequest } from './api';

export type ExpenseStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'POSTED'
  | 'REJECTED'
  | 'CANCELLED';

export type ExpensePaymentType =
  | 'CASH'
  | 'BANK_TRANSFER'
  | 'UPI'
  | 'CREDIT';

export type TaxType =
  | 'NONE'
  | 'GST_5'
  | 'GST_12'
  | 'GST_18'
  | 'GST_28';

export interface ExpenseAccount {
  id: string;
  code: string;
  name: string;
  type?: string;
  category?: string;
  isPostable?: boolean;
}

export interface ExpenseSupplier {
  id: string;
  code: string;
  name: string;
  gst?: string;
  phone?: string;
}

export interface ExpenseBranch {
  id: string;
  name: string;
  type?: string;
}

export interface JournalEntryLine {
  id: string;
  accountId: string;
  account?: ExpenseAccount;
  description?: string;
  debit: number | string;
  credit: number | string;
  branchId?: string;
  branch?: ExpenseBranch;
}

export interface JournalEntry {
  id: string;
  journalNumber: string;
  postingDate: string;
  sourceType: string;
  sourceId?: string;
  branchId: string;
  branch?: ExpenseBranch;
  status: string;
  lines: JournalEntryLine[];
}

export interface Expense {
  id: string;
  organizationId: string;
  branchId: string;
  branch?: ExpenseBranch;
  expenseNumber: string;
  expenseDate: string;
  description: string;
  supplierId?: string | null;
  supplier?: ExpenseSupplier | null;
  invoiceNumber?: string | null;
  categoryId?: string | null;
  baseAmount: number | string;
  taxType: TaxType;
  taxAmount: number | string;
  totalAmount: number | string;
  paymentType: ExpensePaymentType;
  expenseAccountId: string;
  expenseAccount?: ExpenseAccount;
  paymentAccountId: string;
  paymentAccount?: ExpenseAccount;
  status: ExpenseStatus;
  createdById: string;
  createdBy?: { id: string; name: string };
  submittedById?: string | null;
  submittedAt?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  postedAt?: string | null;
  journalEntryId?: string | null;
  journalEntry?: JournalEntry | null;
  reversalJournalId?: string | null;
  reversalReason?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseCategoryMapping {
  id: string;
  categoryName: string;
  expenseAccountId: string;
  expenseAccount?: ExpenseAccount;
  defaultTaxType: TaxType;
}

export interface CreateExpenseDto {
  expenseDate: string;
  branchId: string;
  description: string;
  supplierId?: string;
  invoiceNumber?: string;
  categoryId?: string;
  baseAmount: number;
  taxType: TaxType;
  paymentType: ExpensePaymentType;
  expenseAccountId: string;
  paymentAccountId: string;
  notes?: string;
}

export interface QueryExpenseDto {
  page?: number;
  limit?: number;
  status?: ExpenseStatus;
  branchId?: string;
  supplierId?: string;
  categoryId?: string;
  paymentType?: ExpensePaymentType;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface PaginatedExpenseResult {
  items: Expense[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const expenseApi = {
  getExpenses: async (query: QueryExpenseDto = {}): Promise<PaginatedExpenseResult> => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.status) params.set('status', query.status);
    if (query.branchId) params.set('branchId', query.branchId);
    if (query.supplierId) params.set('supplierId', query.supplierId);
    if (query.categoryId) params.set('categoryId', query.categoryId);
    if (query.paymentType) params.set('paymentType', query.paymentType);
    if (query.startDate) params.set('startDate', query.startDate);
    if (query.endDate) params.set('endDate', query.endDate);
    if (query.search) params.set('search', query.search);

    const queryString = params.toString();
    const endpoint = `/finance/expenses${queryString ? `?${queryString}` : ''}`;
    
    // apiRequest unwraps data.data. For paginated endpoints, response contains { items, meta }
    const res = await apiRequest(endpoint);
    if (Array.isArray(res)) {
      return {
        items: res,
        meta: { total: res.length, page: 1, limit: res.length || 20, totalPages: 1 },
      };
    }
    return res;
  },

  getExpenseSummary: async (branchId?: string): Promise<Record<ExpenseStatus, number>> => {
    const endpoint = `/finance/expenses/summary${branchId ? `?branchId=${branchId}` : ''}`;
    return await apiRequest(endpoint);
  },

  getExpenseById: async (id: string): Promise<Expense> => {
    return await apiRequest(`/finance/expenses/${id}`);
  },

  createExpense: async (dto: CreateExpenseDto): Promise<Expense> => {
    return await apiRequest('/finance/expenses', 'POST', dto);
  },

  submitExpense: async (id: string): Promise<Expense> => {
    return await apiRequest(`/finance/expenses/${id}/submit`, 'POST');
  },

  approveExpense: async (id: string): Promise<Expense> => {
    return await apiRequest(`/finance/expenses/${id}/approve`, 'POST');
  },

  rejectExpense: async (id: string, reason: string): Promise<Expense> => {
    return await apiRequest(`/finance/expenses/${id}/reject`, 'POST', { reason });
  },

  postExpense: async (id: string): Promise<{ expense: Expense; journal: JournalEntry }> => {
    const res = await apiRequest(`/finance/expenses/${id}/post`, 'POST');
    return res;
  },

  cancelExpense: async (id: string, reason: string): Promise<{ expense: Expense; reversalJournal?: JournalEntry }> => {
    return await apiRequest(`/finance/expenses/${id}/cancel`, 'POST', { reason });
  },

  getCategoryMappings: async (): Promise<ExpenseCategoryMapping[]> => {
    return await apiRequest('/finance/expense-categories');
  },

  getAccounts: async (): Promise<ExpenseAccount[]> => {
    try {
      const accounts = await apiRequest('/finance/accounts');
      return Array.isArray(accounts) ? accounts : accounts?.items || [];
    } catch (error) {
      // Fallback accounts are provided only when the real /finance/accounts endpoint fails.
      // This should not be used in production; it is a safety net for development environments.
      // Emit a warning to aid debugging and to avoid silent reliance on mock data.
      console.warn('Expense API fallback activated: using hard‑coded account list due to error:', error);
      return [
        { id: '10000000-0000-0000-0000-000000000001', code: '5001', name: 'Electricity Expense', type: 'EXPENSE', isPostable: true },
        { id: '10000000-0000-0000-0000-000000000002', code: '5002', name: 'Rent Expense', type: 'EXPENSE', isPostable: true },
        { id: '10000000-0000-0000-0000-000000000003', code: '5003', name: 'Diesel & Fuel Expense', type: 'EXPENSE', isPostable: true },
        { id: '10000000-0000-0000-0000-000000000004', code: '5004', name: 'Office Maintenance', type: 'EXPENSE', isPostable: true },
        { id: '10000000-0000-0000-0000-000000000005', code: '1001', name: 'Cash in Hand', type: 'ASSET', isPostable: true },
        { id: '10000000-0000-0000-0000-000000000006', code: '1002', name: 'HDFC Operating Bank Account', type: 'ASSET', isPostable: true },
        { id: '10000000-0000-0000-0000-000000000007', code: '2001', name: 'Accounts Payable / Supplier Credit', type: 'LIABILITY', isPostable: true },
      ];
    }
  },
};
