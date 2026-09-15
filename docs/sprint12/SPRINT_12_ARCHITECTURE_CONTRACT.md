# 📜 SPRINT 12 — ARCHITECTURE CONTRACT
## Finance & Double-Entry Accounting Domain Contract

> **Sprint**: Sprint 12 — Finance & Accounting  
> **Status**: **FROZEN & AUTHORITATIVE (Phase 12.1)**  
> **Date**: 2026-09-03  
> **Classification**: Core Financial Architecture Specification  

---

## 1. Architectural Scope & Absolute Boundaries
This contract defines the authoritative architecture for the **Finance & Double-Entry Accounting Domain** across Cakes & Candles ERP.

### Mandatory Rules:
1. **Single Financial Source of Truth**: `JournalEntry` and `JournalEntryLine` constitute the sole, authoritative financial General Ledger (GL) of the ERP. No operational domain (Sales, Procurement, Inventory, POS, Payroll, Expenses) may maintain a competing financial ledger.
2. **Double-Entry Mathematical Invariant**:
   $$\sum_{i=1}^{n} \text{DebitAmount}_i \equiv \sum_{i=1}^{n} \text{CreditAmount}_i \quad (\Delta = 0.00)$$
   Any unbalanced transaction MUST be rejected atomically at the posting engine boundary.
3. **Immutability of Posted Financial Data**:
   - Records with status `POSTED` are permanently immutable.
   - `UPDATE` or `DELETE` on posted journal entries or journal lines is strictly forbidden.
   - Financial corrections must occur exclusively through explicit **Reversal Journals** (`REVERSED`) followed by **Corrected Journals**.
4. **Strict Period Locking**: Transactions cannot post into closed fiscal periods. Period reopening requires high-privilege audit authorization.
5. **Organization Tenancy & Branch Attribution**:
   - Chart of Accounts and Fiscal Calendar are organization-scoped (`organizationId`).
   - Journal lines are branch-attributed (`branchId`) to enable localized Branch P&L and factory cost accounting without duplicating the Chart of Accounts.

---

## 2. General Ledger Model & Subledger Relationship

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                          OPERATIONAL SUBLEDGERS                         │
├──────────────┬──────────────┬──────────────┬──────────────┬─────────────┤
│ Procurement  │    Sales     │   Payroll    │  Inventory   │     POS     │
│   (GRN/PO)   │ (Order/Pay)  │(Run/Summary) │ (Wastage/Adj)│  (Register) │
└───────┬──────┴──────┬───────┴──────┬───────┴──────┬───────┴──────┬──────┘
        │             │              │              │              │
        ▼             ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    CENTRAL FINANCE POSTING ENGINE                       │
│  • Validation  • Period Check  • Balance Check  • CAS & Idempotency     │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     AUTHORITATIVE GENERAL LEDGER                        │
│               JournalEntry (1) ───< JournalEntryLine (N)                │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    FINANCIAL STATEMENTS & REPORTING                     │
│    Trial Balance │ Profit & Loss │ Balance Sheet │ Cash Flow │ Taxes    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Ledger vs. Subledger Classification:
- **General Ledger (`JournalEntry` + `JournalEntryLine`)**: Authoritative, double-entry financial record.
- **Operational Subledgers (`SupplierBill`, `Payment`, `Expense`, `POSRegister`)**: Business-level documents that reference operational entities and generate GL journal entries upon approval/posting.
- **Legacy Compatibility**: Any legacy transaction logging is strictly classified as an operational audit projection and is superseded by the General Ledger.

---

## 3. Chart of Accounts (COA) Architecture
The Chart of Accounts is a multi-level tree scoped to the `Organization`.

### 3.1 Five Accounting Classes & Normal Balances:
1. **`ASSET`** (Normal Balance: `DEBIT`, Code Prefix: `1xxx`)
2. **`LIABILITY`** (Normal Balance: `CREDIT`, Code Prefix: `2xxx`)
3. **`EQUITY`** (Normal Balance: `CREDIT`, Code Prefix: `3xxx`)
4. **`REVENUE`** (Normal Balance: `CREDIT`, Code Prefix: `4xxx`)
5. **`EXPENSE`** (Normal Balance: `DEBIT`, Code Prefix: `5xxx`)

### 3.2 Postable Leaf vs. Summary Parent Rules:
- Only **Leaf Accounts** (`isPostable = true`, `hasChildren = false`) can accept journal entry lines.
- **Parent Accounts** serve purely as summary aggregators in the hierarchy for financial statement rollups.
- System accounts (`isSystem = true`) are protected against deletion or renaming to ensure core automated posting integrity.

---

## 4. End-to-End Operational Accounting Flows

