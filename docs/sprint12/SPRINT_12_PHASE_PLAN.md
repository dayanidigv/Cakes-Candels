# 🗺️ SPRINT 12 — IMPLEMENTATION PHASE ROADMAP
## Modular Implementation, Gates, and Quality Milestones

> **Sprint**: Sprint 12 — Finance & Accounting  
> **Status**: FROZEN (Phase 12.1)  
> **Classification**: Project Execution Plan  

---

## 1. Phase Overview & Implementation Sequence

```text
SPRINT 12
│
├── 12.1 Architecture Contract                 ✅ CURRENT (DOCS ONLY)
│
├── 12.2 Chart of Accounts & Fiscal Periods    ← NEXT
│
├── 12.3 General Ledger & Posting Engine
│
├── 12.4 Operational Expense Accounting
│
├── 12.5 Accounts Payable & 3-Way Matching
│
├── 12.6 Accounts Receivable & Sales/POS
│
├── 12.7 Tax & GST Accounting
│
├── 12.8 Inventory & Valuation Accounting
│
├── 12.9 Bank & Register Reconciliation
│
├── 12.10 Financial Reporting & Statements
│
└── 12.11 Final Production Certification
```

---

## 2. Detailed Phase Breakdowns

### Phase 12.1: Architecture Contract & Foundation (Current)
- **Objective**: Establish authoritative architecture contract, domain model, state machines, RBAC, events, and test strategy. Zero code/schema modifications.
- **Scope**: Documentation and specifications only.
- **Gate**: Phase 12.1 report acceptance.

---

### Phase 12.2: Chart of Accounts & Fiscal Periods
- **Objective**: Implement database schema, seeding, and management APIs for hierarchical COA and Fiscal Periods.
- **Scope**:
  - `Account`, `FiscalYear`, `FiscalPeriod` Prisma models & migration.
  - Standard bakery COA seed script.
  - CRUD & hierarchy resolution services.
  - Period opening, closing, and locking state machine.
- **Tests**: `coa-validation.spec.ts`, `fiscal-period-lock.spec.ts`.
- **Gate**: Full tenant isolation, hierarchy validation, and period lock tests green.

---

### Phase 12.3: General Ledger & Double-Entry Posting Engine
- **Objective**: Implement the central `FinancePostingEngine`, `JournalEntry`, and `JournalEntryLine`.
- **Scope**:
  - `JournalEntry` and `JournalEntryLine` Prisma models & migration.
  - Atomic posting engine with 10-point mathematical and period validation.
  - Idempotency CAS locks & `org_source_unique` constraint.
  - Reversal and replacement state machine.
  - Transactional Outbox & AuditLog integration.
- **Tests**: `posting-engine-invariants.spec.ts`, `finance-concurrency.spec.ts`.
- **Gate**: Unbalanced entries rejected, 100 concurrent postings produce exactly 1 journal entry.

---

### Phase 12.4: Operational Expense Accounting
- **Objective**: Formalize the `Expense` entity with automated GL journal posting.
- **Scope**:
  - `Expense` model & migration.
  - Configurable Expense Category $\to$ COA Account mapping.
  - Multi-status workflow (`DRAFT` $\to$ `SUBMITTED` $\to$ `APPROVED` $\to$ `POSTED`).
  - Seamless backward compatibility with `/finance/expenses` REST API and `Expenses.tsx` UI.
- **Tests**: Expense lifecycle tests, backward compatibility tests.
- **Gate**: Expense creation automatically posts balanced GL entries without breaking existing frontend.

---

### Phase 12.5: Accounts Payable & 3-Way Matching
- **Objective**: Implement Accounts Payable subledger with PO + GRN 3-way matching and payment vouchers.
- **Scope**:
  - `SupplierBill` and `SupplierPayment` Prisma models & migration.
  - Automated 3-way match verification against `PurchaseOrder` and `GoodsReceiptNote`.
  - Automatic GL posting: GRN clearing, Input GST, Accounts Payable, and Bank payment.
  - Update `/finance/supplier-ledger` to read reconciled AP balances.
- **Tests**: 3-way matching validation, AP aging, payment settlement tests.
- **Gate**: Complete procurement-to-payment financial flow verified.

---

### Phase 12.6: Accounts Receivable & Sales/POS Accounting
- **Objective**: Implement revenue recognition and AR settlement for Web, POS, and Custom Cake orders.
- **Scope**:
  - Automated GL posting on Sales Order confirmation, Payment capture, and Refunds.
  - Channel-specific accounting (Web Gateway Clearing vs POS Cash/Bank).
  - Customer return reversal accounting.
- **Tests**: Sales posting tests, refund reversal tests.
- **Gate**: $\text{Revenue} + \text{Tax} \equiv \text{Cash/AR Received}$.

---

### Phase 12.7: Tax & GST Accounting
- **Objective**: Implement data-driven Input/Output tax recording and GST summary reporting.
- **Scope**:
  - Integration with existing `TaxRule` and `TaxComponent`.
  - Dedicated GL posting to Input CGST/SGST/IGST and Output CGST/SGST/IGST.
  - GST Return preparation summary (GSTR-1, GSTR-3B audit ready).
- **Tests**: Tax calculation & tax ledger balance tests.
- **Gate**: Tax accounts strictly balance with sales and purchase invoices.

---

### Phase 12.8: Inventory & Valuation Accounting
- **Objective**: Financial valuation hooks for inventory receipts, consumption, yield, and wastage.
- **Scope**:
  - Raw material consumption to WIP, Finished goods yield valuation.
  - Wastage loss expense GL posting.
  - Inventory valuation reconciliation against physical `StockBalance`.
- **Tests**: Valuation reconciliation tests.
- **Gate**: Physical inventory and GL inventory asset accounts remain synchronized.

---

### Phase 12.9: Bank & Register Reconciliation
- **Objective**: Formalize POS cash register closing and bank statement reconciliation.
- **Scope**:
  - Automated GL journal posting upon `POSRegister` closing.
  - Explicit cash shortage/overage variance accounting.
  - Bank transaction matching.
- **Tests**: Register settlement & variance accounting tests.
- **Gate**: Zero unallocated cash variances; all register closings posted to GL.

---

### Phase 12.10: Financial Reporting & Statements
- **Objective**: Implement authoritative financial statement generation engine.
- **Scope**:
  - Trial Balance ($\sum \text{Debits} \equiv \sum \text{Credits}$).
  - Profit & Loss Statement (Organization & Branch-scoped).
  - Balance Sheet ($\text{Assets} \equiv \text{Liabilities} + \text{Equity}$).
  - Cash Flow Statement.
  - General Ledger and Account Ledger drill-down reports.
- **Tests**: `financial-reporting.spec.ts`.
- **Gate**: 100% mathematical reconciliation across all statements.

---

### Phase 12.11: Final Production Certification & End-to-End Audit
- **Objective**: Adversarial audit across all 11 Finance phases, full regression test suite, and final sign-off.
- **Scope**: End-to-end multi-tenant, concurrency, security, and immutability audit.
- **Gate**: Final PASS certification.
