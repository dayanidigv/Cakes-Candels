# 📑 SPRINT 11 — HR & PAYROLL ARCHITECTURE CONTRACT

> **Domain**: HR & Payroll Management System  
> **Target Release**: Sprint 11  
> **Status**: ARCHITECTURE CONTRACT & SPECIFICATION ONLY (NO CODE / DB SCHEMA MODIFICATIONS)  
> **Prerequisites**: Sprints 01–10 CLOSED & CERTIFIED GREEN  

---

## 1. Executive Summary & Domain Vision

The **Cakes & Candles HR & Payroll Domain** provides an end-to-end employee lifecycle, attendance management, leave ledger, and backend-authoritative payroll processing engine tailored for multi-tenant bakery operations (combining central factory production staff, retail branch staff, logistics drivers, and administrative personnel).

---

## 2. Non-Negotiable Architecture Invariants

1. **Finance is the Financial Source of Truth**: HR does **not** create duplicate financial ledgers, accounts, or journal entries. Upon transitioning a `PayrollRun` to `POSTED` / `PAID`, the payroll engine posts financial entries directly into the existing **Finance Domain** (`Expense` / `JournalEntry`).
2. **User/Auth is the Authentication Source of Truth**: HR does **not** duplicate authentication or user credentials. `User` remains the single source of login identity. `Employee` has a 1-to-1 optional foreign key link (`userId`) to `User`.
3. **Organization/Branch are the Organizational Source of Truth**: HR uses existing `Organization` and `Branch` entities. No second organization/branch model is created.
4. **Backend-Authoritative Calculations**: Frontend components must **never** compute or mutate gross pay, net pay, statutory tax deductions, or leave balances. All mathematical calculations occur strictly within backend transactional services.
5. **Immutable Financial Ledger**: Completed `PayrollRun`, `Payslip`, `PayrollItem`, and `SalaryStructure` records are strictly **immutable**. Modifications to past pay periods require corrective adjustments in subsequent payroll runs.
6. **Ledger-Based Balances**: Leave balances are updated strictly via immutable `LeaveTransaction` rows (Accrual, Deduction, Adjustment). Direct SQL `UPDATE` of leave balances without transaction logs is forbidden.
7. **Idempotency & Concurrency Protection**: Payroll run calculations and payslip generations must be idempotent (`idempotencyKey`). 100-way concurrent calculation requests must be protected by database transaction locks (`1 success, 99 rejected/replayed`).
8. **Strict Multi-Tenant & Branch Isolation**: Enforce `GLOBAL / FACTORY / BRANCH / ASSIGNED` RBAC scopes across all HR endpoints. Cross-branch or cross-tenant ID access attempts return `403 Forbidden` / `404 Not Found`.

---

## 3. Comprehensive HR Domain Architecture

```text
                               CAKES & CANDLES ERP
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             ▼                          ▼                          ▼
    IDENTITY & AUTH (S01)       MASTER DATA (S02)           FINANCE DOMAIN (S08)
     (User, Role, Token)       (Org, Branch, Dept)          (Expense, JournalEntry)
             │                          │                          ▲
             └──────────────────────────┼──────────────────────────┘
                                        ▼
                                🏆 SPRINT 11 DOMAIN
                                        │
     ┌──────────────────┬───────────────┴───────────────┬──────────────────┐
     ▼                  ▼                               ▼                  ▼
EMPLOYEE MASTER     ATTENDANCE & SHIFTS              LEAVE LEDGER      PAYROLL ENGINE
 ├─ Employee 360     ├─ ShiftMaster                  ├─ LeaveType       ├─ SalaryStructure
 ├─ Dept/Designation ├─ AttendanceLog                ├─ LeavePolicy     ├─ PayrollRun
 └─ Lifecycle        └─ Correction Workflow          └─ Request/Approve └─ Payslip (Finance)
```

---

## 4. 44-Point System Component Mapping

