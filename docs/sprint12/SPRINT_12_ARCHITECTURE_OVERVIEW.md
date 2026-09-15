# 🌐 SPRINT 12 — ARCHITECTURE OVERVIEW
## Enterprise Accounting System Architecture & Integration Topology

> **Sprint**: Sprint 12 — Finance & Accounting  
> **Status**: FROZEN (Phase 12.1)  
> **Classification**: Architectural System Design  

---

## 1. Architectural Vision & Foundational Tenets
Sprint 12 transforms Cakes & Candles ERP into a fully integrated, double-entry financial platform.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                      CROSS-CUTTING PLATFORM CORE                        │
│   • Multi-Tenant Isolation (Org)     • Central Auth & Guards (JWT/RBAC) │
│   • Transactional Outbox Pattern     • AuditLog Compliance Trail        │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   PROCUREMENT    │       │      SALES       │       │   HR & PAYROLL   │
│ • Purchase Order │       │ • Storefront Web │       │ • Payroll Run    │
│ • GRN Receipts   │       │ • POS Till Sales │       │ • Salary Accrual │
│ • Supplier Bills │       │ • Custom Orders  │       │ • Statutory Liab │
└────────┬─────────┘       └────────┬─────────┘       └────────┬─────────┘
         │                          │                          │
         └───────────────────┐      │      ┌───────────────────┘
                             │      │      │
                             ▼      ▼      ▼
                  ┌────────────────────────────────────┐
                  │    CENTRAL FINANCE POSTING ENGINE  │
                  │   • Fiscal Period Open Validation  │
                  │   • Debit = Credit Balance Guard   │
                  │   • Idempotent CAS Protection      │
                  └─────────────────┬──────────────────┘
                                    │
                                    ▼
                  ┌────────────────────────────────────┐
                  │    GENERAL LEDGER (Source Truth)   │
                  │   • JournalEntry                   │
                  │   • JournalEntryLine (Branch Scoped│
                  └─────────────────┬──────────────────┘
                                    │
                                    ▼
                  ┌────────────────────────────────────┐
                  │   FINANCIAL REPORTING ENGINE       │
                  │   • Trial Balance (Sum D == Sum C) │
                  │   • Profit & Loss (Org & Branch)   │
                  │   • Balance Sheet (Assets == L + E)│
                  │   • GST Tax Filing Summary         │
                  └────────────────────────────────────┘
```

---

## 2. Cross-Cutting Design Patterns

### 2.1 Double-Entry Atomic Posting Pattern
- Every financial mutation originates as an operational event.
- The `FinancePostingEngine` receives the domain event, resolves account mappings, checks the fiscal period, verifies $\sum \text{Debits} \equiv \sum \text{Credits}$, and creates `JournalEntry` + `JournalEntryLine` in a single PostgreSQL transaction.

### 2.2 Reversal & Replacement Immutable Audit Pattern
- No posted journal entry may be updated or deleted.
- Erroneous entries are neutralized by posting an inverted reversal journal (`status = REVERSED`, `reversalEntryId = reversalId`) followed by the corrected journal.

### 2.3 Organization Tenancy with Branch Cost-Center Attribution
- The Chart of Accounts and Fiscal Calendar are scoped to `Organization`.
- Individual `JournalEntryLine` records store optional `branchId`.
- This enables localized Branch P&L, Factory cost accounting, and centralized consolidated corporate balance sheets.

### 2.4 Transactional Outbox Pattern
- Outbox events (`finance.journal.posted`, `finance.ap.bill.posted`, `finance.period.closed`) are written atomically within the same database transaction.
- Background dispatchers publish events asynchronously with guaranteed at-least-once delivery.
