# 🔐 FINANCE RBAC & AUTHORIZATION MATRIX
## Access Control, Scopes, and Role-Based Permissions

> **Sprint**: Sprint 12 — Finance & Accounting  
> **Status**: FROZEN (Phase 12.1)  
> **Classification**: Security & Access Control Contract  

---

## 1. Finance Permission Definitions

| Permission Code | Description | Scope Applicability |
| :--- | :--- | :--- |
| `finance:coa:read` | View Chart of Accounts and account balances | `GLOBAL`, `BRANCH` |
| `finance:coa:write` | Create, edit, and deactivate Chart of Accounts | `GLOBAL` |
| `finance:period:manage` | Open, close, and lock fiscal years and periods | `GLOBAL` |
| `finance:period:reopen` | Reopen a previously closed fiscal period | `GLOBAL` (Restricted) |
| `finance:journal:read` | View General Ledger journal entries and lines | `GLOBAL`, `BRANCH` |
| `finance:journal:post` | Post manual or automated journal entries | `GLOBAL` |
| `finance:journal:reverse` | Execute reversal of posted journal entries | `GLOBAL` |
| `finance:ap:read` | View supplier bills and payment history | `GLOBAL`, `BRANCH` |
| `finance:ap:create` | Enter supplier bills and payment vouchers | `GLOBAL`, `BRANCH` |
| `finance:ap:approve` | Approve supplier bills for payment | `GLOBAL` |
| `finance:expense:create` | Log branch operational expenses | `GLOBAL`, `BRANCH` |
| `finance:expense:approve` | Approve branch operational expenses | `GLOBAL`, `BRANCH` |
| `finance:register:open` | Open a POS cash register session | `BRANCH`, `ASSIGNED` |
| `finance:register:close` | Submit POS cash register for closing | `BRANCH`, `ASSIGNED` |
| `finance:register:approve` | Manager approval and variance sign-off | `GLOBAL`, `BRANCH` |
| `finance:reports:read` | View Trial Balance, P&L, Balance Sheet, Taxes | `GLOBAL`, `BRANCH` (Scoped) |
| `finance:audit:read` | View immutable financial audit trail and logs | `GLOBAL` |

---

## 2. Role-Based Access Matrix

| Role | Scope | COA Manage | Fiscal Periods | Post Journal | Reverse Journal | AP Bills | Expenses | POS Registers | Financial Reports | Audit Trail |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **SUPER_ADMIN** | `GLOBAL` | Full | Full (incl Reopen) | Full | Full | Full | Full | Full | Full Org | Full |
| **FINANCE_DIRECTOR** | `GLOBAL` | Full | Close / Open | Full | Full | Approve / Pay | Approve | Approve | Full Org | Full |
| **CHIEF_ACCOUNTANT** | `GLOBAL` | Read / Edit | Close | Full | Full | Create / Verify | Approve / Post | Approve | Full Org | Read |
| **BRANCH_MANAGER** | `BRANCH` | Read | ❌ None | ❌ None | ❌ None | View Branch | Create / Approve | Approve Till | Branch P&L | Branch |
| **CASHIER / STAFF** | `ASSIGNED` | ❌ None | ❌ None | ❌ None | ❌ None | ❌ None | Create (Petty) | Open / Submit | ❌ None | ❌ None |
| **EXTERNAL_AUDITOR** | `GLOBAL` | Read | ❌ None | ❌ None | ❌ None | Read Only | Read Only | Read Only | Full Org (Read) | Read Only |

---

## 3. Scope Guard Enforcement Invariants

1. **Organization Isolation**: All queries and mutations must filter by `req.user.organizationId`. No user may read or write across tenant boundaries.
2. **Branch Level Segmentation**:
   - Users with `BRANCH` scope querying `/finance/expenses` or `/finance/reports/branch-pnl` are restricted to their assigned `branchId`.
   - General Ledger summary rollups across multiple branches require `GLOBAL` scope.
3. **Guard Stack**: All Finance endpoints MUST apply:
   ```typescript
   @UseGuards(JwtAuthGuard, PermissionsGuard, BranchScopeGuard)
   ```