| # | Topic | Architectural Specification | Single Source of Truth / Model |
| :-: | :--- | :--- | :--- |
| **1** | HR Domain Boundaries | Scoped strictly to employee onboarding, shift roster, attendance, leave accruals, salary structures, payroll calculations, and payslip generation. | `HRModule` (NestJS) |
| **2** | Employee Master | Holds PII, join date, status, employment type (`FULL_TIME`, `PART_TIME`, `CONTRACT`, `INTERN`), and bank details. | `Employee` model |
| **3** | Employee ↔ User Link | Optional 1-to-1 relation `userId` on `Employee`. Allows non-system employees (e.g. factory floor workers) without login accounts. | `Employee.userId → User.id` |
| **4** | Department Master | Organizational hierarchy unit. Scoped by `organizationId`. | `Department` |
| **5** | Designation Master | Role title and pay band hierarchy. Scoped by `organizationId`. | `Designation` |
| **6** | Employment Lifecycle | State machine: `DRAFT` → `ACTIVE` → `ON_LEAVE` / `SUSPENDED` → `RESIGNED` / `TERMINATED`. | `Employee.status` |
| **7** | Branch / Factory Assignments | Employees assigned to primary `assignedBranchId` (retail branch or central factory). | `Employee.assignedBranchId` |
| **8** | Shift Architecture | Defines shift times (`startTime`, `endTime`, `gracePeriodMinutes`, `breakDurationMinutes`). | `ShiftMaster`, `EmployeeShift` |
| **9** | Attendance Lifecycle | State machine: `SCHEDULED` → `CHECKED_IN` → `CHECKED_OUT` → `FINALIZED`. | `AttendanceLog` |
| **10** | Attendance Correction | Workflow: Employee/Supervisor files `AttendanceCorrectionRequest` → Approval Engine → Status updated. | `AttendanceCorrectionRequest` |
| **11** | Leave Policy | Rules defining annual entitlements, carry-forward limits, and encashment parameters per leave type. | `LeavePolicy` |
| **12** | Leave Allocation & Balance | Accrual rules (Paid Leave, Casual Leave, Sick Leave). Ledger-based `LeaveTransaction`. | `LeaveType`, `EmployeeLeaveBalance` |
| **13** | Leave Request Workflow | State machine: `DRAFT` → `SUBMITTED` → `APPROVED` / `REJECTED` → `CANCELLED`. | `LeaveRequest` |
| **14** | Leave Approval | Manager / HR approval triggers atomic balance deduction transaction. | `LeaveService.approveRequest()` |
| **15** | Salary Structure | Defines base salary, fixed allowances, and statutory deduction templates per employee. | `SalaryStructure`, `SalaryComponent` |
| **16** | Earnings Engine | Computes Basic Pay, HRA, Special Allowance, Overtime Pay (`OT_Hours * OT_Rate`), and Performance Bonuses. | `PayrollCalculationEngine` |
| **17** | Deductions Engine | Computes Statutory Deductions (PF, ESI, Professional Tax, TDS), Loss of Pay (LOP), and Advance Repayments. | `PayrollCalculationEngine` |
| **18** | Payroll Period | Defines cycle (`MONTHLY`, `BI_WEEKLY`) with `startDate`, `endDate`, `cutOffDate`, and `paymentDate`. | `PayrollPeriod` |
| **19** | Payroll Calculation Engine | Backend transaction executing Gross Pay, Deductions, and Net Pay (`Gross - Deductions`). | `PayrollService.calculateRun()` |
| **20** | Payroll Run Lifecycle | State machine: `DRAFT` → `CALCULATING` → `CALCULATED` → `PENDING_APPROVAL` → `APPROVED` → `POSTED` → `PAID` → `CLOSED`. | `PayrollRun` |
| **21** | Payroll Approval | Multi-level approval integration (Manager → Finance → HR Director sign-off) via S01 Approval Engine. | `ApprovalRequest` |
| **22** | Payslip Generation | State machine: `GENERATED` → `APPROVED` → `ISSUED`. Includes cryptographic PDF verification hash. | `Payslip` |
| **23** | Payroll → Finance Integration | Upon transitioning `PayrollRun` to `POSTED`, posts `Expense` & `JournalEntry` into S08 Finance Domain. | `FinanceService.postPayrollExpense()` |
| **24** | HR Permissions | Granular RBAC keys: `hr:employee:read`, `hr:employee:write`, `hr:payroll:run`, `hr:payroll:approve`, `hr:leave:approve`. | `Permission` enum |
| **25** | Tenant Isolation | Enforces strict multi-tenant boundary via `organizationId` index and JWT token verification. | `TenantGuard` |
| **26** | Branch / Factory Scope | `GLOBAL` (All Orgs/Branches), `FACTORY` (Central Factory), `BRANCH` (Assigned Branch), `ASSIGNED` (Self/Subordinates). | `BranchScopeGuard` |
| **27** | Audit Requirements | Every salary modification, status transition, leave approval, and payroll run is recorded in `AuditLog`. | `AuditLog` (S01 Audit) |
| **28** | Approval Requirements | Multi-step sign-off for attendance corrections, leave requests, and payroll runs using S01 `ApprovalEngine`. | `ApprovalEngine` |
| **29** | Idempotency Requirements | Unique `idempotencyKey` enforced on `PayrollRun` calculations and `Payslip` generation to prevent double runs. | `IdempotencyRecord` |
| **30** | Concurrency Requirements | 100-way concurrent payroll run calculation & 100-way concurrent leave deduction protected by DB locks. | `tx.payrollRun.updateMany` lock |
| **31** | Outbox Event Catalog | Publishes `hr.employee.created`, `hr.attendance.recorded`, `hr.leave.approved`, `hr.payroll.approved`, `hr.payroll.paid`. | `OutboxEvent` (S01 Outbox) |
| **32** | API Contract Architecture | RESTful contracts under `/api/v1/hr/*` with NestJS DTO validation and RFC 7807 problem details. | `HrController`, `PayrollController` |
| **33** | Admin UI Architecture | Integrated in `@cc-erp/web-admin`: Employee Directory, Attendance Roster, Leave Management, Payroll Manager. | React Admin UI |
| **34** | Employee 360 Workspace | Unified 360° workspace: Profile, Shift Roster, Attendance Log, Leave Ledger, Salary Structure, Payslips, Documents. | `Employee360Page.tsx` |
| **35** | HR Dashboard | Key metrics: Total Employees, Attendance Today %, On Leave Today, Pending Leave Approvals, Monthly Payroll Cost. | `HrDashboardPage.tsx` |
| **36** | HR & Payroll Reports | Reports: Monthly Payroll Summary, Statutory PF/ESI Return, Attendance Summary, Leave Utilization. | `HrReportService` |
| **37** | Database ERD & Relationships | Clean Prisma relational graph linking `Employee`, `AttendanceLog`, `LeaveRequest`, `PayrollRun`, `Payslip`. | `schema.prisma` |
| **38** | Migration Strategy | Production deployment using `npx prisma migrate dev` → SQL Review → Staging Validation → `npx prisma migrate deploy`. | Prisma Migrations |
| **39** | Unit Test Strategy | Test suites for `PayrollCalculationEngine`, `LeaveLedgerService`, `AttendanceService`, `RosterService`. | `*.spec.ts` |
| **40** | Integration Test Strategy | Integration tests for NestJS `HrModule` controllers, services, and database persistence. | `*.integration-spec.ts` |
| **41** | E2E Test Strategy | End-to-end lifecycle testing: Employee Onboarding → Attendance → Leave Request → Payroll Run → Finance Posting. | `*.e2e-spec.ts` |
| **42** | Concurrency Test Strategy | 100-way parallel execution tests verifying 1 success / 99 rejected for payroll runs & leave deductions. | `hr-concurrency.spec.ts` |
| **43** | Security Test Strategy | Isolation tests verifying Org A user cannot access Org B employee data; Branch user cannot view other branches. | `hr-security.e2e-spec.ts` |
| **44** | Production Certification Gates | 0 TypeScript errors, 5/5 Lint tasks, 6/6 Monorepo builds, 100% test pass rate across unit/e2e/concurrency. | Verification Pipeline |

