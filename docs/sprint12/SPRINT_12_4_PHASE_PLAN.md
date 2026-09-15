# SPRINT 12.4 — EXPENSE SUBLEDGER PHASE EXECUTION PLAN

## 1. Phase Breakdown & Execution Sequence

```
Phase 12.4.1: Architecture & Accounting Contract (Current Phase)
      │
      ▼ (Pending Review & Gate Authorization)
Phase 12.4.2: Prisma Schema & Database Migration
      │   - Add ExpenseStatus, ExpensePaymentType, TaxType enums
      │   - Add model Expense, model ExpenseCategoryMapping
      │   - Add relations on Organization, Branch, Account, JournalEntry
      │   - Generate & execute Prisma migration
      ▼
Phase 12.4.3: Core Services & Double-Entry Posting Integration
      │   - Implement ExpenseService (CRUD, Submit, Approve, Reject)
      │   - Implement ExpensePostingService (integration with FinancePostingEngine)
      │   - Implement Reversal & Cancellation handlers
      ▼
Phase 12.4.4: Controllers, DTOs & Scope Security
      │   - Create ExpenseController, ExpenseCategoryController
      │   - Apply JwtAuthGuard, BranchScopeGuard, PermissionsGuard
      ▼
Phase 12.4.5: Test Implementation & 100-Thread Concurrency Verification
      │   - Lifecycle, GL Posting, Reversal, Concurrency, RBAC suites
      ▼
Phase 12.4.6: Production Certification & Final Monorepo Audit
```

---

## 2. Gate Criteria for Phase 12.4.2 Authorization

To authorize Phase 12.4.2 database implementation, the following architectural invariants must be accepted:
1. **Single General Ledger**: `Expense` is purely an operational subledger entity and links 1-to-1 with `JournalEntry`.
2. **Centralized Posting Engine**: All accounting entries are routed through `FinancePostingEngine`.
3. **Double-Entry Tax Treatment**: Input GST accounts are configured dynamically in the Chart of Accounts.
4. **Non-Destructive Reversals**: Posted expense cancellation creates a counter-journal and marks original GL entries `REVERSED`.
5. **No Production Code in Phase 12.4.1**: Architecture specification must be frozen first.
