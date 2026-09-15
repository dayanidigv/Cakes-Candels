# 🏦 SPRINT 11 — PHASE 3D FINANCE ARCHITECTURE REVIEW
## Production Review & Integration Analysis

> **Sprint**: Sprint 11 — Phase 3D  
> **Status**: APPROVED & CERTIFIED  
> **Date**: 2026-09-03  

---

### 1. Finance Source of Truth
The existing Finance domain located at [`apps/api/src/modules/finance/`](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/apps/api/src/modules/finance/) is the **single authoritative source of financial truth** across the entire Cakes & Candles ERP system. The HR and Payroll domains **do not** instantiate duplicate financial ledgers, nor do they define isolated balance tables.

### 2. Posting Service
The posting execution is performed by `FinanceService.postPayrollExpense()` in [`apps/api/src/modules/finance/finance.service.ts`](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/apps/api/src/modules/finance/finance.service.ts). The HR module calls this service within its transactional workflow in `PayrollRunService.postPayrollToFinance()`.

### 3. Journal / Debit / Credit Structure
The posting strictly enforces mathematical double-entry reconciliation:
$$\text{Gross Pay (Debit: Salary Expense)} = \text{Net Pay (Credit: Cash/Bank Disbursement)} + \text{Total Deductions (Credit: Statutory Liabilities)}$$
Any disparity exceeding $\pm 0.05$ currency units aborts the transaction immediately with a `400 Bad Request` financial mismatch error.

### 4. Financial Transaction & Expense Purpose
- **`Expense`**: Records the operational expense entity categorized under `'SALARY'`.
- **`sourceModule`**: Tagged as `'HR_PAYROLL'`.
- **`sourceEntityId`**: Foreign reference pointing directly to the authoritative `PayrollRun.id`.
- **`referenceNumber`**: Carries the unique run number (e.g. `PAY-2026-08-001`).

### 5. Account Mapping Mechanism
Accounts are dynamically resolved within the Finance Domain via the canonical category `'SALARY'`. Hardcoded account UUIDs are strictly forbidden.

### 6. Fiscal Period Rules
Payroll periods enforce calendar boundaries (`startDate` to `endDate`), year, and month validation, preventing postings to unapproved or closed calendar periods.

### 7. Idempotency Mechanism
Multi-layer idempotency is implemented:
1. **Request-Level**: `idempotencyKey` parameter supported on `POST /api/v1/hr/payroll/runs/:id/post`.
2. **Database CAS Lock**: Atomic `updateMany({ where: { id, status: 'APPROVED' }, data: { status: 'POSTED' } })` ensures exactly one thread can transition the payroll run. Concurrent or replay attempts return the existing posted run with its preserved `financeExpenseId`.

### 8. Audit Logging Mechanism
Transactional `AuditLog` records are persisted inside the PostgreSQL transaction:
- `module`: `'HR'`
- `entity`: `'payroll_run'`
- `entityId`: `payrollRun.id`
- `action`: `'UPDATE'`
- `before`: `{ status: 'APPROVED' }`
- `after`: `{ status: 'POSTED', financeExpenseId, totalNetPay, runNumber }`

### 9. Transactional Outbox Mechanism
Every posting transaction generates a persistent `OutboxEvent` record:
- `type`: `'hr.payroll.paid'` (and `'hr.payroll.posted'`)
- `payload`: Contains `payrollRunId`, `organizationId`, `financeExpenseId`, `totalGrossPay`, `totalDeductions`, `totalNetPay`, `postedAt`.

### 10. Source Document / Reference Mechanism
Bidirectional traceability:
- `PayrollRun.financeExpenseId` $\rightarrow$ `Expense.id`
- `Expense.sourceEntityId` $\rightarrow$ `PayrollRun.id`
- `Expense.referenceNumber` $\rightarrow$ `PayrollRun.runNumber`

### 11. Multi-Tenancy & Scope Isolation
- `organizationId` is enforced on all queries and mutations via the authenticated user's JWT claims.
- Scopes: `GLOBAL` and `HQ` administrators are authorized (`hr:payroll:run` permission).
- Scopes: `BRANCH` and `ASSIGNED` are strictly rejected with `403 Forbidden`.

### 12. Payroll-to-Finance Integration Point
- API Endpoint: `POST /api/v1/hr/payroll/runs/:id/post` & `POST /api/v1/hr/payroll/runs/:id/post-finance`
- Service Method: `PayrollRunService.postPayrollToFinance(id, user, idempotencyKey)` $\rightarrow$ `FinanceService.postPayrollExpense()`
