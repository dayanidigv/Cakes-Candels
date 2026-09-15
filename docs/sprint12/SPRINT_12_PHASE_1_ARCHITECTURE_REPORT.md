# 📋 SPRINT 12 — PHASE 12.1 ARCHITECTURE REPORT
## Finance & Double-Entry Accounting Architecture Contract

> **Sprint**: Sprint 12 — Phase 12.1  
> **Status**: **PASS (100% FROZEN & APPROVED)**  
> **Date**: 2026-09-03  
> **Classification**: Architecture Gate Certification  

---

## 1. Executive Summary & Verification
Phase 12.1 establishes the formal, production-ready **Finance & Double-Entry Accounting Architecture Contract** for Cakes & Candles ERP.

### Absolute Rule Compliance Confirmation:
> [!IMPORTANT]
> **"No production code, schema, migration, seed, or database state was modified during Phase 12.1."**  
> All 9 formal architecture documents have been created, cross-referenced, and frozen.

---

## 2. Summary of Key Architectural Decisions Frozen

| # | Architecture Dimension | Frozen Decision & Invariant |
| :--- | :--- | :--- |
| **1** | **General Ledger Source of Truth** | `JournalEntry` and `JournalEntryLine` are the **single authoritative financial source of truth**. All operational subledgers (`SupplierBill`, `Payment`, `Expense`, `POSRegister`) post directly into the General Ledger. |
| **2** | **Chart of Accounts** | Hierarchical, organization-scoped (`Account`) with 5 fundamental classes (`ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`). Branch attribution occurs at the journal line level (`branchId`), eliminating duplicate COAs per branch. |
| **3** | **Fiscal Calendar & Locking** | Strict `FiscalYear` and `FiscalPeriod` state machine (`OPEN` $\to$ `CLOSED` $\to$ `LOCKED`). Closed periods reject all manual and automated postings. |
| **4** | **Double-Entry Posting Engine** | Centralized `FinancePostingEngine` executes atomic validation: org scope, period status, active leaf accounts, mathematical balance ($\sum \text{Debits} \equiv \sum \text{Credits}$), idempotency, and transactional outbox. |
| **5** | **Payroll Posting Boundary** | Payroll posting accrues $\text{Dr. Salary Expense (Gross)}$, $\text{Cr. Statutory Payables}$, $\text{Cr. Payroll Payable (Net)}$. Bank/Cash is NOT credited during payroll posting (reserved for separate salary payout). |
| **6** | **3-Way Matching & AP** | Automated verification of PO + GRN + Supplier Bill before approval and payment voucher creation. |
| **7** | **Sales & Revenue Recognition** | Revenue recognized upon order confirmation/POS sale; clearing accounts reconciled upon payment capture. |
| **8** | **Inventory Valuation** | Physical inventory remains governed by `InventoryTransaction`; valuation accounts in GL synchronize via automated consumption/yield/wastage hooks. |
| **9** | **Posting Immutability & Reversals** | `POSTED` entries cannot be edited or deleted. Corrections use explicit **Reversal Journals** followed by corrected entries. |
| **10**| **Backward Compatibility** | Existing endpoints (`/finance/expenses`, `/finance/cash-registers`, `/finance/supplier-ledger`, `/finance/reports/kpis`) remain 100% compatible while backed by the General Ledger. |

---

## 3. Documents Created & Reconciled

1. [`SPRINT_12_ARCHITECTURE_CONTRACT.md`](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/docs/sprint12/SPRINT_12_ARCHITECTURE_CONTRACT.md): Core architectural invariants, operational flows, posting rules.
2. [`FINANCE_DOMAIN_MODEL.md`](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/docs/sprint12/FINANCE_DOMAIN_MODEL.md): Complete Prisma entities, enums, indexes, constraints, and standard bakery COA dictionary.
3. [`FINANCE_STATE_MACHINES.md`](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/docs/sprint12/FINANCE_STATE_MACHINES.md): State diagrams and CAS rules for Fiscal Periods, Journal Entries, AP Bills, and Expenses.
4. [`FINANCE_RBAC_MATRIX.md`](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/docs/sprint12/FINANCE_RBAC_MATRIX.md): Detailed permissions, role matrices, and scope guards (`GLOBAL`, `BRANCH`, `ASSIGNED`).
5. [`FINANCE_EVENT_CATALOG.md`](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/docs/sprint12/FINANCE_EVENT_CATALOG.md): Canonical Outbox event schemas and payload definitions.
6. [`FINANCE_TEST_STRATEGY.md`](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/docs/sprint12/FINANCE_TEST_STRATEGY.md): Testing pyramid, 100-thread concurrency specifications, and accounting validation suites.
7. [`SPRINT_12_PHASE_PLAN.md`](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/docs/sprint12/SPRINT_12_PHASE_PLAN.md): 11 implementation phases (12.1 through 12.11) with scopes, tests, and gates.
8. [`SPRINT_12_ARCHITECTURE_OVERVIEW.md`](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/docs/sprint12/SPRINT_12_ARCHITECTURE_OVERVIEW.md): High-level system design and cross-cutting integration topology.
9. [`SPRINT_12_PHASE_1_ARCHITECTURE_REPORT.md`](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/docs/sprint12/SPRINT_12_PHASE_1_ARCHITECTURE_REPORT.md): This formal audit report.

---

## 4. Phase Plan Roadmap (12.1 to 12.11)

- **Phase 12.1**: Architecture Contract (✅ COMPLETE)
- **Phase 12.2**: Chart of Accounts & Fiscal Periods (Next)
- **Phase 12.3**: General Ledger & Double-Entry Posting Engine
- **Phase 12.4**: Operational Expense Accounting
- **Phase 12.5**: Accounts Payable & 3-Way Matching
- **Phase 12.6**: Accounts Receivable & Sales/POS Accounting
- **Phase 12.7**: Tax & GST Accounting
- **Phase 12.8**: Inventory & Valuation Accounting
- **Phase 12.9**: Bank & Register Reconciliation
- **Phase 12.10**: Financial Reporting & Statements (TB, P&L, BS)
- **Phase 12.11**: Final Production Certification & End-to-End Audit

---

## 5. Certification Decision

**Phase 12.1 Status**: **PASS**

Ready for review and authorization of **Phase 12.2: Chart of Accounts & Fiscal Periods**.