---

## 5. Explicit Out-of-Scope Items (Sprint 11)

- ❌ **Direct Bank Clearing API Integrations** (NEFT/ACH automated file dispatch to banks is deferred; exported as NACHA/CSV).
- ❌ **Face-Recognition Biometric Hardware Firmware** (Handled via standard REST API ingestion endpoint `/api/v1/hr/attendance/ingest`).
- ❌ **Custom Stock Options & Equity Management** (Not applicable to retail bakery staff).

---

## 6. Deliverables Matrix

1. 📄 [`SPRINT_11_ARCHITECTURE_CONTRACT.md`](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/docs/sprint11/SPRINT_11_ARCHITECTURE_CONTRACT.md)
2. 📄 [`HR_DOMAIN_MODEL.md`](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/docs/sprint11/HR_DOMAIN_MODEL.md)
3. 📄 [`PAYROLL_ENGINE_SPEC.md`](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/docs/sprint11/PAYROLL_ENGINE_SPEC.md)
4. 📄 [`HR_RBAC_MATRIX.md`](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/docs/sprint11/HR_RBAC_MATRIX.md)
5. 📄 [`HR_STATE_MACHINES.md`](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/docs/sprint11/HR_STATE_MACHINES.md)
6. 📄 [`HR_EVENT_CATALOG.md`](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/docs/sprint11/HR_EVENT_CATALOG.md)
7. 📄 [`HR_TEST_STRATEGY.md`](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/docs/sprint11/HR_TEST_STRATEGY.md)
8. 📄 [`SPRINT_11_PHASE_PLAN.md`](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/docs/sprint11/SPRINT_11_PHASE_PLAN.md)
