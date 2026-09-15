# SPRINT 12.4 — ARCHITECTURE & ACCOUNTING CONTRACT DISCOVERY REPORT
**Expenses Subledger & Centralized General Ledger Integration**

**Date:** 2026-09-03  
**Status:** 🟡 **ARCHITECTURE FROZEN — AWAITING PHASE 12.4.2 DATABASE AUTHORIZATION**

---

## 1. Architecture Discovery Summary

This report establishes the architectural contract for Phase 12.4: **Expenses Subledger & Accounting Integration**.

### Key Architectural Invariants Frozen:
1. **Single Source of Financial Truth**:
   The Expense domain does not maintain a shadow or separate ledger. It records operational details (vendor bills, receipts, approvals, line items) and posts double-entry accounting transactions exclusively to `JournalEntry` and `JournalEntryLine` via the centralized `FinancePostingEngine`.
2. **Deterministic Double-Entry Posting**:
   - **Debit**: Operational Expense Account (`5xxxx`, `normalBalance = DEBIT`)
   - **Debit (Optional)**: Input GST Receivable (`115xx`, `normalBalance = DEBIT`)
   - **Credit**: Payment/Payable Account (`Cash/Bank 11xxx` or `Accounts Payable 21xxx`)
   - **Balance Invariant**: $\sum \text{Debit} = \text{Base} + \text{Tax} = \text{Total} = \sum \text{Credit}$.
3. **Fiscal Period Synchronization**:
   The GL posting period is deterministically derived from `expenseDate` and validated to be strictly `OPEN`.
4. **COA Leaf Account Enforcement**:
   Both the expense account and payment account must be `isActive: true` and `isPostable: true` leaf accounts belonging to the same tenant organization.
5. **Non-Destructive Reversals**:
   Cancellation of a posted expense invokes `JournalService.reverseJournal()`, producing an exact counter-journal with inverted debit/credit lines.
6. **Multi-Dimensional Scope**:
   Expenses and their corresponding `JournalEntryLine` records capture `branchId` for branch-level profit/loss drill-down.

---

## 2. Specification Documents Inventory

The following authoritative specification documents have been created and placed under `docs/sprint12/`:

1. [`EXPENSE_DOMAIN_MODEL.md`](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/docs/sprint12/EXPENSE_DOMAIN_MODEL.md): Complete data model, field definitions, enums, and foreign key relations.
2. [`EXPENSE_STATE_MACHINES.md`](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/docs/sprint12/EXPENSE_STATE_MACHINES.md): Deterministic state transitions (`DRAFT` $\to$ `SUBMITTED` $\to$ `APPROVED` $\to$ `POSTED` / `CANCELLED`) with guard rules.
3. [`EXPENSE_ACCOUNTING_RULES.md`](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/docs/sprint12/EXPENSE_ACCOUNTING_RULES.md): Accounting principles, GST tax handling, posting commands, and reversal entries.
4. [`EXPENSE_RBAC_MATRIX.md`](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/docs/sprint12/EXPENSE_RBAC_MATRIX.md): Permissions taxonomy, branch scope boundaries, and role assignments.
5. [`EXPENSE_EVENT_CATALOG.md`](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/docs/sprint12/EXPENSE_EVENT_CATALOG.md): Outbox events schema (`finance.expense.*`).
6. [`EXPENSE_TEST_STRATEGY.md`](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/docs/sprint12/EXPENSE_TEST_STRATEGY.md): Comprehensive test suite plan with 100-thread concurrency gates.
7. [`SPRINT_12_4_PHASE_PLAN.md`](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/docs/sprint12/SPRINT_12_4_PHASE_PLAN.md): Step-by-step implementation milestones.

---

## 3. Strict Phase Boundary Confirmation

- **Schema Changes**: Zero (0) modifications made to `packages/database/prisma/schema.prisma`.
- **Database Migrations**: Zero (0) migrations executed.
- **Production Code**: Zero (0) modifications made to API controllers/services.
- **Current Monorepo Status**: Clean, green (53/53 test suites, 225/225 tests passing).

---

## 4. Authorization Request

Awaiting your gate review and authorization to begin **Phase 12.4.2: Prisma Schema & Database Migration**.
