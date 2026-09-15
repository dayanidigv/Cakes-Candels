# 🟢 Sprint 11 Phase 3A — HR Foundation Implementation & Hardening Report

> **Status**: COMPLETED & VERIFIED 100% GREEN  
> **Final Certification Decision**: PASS  
> **Repository Health**: 0 TypeScript Errors, 5/5 Lint Tasks Clean, 6/6 Monorepo Builds Passing, 112/112 API Unit & Integration Tests Passing across 28 Test Suites.  

---

## 1. Implementation Summary

Sprint 11 Phase 3A has established the hardened, production-grade **HR Foundation Core** for the Cakes & Candles Multi-Tenant Bakery ERP. 

All core HR domains—**Employees**, **Departments**, **Designations**, **Shifts & Rostering**, **Attendance Logs & Punches**, and **Leave Management with Ledger Authority**—have been built from the ground up, replacing legacy placeholder stubs with strongly typed, scoped, audited, and transaction-safe services and controllers.

---

## 2. Services Implemented

| Service | File Path | Scope & Core Responsibility |
| :--- | :--- | :--- |
| `EmployeeService` | `apps/api/src/modules/hr/services/employee.service.ts` | Employee profile management, branch/dept/desig assignments, and lifecycle state transitions. |
| `DepartmentService` | `apps/api/src/modules/hr/services/department.service.ts` | Organization-scoped department CRUD, manager assignment, and active headcount aggregation. |
| `DesignationService` | `apps/api/src/modules/hr/services/designation.service.ts` | Pay band level hierarchy and job title configuration per organization. |
| `ShiftService` | `apps/api/src/modules/hr/services/shift.service.ts` | Shift definition master, grace period rules, and effective-dated employee roster assignments. |
| `AttendanceService` | `apps/api/src/modules/hr/services/attendance.service.ts` | Biometric/POS check-in/out recording, backend-computed hours & overtime, and dispute correction workflow. |
| `LeaveTypeService` | `apps/api/src/modules/hr/services/leave.service.ts` | Master leave categories (Paid Leave, Casual Leave, Sick Leave). |
| `LeavePolicyService` | `apps/api/src/modules/hr/services/leave.service.ts` | Max continuous days and notice period rules per leave type. |
| `LeaveAllocationService`| `apps/api/src/modules/hr/services/leave.service.ts` | Annual entitlement allocation (ACCRUAL ledger entry) and projection recalculation. |
| `LeaveService` | `apps/api/src/modules/hr/services/leave.service.ts` | Leave request workflow (DRAFT $\rightarrow$ SUBMITTED $\rightarrow$ APPROVED / REJECTED / CANCELLED) backed by atomic ledger mutations. |

---

## 3. Controllers Implemented

| Controller | Route Boundary | Security Guards & Decorators |
| :--- | :--- | :--- |
| `EmployeeController` | `/api/v1/hr/employees` | `JwtAuthGuard`, `BranchScopeGuard`, `PermissionsGuard`, `@RequirePermissions('hr:employee:read'/'write')` |
| `DepartmentController`| `/api/v1/hr/departments` | `JwtAuthGuard`, `BranchScopeGuard`, `PermissionsGuard`, `@RequirePermissions('hr:employee:read'/'write')` |
| `DesignationController`| `/api/v1/hr/designations`| `JwtAuthGuard`, `BranchScopeGuard`, `PermissionsGuard`, `@RequirePermissions('hr:employee:read'/'write')` |
| `ShiftController` | `/api/v1/hr/shifts` | `JwtAuthGuard`, `BranchScopeGuard`, `PermissionsGuard`, `@RequirePermissions('hr:employee:read'/'write')` |
| `AttendanceController` | `/api/v1/hr/attendance` | `JwtAuthGuard`, `BranchScopeGuard`, `PermissionsGuard`, `@RequirePermissions('hr:attendance:read'/'write'/'correct')` |
| `LeaveController` | `/api/v1/hr/leave-*` | `JwtAuthGuard`, `BranchScopeGuard`, `PermissionsGuard`, `@RequirePermissions('hr:leave:read'/'write'/'approve')` |

---

## 4. DTOs & Validation

- `CreateEmployeeDto`, `UpdateEmployeeDto`, `ChangeEmployeeStatusDto`, `AssignBranchDto`, `AssignDepartmentDto`, `AssignDesignationDto`
- `CreateDepartmentDto`, `UpdateDepartmentDto`
- `CreateDesignationDto`, `UpdateDesignationDto`
- `CreateShiftDto`, `UpdateShiftDto`, `AssignShiftDto` (validates `HH:mm` 24h format and effective dates)
- `CheckInDto`, `CheckOutDto`, `ScheduleAttendanceDto`, `AttendanceCorrectionRequestDto`, `ApproveCorrectionDto`, `RejectCorrectionDto`
- `CreateLeaveTypeDto`, `CreateLeavePolicyDto`, `AllocateLeaveDto`, `CreateLeaveRequestDto`, `ApproveLeaveRequestDto`, `RejectLeaveRequestDto`, `CancelLeaveRequestDto`

