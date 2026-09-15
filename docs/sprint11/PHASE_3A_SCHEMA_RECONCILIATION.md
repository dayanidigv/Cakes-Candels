# 🔍 Sprint 11 Phase 3A — Schema Reconciliation & Architecture Alignment

> **Document**: `PHASE_3A_SCHEMA_RECONCILIATION.md`  
> **Status**: APPROVED FOR IMPLEMENTATION  
> **Scope**: Critical Reconciliation of Prisma Models and Leave Balance Ledger Authority  

---

## 1. HR & Payroll Prisma Models Reconciliation

### 1.1 Context
In the Phase 2 executive summary, the phrase "25 domain entities" referenced the comprehensive aggregate of **19 new HR/Payroll database tables** + **6 reused foundational entities/enums** (`Organization`, `Branch`, `User`, `IdempotencyRecord`, `OutboxEvent`, `AuditLog`).

The concrete Prisma schema contains exactly **19 distinct HR & Payroll models** and **6 domain enums**:

### 1.2 The 19 HR & Payroll Models in `schema.prisma`
1. `Department` — Organization-level department master
2. `Designation` — Role title and organizational grading hierarchy
3. `Employee` — Core employee master with PII, compliance numbers, bank details
4. `ShiftMaster` — Work shift time definitions and grace period parameters
5. `EmployeeShift` — Effective-dated employee shift assignment roster
6. `AttendanceLog` — Daily punch logs with calculated hours and overtime
7. `AttendanceCorrectionRequest` — Auditable attendance dispute and correction workflow
8. `LeaveType` — Categorical leave master (Paid Leave, Casual Leave, Sick Leave)
9. `LeavePolicy` — Per-organization leave entitlement and continuous-day rules
10. `EmployeeLeaveBalance` — **Read-model projection** for annual leave balances
11. `LeaveRequest` — Leave application workflow (`DRAFT` → `SUBMITTED` → `APPROVED` / `REJECTED` / `CANCELLED`)
12. `LeaveTransaction` — **Authoritative immutable ledger** tracking all accruals, deductions, and reversals
13. `SalaryComponent` — Master earnings, allowances, and statutory deduction components
14. `SalaryStructure` — Effective-dated salary definition per employee
15. `PayrollPeriod` — Monthly/bi-weekly calendar payroll periods
16. `PayrollRun` — Execution run managing calculation, approval, and financial posting lifecycle
17. `PayrollItem` — Per-employee payroll breakdown and line-item totals
18. `PayrollDetail` — Normalized component-level earnings/deductions itemization
19. `Payslip` — Immutable payslip record with cryptographic hash verification

### 1.3 The 6 Enums in `schema.prisma`
1. `EmploymentType` (`FULL_TIME`, `PART_TIME`, `CONTRACT`, `INTERN`)
2. `EmploymentStatus` (`DRAFT`, `ACTIVE`, `ON_LEAVE`, `SUSPENDED`, `RESIGNED`, `TERMINATED`)
3. `AttendanceStatus` (`SCHEDULED`, `CHECKED_IN`, `CHECKED_OUT`, `FINALIZED`)
4. `LeaveRequestStatus` (`DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `CANCELLED`)
5. `PayrollRunStatus` (`DRAFT`, `CALCULATING`, `CALCULATED`, `PENDING_APPROVAL`, `APPROVED`, `POSTED`, `PAID`, `CLOSED`)
6. `PayslipStatus` (`GENERATED`, `APPROVED`, `ISSUED`)

---

## 2. Leave Balance Ledger Source of Truth Architecture

### 2.1 Problem Statement
`EmployeeLeaveBalance` contains `allocated`, `used`, and `balance` numeric fields. In legacy designs, developers might directly update `balance = balance - requestedDays`, creating race conditions and losing historical auditability.

### 2.2 Reconciled Architectural Authority
- **Authoritative Ledger (`LeaveTransaction`)**:
  `LeaveTransaction` is the **single source of truth** for all leave accounting. Every leave event creates an immutable row:
  - Annual Accrual / Carry Forward $\rightarrow$ `LeaveTransaction(type: 'ACCRUAL', days: +15)`
  - Approved Leave Application $\rightarrow$ `LeaveTransaction(type: 'DEDUCTION', days: -3)`
  - Approved Leave Cancellation $\rightarrow$ `LeaveTransaction(type: 'ADJUSTMENT', days: +3)`

- **Read-Model Projection (`EmployeeLeaveBalance`)**:
  `EmployeeLeaveBalance` acts purely as a **cached read-model projection** for high-throughput UI display.
  
- **Authority Invariant**:
  When approving or validating leave requests, `LeaveService` computes available balance via `SUM(LeaveTransaction.days)` inside a serializable database transaction (`prisma.$transaction`). It **never** trusts `EmployeeLeaveBalance.balance` for authorization.
  Following transaction commit, `EmployeeLeaveBalance` is synchronized as a projection. If any desynchronization ever occurs, the balance can be reconstructed 100% deterministically from `LeaveTransaction`.

### 2.3 Service Ownership Matrix
| Responsibility | Owning Service | Mechanism |
| :--- | :--- | :--- |
| **Balance Authority & Authorization** | `LeaveService` | `SUM(LeaveTransaction.days)` in DB Transaction |
| **Entitlement Allocation** | `LeaveAllocationService` | Inserts `ACCRUAL` in `LeaveTransaction` + updates projection |
| **Leave Deductions & Reversals** | `LeaveService` | Inserts `DEDUCTION` / `ADJUSTMENT` in `LeaveTransaction` |
| **Reconstruction / Health Audit** | `LeaveAllocationService.recalculateProjection()` | Aggregates ledger to refresh `EmployeeLeaveBalance` |

---

## 3. Conclusion & Safety Evaluation

1. **Schema Correction Required**: **None**. The current Prisma schema contains the exact 19 domain models and constraints required.
2. **Current Schema Safety**: **100% Safe to Proceed**. The relational constraints, composite keys (`organizationId + employeeCode`, `employeeId + workDate`, `employeeId + leaveTypeId + year`), and immutable ledger structure perfectly satisfy all contract specifications.
