# 🧪 FINANCE TEST STRATEGY & SUITE SPECIFICATION
## Adversarial Testing, Accounting Invariants & Quality Gates

> **Sprint**: Sprint 12 — Finance & Accounting  
> **Status**: FROZEN (Phase 12.1)  
> **Classification**: Quality Assurance & Testing Contract  

---

## 1. Testing Pyramid & Mandatory Test Dimensions

```text
               ┌────────────────────────┐
               │    ACCOUNTING E2E      │  Trial Balance, P&L, BS Reconciled
               ├────────────────────────┤
               │   CONCURRENCY (100x)   │  CAS, Replay, Idempotency Locks
               ├────────────────────────┤
               │  SECURITY & MULTI-TEN  │  Tenant & Branch Scope Isolation
               ├────────────────────────┤
               │ INTEGRATION / OUTBOX   │  Atomic Journal Posting & Audit
               ├────────────────────────┤
               │  UNIT / ARITHMETIC     │  COA Tree, Debit=Credit Math
               └────────────────────────┘
```

---

## 2. Dedicated Test Suite Specifications

### 2.1 Suite 1: Chart of Accounts & Normal Balance Specification
- **File**: `apps/api/src/modules/finance/__tests__/coa-validation.spec.ts`
- **Tests**:
  1. Enforce unique account codes per organization.
  2. Forbid direct journal postings to summary parent accounts (`isPostable = false`).
  3. Verify mathematical normal balance behavior (Assets/Expenses increase on Debit; Liabilities/Equity/Revenue increase on Credit).
  4. Block deletion or code modification of system-protected accounts (`isSystem = true`).

### 2.2 Suite 2: Fiscal Calendar & Period Lock Specification
- **File**: `apps/api/src/modules/finance/__tests__/fiscal-period-lock.spec.ts`
- **Tests**:
  1. Auto-resolve correct `FiscalPeriod` based on `postingDate`.
  2. Reject any manual or automated journal posting into a `CLOSED` or `LOCKED` fiscal period.
  3. Verify that reopening a closed period requires `finance:period:reopen` and produces an `AuditLog`.

### 2.3 Suite 3: Double-Entry Posting Engine & Mathematical Invariants
- **File**: `apps/api/src/modules/finance/__tests__/posting-engine-invariants.spec.ts`
- **Tests**:
  1. Reject unbalanced journal entries ($\sum \text{Debits} \neq \sum \text{Credits}$) with `400 Bad Request`.
  2. Reject zero-amount or negative-amount journal entry lines.
  3. Verify atomic single-transaction guarantee: if any line fails, zero database rows are committed.
  4. Verify transactional emission of `finance.journal.posted` in `OutboxEvent` and creation of `AuditLog`.

### 2.4 Suite 4: 100-Thread Concurrency & Idempotency Suite
- **File**: `apps/api/src/modules/finance/__tests__/finance-concurrency.spec.ts`
- **Tests**:
  1. **100 Concurrent Automated Postings**: Fire 100 simultaneous posting requests from the same operational event (`sourceModule` + `sourceEntityId`). Verify **exactly 1 General Ledger entry is created**; 99 return existing or are safely deduped.
  2. **100 Concurrent Period Closing Requests**: Fire 100 concurrent requests to close the same period. Verify exactly 1 CAS transition to `CLOSED`.

### 2.5 Suite 5: Operational Domain Integration Suite
- **File**: `apps/api/src/modules/finance/__tests__/operational-subledgers.spec.ts`
- **Tests**:
  1. **Payroll Integration**: Verify Sprint 11 payroll posting accrues $\text{Dr. Salary Expense}$, $\text{Cr. Statutory Payables}$, $\text{Cr. Payroll Payable}$ without touching Cash/Bank.
  2. **Procurement 3-Way Match**: Verify PO $\to$ GRN $\to$ Supplier Bill $\to$ Payment posting ledger lifecycle.
  3. **Sales & POS Settlement**: Verify order confirmation $\to$ payment capture $\to$ register variance accounting.

### 2.6 Suite 6: Multi-Tenant & RBAC Isolation Suite
- **File**: `apps/api/src/modules/finance/__tests__/finance-security.spec.ts`
- **Tests**:
  1. Block cross-tenant access (`orgA` cannot read or post to `orgB` accounts or journals).
  2. Enforce `BRANCH` manager scope (restricted to branch-attributed expenses and reports).
  3. Reject unauthorized attempts to post journals or reopen periods without requisite permissions.

### 2.7 Suite 7: Financial Statements & Reporting Reconciliation Suite
- **File**: `apps/api/src/modules/finance/__tests__/financial-reporting.spec.ts`
- **Tests**:
  1. Verify Trial Balance: $\sum \text{All Debit Balances} \equiv \sum \text{All Credit Balances}$.
  2. Verify Balance Sheet: $\text{Total Assets} \equiv \text{Total Liabilities} + \text{Total Equity}$.
  3. Verify Profit & Loss: $\text{Net Income} = \text{Total Revenue} - \text{Total Expenses}$.
  4. Verify Branch P&L filters accurately by `branchId` without leakage.