All DTOs strictly utilize `class-validator` and `class-transformer` to sanitize payloads before controller execution.

---

## 5. State Machine Invariants

### 5.1 Employee Lifecycle (`Employee.status`)
```text
DRAFT
  └──> ACTIVE
        ├──> ON_LEAVE ──> ACTIVE
        ├──> SUSPENDED ──> ACTIVE
        ├──> RESIGNED ──> TERMINATED
        └──> TERMINATED
```
- Direct arbitrary transitions rejected.
- Suspending/terminating an employee automatically sets the linked `User.status` to `INACTIVE`.
- Reinstating or activating an employee restores `User.status` to `ACTIVE`.

### 5.2 Attendance Lifecycle (`AttendanceLog.status`)
```text
SCHEDULED ──> CHECKED_IN ──> CHECKED_OUT ──> FINALIZED
```
- Backend owns all punch timestamps. Client-provided timestamps are ignored during live clocking.
- Duplicate check-ins per day are prevented atomically by `@@unique([employeeId, workDate])`.
- Finalized records cannot be mutated directly; mutations must proceed via `AttendanceCorrectionRequest`.

### 5.3 Leave Request Lifecycle (`LeaveRequest.status`)
```text
DRAFT ──> SUBMITTED ──> APPROVED (DEDUCTION) ──> CANCELLED (ADJUSTMENT)
                    └──> REJECTED
```
- Overlapping approved leaves are rejected.
- Balance validation queries the authoritative ledger before any status transition.

---

## 6. Authorization & Tenancy Isolation

- **Zero Trust on Frontend Identifiers**: Services never trust `req.body.organizationId` or `req.body.branchId`. The tenant identifier is securely derived from the authenticated JWT session (`CurrentUser.organizationId` / DB lookup).
- **Scope Hierarchy**:
  - `GLOBAL`: Full organization-wide access across all retail branches and the central factory.
  - `FACTORY`: Restricted to factory staff resources and production shifts.
  - `BRANCH`: Strictly filtered to the manager's assigned branch (`user.branchId`). Reassigning staff across branches or viewing cross-branch data throws `ForbiddenException`.
  - `ASSIGNED`: Restricted to self records; cannot approve leaves or corrections.

---

## 7. Idempotency & Concurrency Guarantees

All state mutations support deterministic idempotency via `IdempotencyRecord`:
- Repeated punch check-in with the same key returns the existing `AttendanceLog`.
- Repeated correction approval or leave approval returns the processed entity without executing double ledger deductions or emitting duplicate outbox events.
- Concurrency protection utilizes atomic Compare-And-Swap (`updateMany` with status guard) combined with PostgreSQL row locking (`SELECT ... FOR UPDATE`).

---

## 8. Audit Logging & Outbox Events

- **Audit Logs (`AuditLog`)**:
  - `EMPLOYEE_CREATED`, `EMPLOYEE_UPDATED`, `EMPLOYEE_STATUS_TRANSITION`, `EMPLOYEE_BRANCH_REASSIGNED`, `EMPLOYEE_DEPARTMENT_ASSIGNED`, `EMPLOYEE_DESIGNATION_ASSIGNED`
  - `DEPARTMENT_CREATED`, `DEPARTMENT_UPDATED`, `DESIGNATION_CREATED`, `DESIGNATION_UPDATED`
  - `SHIFT_MASTER_CREATED`, `SHIFT_MASTER_UPDATED`, `EMPLOYEE_SHIFT_ASSIGNED`
  - `ATTENDANCE_CHECK_IN`, `ATTENDANCE_CHECK_OUT`, `ATTENDANCE_FINALIZED`, `ATTENDANCE_CORRECTION_APPROVED`, `ATTENDANCE_CORRECTION_REJECTED`
  - `LEAVE_APPROVED`, `LEAVE_REJECTED`, `LEAVE_CANCELLED`
- **Transactional Outbox Events (`OutboxEvent`)**:
  - `hr.employee.created`
  - `hr.attendance.recorded`
  - `hr.attendance.corrected`
  - `hr.leave.approved`

---

## 9. Leave Ledger Source-of-Truth Reconciliation

