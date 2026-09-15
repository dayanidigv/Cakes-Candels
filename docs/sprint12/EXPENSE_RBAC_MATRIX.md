# SPRINT 12.4 — EXPENSE RBAC & BRANCH SCOPE MATRIX

## 1. Permissions Taxonomy

| Permission Code | Description | Default Roles |
| :--- | :--- | :--- |
| `finance:expense:create` | Create draft expenses | `STORE_MANAGER`, `FACTORY_MANAGER`, `ACCOUNTANT`, `FINANCE_MANAGER`, `SUPER_ADMIN` |
| `finance:expense:submit` | Submit draft expenses for review | `STORE_MANAGER`, `FACTORY_MANAGER`, `ACCOUNTANT`, `FINANCE_MANAGER`, `SUPER_ADMIN` |
| `finance:expense:approve` | Approve submitted expenses | `FINANCE_MANAGER`, `BRANCH_AUDITOR`, `SUPER_ADMIN` |
| `finance:expense:reject` | Reject submitted expenses | `FINANCE_MANAGER`, `BRANCH_AUDITOR`, `SUPER_ADMIN` |
| `finance:expense:post` | Post approved expenses to GL | `ACCOUNTANT`, `FINANCE_MANAGER`, `SUPER_ADMIN` |
| `finance:expense:cancel` | Cancel unposted or reverse posted expenses | `FINANCE_MANAGER`, `SUPER_ADMIN` |
| `finance:expense:read` | View expenses and reports | `STORE_MANAGER`, `FACTORY_MANAGER`, `ACCOUNTANT`, `FINANCE_MANAGER`, `BRANCH_AUDITOR`, `SUPER_ADMIN` |

---

## 2. Resource Scope Enforcement

### 2.1 Scope Types
- **`GLOBAL` Scope** (`SUPER_ADMIN`, `FINANCE_MANAGER`, `FINANCE_DIRECTOR`):
  - Can view, approve, and post expenses across all branches in the organization.
- **`FACTORY` Scope** (`FACTORY_MANAGER`):
  - Can only create and view expenses incurred at factory facilities.
- **`BRANCH` Scope** (`STORE_MANAGER`, `BRANCH_CASHIER`):
  - Can only create and view expenses for their assigned `branchId`.
- **`ASSIGNED` Scope**:
  - Can only view expenses they personally created or submitted.

### 2.2 Cross-Branch Guarding
- Any attempt by a `BRANCH` scoped user to create or query an expense with a foreign `branchId` results in `403 Forbidden`.
- `BranchScopeGuard` automatically validates route parameters and payload bodies against `user.branchId`.