### 4.1 Payroll Posting & Disbursement Boundary (Sprint 11 Contract Protection)
```text
Payroll APPROVED (Sprint 11)
       │
       ▼
Finance Posting Engine
       │
       ├── Dr. 51000 - Salary Expense (Gross Pay)
       ├── Cr. 21100 - Statutory PF / ESI / PT Payables (Total Deductions)
       └── Cr. 21200 - Employee Payroll Payable (Net Take-Home Pay)
       │
       ▼
Payroll Run marked POSTED (financeExpenseId assigned)

[Later Event: Actual Bank Salary Disbursement]
       │
       ├── Dr. 21200 - Employee Payroll Payable
       └── Cr. 11200 - Bank Account (Main Operating)
```
> [!IMPORTANT]
> Payroll posting MUST NOT credit Bank/Cash. Accruing payroll expense and disbursing salary via bank transfer are distinct events.

### 4.2 Procurement & Accounts Payable (3-Way Matching)
1. **Goods Receipt Note (GRN Received)**:
   - $\text{Dr. 13100 - Raw Materials Inventory Asset}$
   - $\text{Cr. 21300 - GRN Clearing / Unbilled Payables}$
2. **Supplier Bill (Verified & Matched against PO + GRN)**:
   - $\text{Dr. 21300 - GRN Clearing / Unbilled Payables}$
   - $\text{Dr. 14100 - Input GST Tax Credit}$
   - $\text{Cr. 21000 - Accounts Payable (Supplier)}$
3. **Supplier Payment (Payment Voucher Dispatched)**:
   - $\text{Dr. 21000 - Accounts Payable (Supplier)}$
   - $\text{Cr. 11200 - Bank Account / Cash}$

### 4.3 Sales & Accounts Receivable (Channels: Web, POS, Custom)
1. **Order Placed / POS Sale Confirmed**:
   - $\text{Dr. 11300 - Payment Gateway Clearing / Accounts Receivable}$
   - $\text{Cr. 41000 - Sales Revenue (Retail / Custom Cakes)}$
   - $\text{Cr. 22100 - Output GST Liability}$
2. **Gateway Settlement / POS Register Closing**:
   - $\text{Dr. 11100 - Bank Account / POS Till Cash}$
   - $\text{Cr. 11300 - Payment Gateway Clearing / Accounts Receivable}$
3. **Customer Return & Refund**:
   - $\text{Dr. 41900 - Sales Returns & Allowances}$
   - $\text{Dr. 22100 - Output GST Liability (Reversal)}$
   - $\text{Cr. 11100 - Cash / Bank / Refund Payable}$

### 4.4 Inventory Valuation & Wastage
- **Physical Movements**: Retained in `InventoryTransaction` and `StockBalance` (Single source of physical truth).
- **Financial Posting**:
  - Production Consumption: $\text{Dr. WIP Asset}$, $\text{Cr. Raw Materials Asset}$
  - Production Yield: $\text{Dr. Finished Goods Asset}$, $\text{Cr. WIP Asset}$
  - Approved Wastage: $\text{Dr. 53000 - Inventory Wastage Expense}$, $\text{Cr. 13000 - Inventory Asset}$

### 4.5 POS Register Closing & Cash Variance
- Register closing calculates expected cash vs actual physical tender count.
- **Overage (Surplus)**: $\text{Dr. Cash Account}$, $\text{Cr. 49000 - Cash Overage Income}$
- **Shortage (Deficit)**: $\text{Dr. 59000 - Cash Shortage Expense}$, $\text{Cr. Cash Account}$

---

## 5. Double-Entry Posting Engine Invariants

Every automated posting must execute through `FinancePostingEngine` inside an atomic transaction:

```text
1. Validate Organization & User Permissions
2. Verify Fiscal Year & Fiscal Period Status is OPEN
3. Validate All Target Account IDs (Active, Postable Leaf, Org-matching)
4. Validate All Line Branch IDs (Assigned to Organization)
5. Mathematical Check: Sum(Debits) == Sum(Credits) && Sum(Debits) > 0
6. Idempotency & Concurrency CAS Lock (sourceModule + sourceEntityId)
7. Create JournalEntry (Status = POSTED)
8. Create JournalEntryLines (Debit / Credit)
9. Record Transactional AuditLog (Action = CREATE, Entity = journal_entry)
10. Write Transactional OutboxEvent (Type = finance.journal.posted)
11. COMMIT
```

---

## 6. Source Traceability & Idempotency Strategy
- **Unique Constraint**: `@@unique([organizationId, sourceModule, sourceEntityId])` on `JournalEntry` guarantees that 100 concurrent requests from the same operational event produce **exactly 1 General Ledger entry**.
- **Replay Protection**: Replaying an already posted event returns the existing `JournalEntry` without re-posting.

---

## 7. Migration & Backward Compatibility
- Existing endpoints (`/finance/expenses`, `/finance/cash-registers`, `/finance/supplier-ledger`, `/finance/reports/kpis`) must remain 100% contract-compatible.
- `FinanceService.createExpense()` will create an `Expense` record and simultaneously post a balanced `JournalEntry`.
- `SupplierLedger` will transition seamlessly from dynamic PO queries to reconciled Accounts Payable balances.
