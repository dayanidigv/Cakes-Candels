# SPRINT 12.4 — EXPENSE TEST STRATEGY & SUITE PLAN

## 1. Quality & Certification Objectives

The Expense Subledger test suite must prove:
1. Complete lifecycle transitions and state guards (`DRAFT` $\to$ `SUBMITTED` $\to$ `APPROVED` $\to$ `POSTED`).
2. Exact double-entry balancing ($\sum \text{Debit} = \sum \text{Credit}$) when posting through `FinancePostingEngine`.
3. Strict fiscal period resolution from `expenseDate` and rejection on closed/locked periods.
4. Active, postable leaf account enforcement for both expense and payment/payable accounts.
5. 100-thread concurrency safety for duplicate posting attempts and independent parallel submissions.
6. Non-destructive counter-journal reversal when cancelling a posted expense.
7. Role-Based Access Control and Branch Scope isolation.
8. Zero regressions across the existing 53 test suites.

---

## 2. Planned Test Suites

### Suite 1: `expense-lifecycle.spec.ts`
- Create draft expense with valid accounts and positive amounts.
- Reject negative amounts and invalid account types.
- Transition `DRAFT` $\to$ `SUBMITTED` $\to$ `APPROVED` $\to$ `REJECTED` $\to$ `CANCELLED`.
- Guard against direct `DRAFT` $\to$ `POSTED` transition without approval.
- Enforce rejection memo requirement on `reject()`.

### Suite 2: `expense-gl-posting.spec.ts`
- Post approved expense without GST $\to$ Verify 2-line balanced `JournalEntry`.
- Post approved expense with GST $\to$ Verify 3-line balanced `JournalEntry` (Expense, Input Tax, Bank/Cash).
- Post approved vendor expense on credit $\to$ Verify Accounts Payable credit.
- Verify `expense.journalEntryId` is populated and `expense.status === 'POSTED'`.
- Verify `POSTED` expense fields are immutable.
- Reject posting when `expenseDate` falls into a `CLOSED` or `LOCKED` fiscal period.
- Reject posting when `expenseAccountId` is a summary/parent account.

### Suite 3: `expense-reversal.spec.ts`
- Cancel posted expense $\to$ Verify reversing counter-journal created with inverted debits/credits.
- Verify original `JournalEntry.status === 'REVERSED'` and cross-linked via `reversalEntryId`.
- Verify `expense.status === 'CANCELLED'`.
- Reject double-reversal attempts.

### Suite 4: `expense-concurrency.spec.ts`
- **Gate 1**: 100 concurrent `postToGL()` attempts on the same approved expense $\to$ Exactly 1 GL posting succeeds; 99 return idempotent replay.
- **Gate 2**: 100 concurrent independent expense submissions and postings $\to$ All 100 succeed cleanly without numbering collisions or deadlock.

### Suite 5: `expense-rbac-isolation.spec.ts`
- `STORE_MANAGER` can only create and view expenses for their assigned `branchId`.
- Attempt by `STORE_MANAGER` to post for another branch $\to$ `403 Forbidden`.
- `FINANCE_MANAGER` (`GLOBAL` scope) can review and post expenses across all branches.
- Multi-tenant boundary isolation $\to$ Cross-tenant expense access returns `404/403`.