- **Authoritative Ledger**: `LeaveTransaction` (`type: 'ACCRUAL' | 'DEDUCTION' | 'ADJUSTMENT'`).
- **Read Model**: `EmployeeLeaveBalance` is purely a synchronized projection.
- **Authority Invariant**: Balance availability during approval is evaluated exclusively via `SUM(LeaveTransaction.days)`. Cancelling an approved leave inserts an `ADJUSTMENT (+days)` transaction rather than performing raw mathematical overrides on the balance table.

---

## 10. Phase 3A Test Results (`apps/api/src/modules/hr/tests/`)

```text
PASS src/modules/hr/tests/employee.spec.ts (7.8s)
  Phase 3A — Employee Foundation Service Specification
    ✓ Gate 1: Should create a new Employee in DRAFT status with audit and outbox events
    ✓ Gate 2: Should reject duplicate employeeCode within the same organization
    ✓ Gate 3: Should enforce BRANCH scope isolation during creation and viewing
    ✓ Gate 4: Should strictly enforce Employee lifecycle state machine transitions

PASS src/modules/hr/tests/department-designation.spec.ts (6.5s)
  Phase 3A — Department & Designation Service Specification
    ✓ Gate 1: Should create, update, and list Departments with uniqueness protection
    ✓ Gate 2: Should create, update, and list Designations with pay grade levels

PASS src/modules/hr/tests/shift.spec.ts (6.9s)
  Phase 3A — Shift Service & Rostering Specification
    ✓ Gate 1: Should create ShiftMaster and assign effectively to Employee

PASS src/modules/hr/tests/attendance.spec.ts (7.1s)
  Phase 3A — Attendance Foundation Specification
    ✓ Gate 1: Should execute Check-In -> Check-Out -> Finalize lifecycle with backend timestamps
    ✓ Gate 2: Should execute Attendance Correction workflow and update log

PASS src/modules/hr/tests/leave.spec.ts (7.4s)
  Phase 3A — Leave Foundation & Ledger Source-of-Truth Specification
    ✓ Gate 1: Should allocate leave balance via LeaveTransaction ledger (ACCRUAL)
    ✓ Gate 2: Should execute full leave request workflow (DRAFT -> SUBMITTED -> APPROVED -> CANCELLED)

PASS src/modules/hr/tests/hr-concurrency.spec.ts (9.8s)
  Phase 3A — HR Concurrency & Race Condition Suite
    ✓ Gate 1: 100 simultaneous employee activation attempts -> Exactly 1 succeeds atomically
    ✓ Gate 2: 100 simultaneous attendance check-ins -> Exactly 1 valid check-in recorded
    ✓ Gate 3: 100 simultaneous attendance correction approvals -> Exactly 1 approval applied
    ✓ Gate 4: 100 simultaneous leave approvals for the SAME request -> Exactly 1 approval and 1 ledger deduction
    ✓ Gate 5: 100 simultaneous leave requests consuming limited balance -> No negative balance / no oversubscription

Test Suites: 6 passed, 6 total
Tests:       16 passed, 16 total
Snapshots:   0 total
Time:        13.205 s
```

---

## 11. Monorepo Quality Gate Matrix

| Quality Gate | Command | Status | Details |
| :--- | :--- | :---: | :--- |
| **Database TypeScript** | `npx tsc --noEmit` (`packages/database`) | 🟢 **PASS** | **0 errors** |
| **API TypeScript** | `npx tsc --noEmit` (`apps/api`) | 🟢 **PASS** | **0 errors** |
| **Monorepo Build** | `pnpm run build` | 🟢 **PASS** | **6/6 packages built cleanly** |
| **Monorepo Linting** | `pnpm run lint` | 🟢 **PASS** | **5/5 tasks passed** |
| **Full API Suite** | `pnpm run test` (`apps/api`) | 🟢 **PASS** | **28/28 suites passed, 112/112 tests passed** |

---

## 12. Schema Reconciliation & Deviations

- **Model Count**: Reconciled that `schema.prisma` contains 19 new HR/Payroll domain models and 6 domain enums (detailed in `docs/sprint11/PHASE_3A_SCHEMA_RECONCILIATION.md`).
- **Deviations**: None. All implementations adhere strictly to the Sprint 11 Architecture Contract.
- **Limitations / Stop Boundary**: Phase 3B/3C/3D/3E (Salary structures, Payroll calculation engine, Finance posting, Payslips) have not been started, respecting the mandatory Phase 3A stop condition.

---

## 🏆 Final Phase 3A Certification Decision

```text
==================================================
SPRINT 11 PHASE 3A — HR FOUNDATION HARDENING
STATUS: PASS 🟢
==================================================
```
