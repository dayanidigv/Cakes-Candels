# PHASE 2.1 RESOURCE AUTHORIZATION MATRIX

## Overview
This matrix defines the authoritative ownership and authorization rules for security-sensitive entities within the Cakes & Candles ERP. It establishes how `AuthorizationContext` values (`organizationId`, `branchId`, `scope`) must be validated.

### 1. Tenancy Model
The system operates as a single central factory supplying multiple wholly-owned branches.
**Hierarchy:** `Organization` -> `Factory (LocationType)` -> `Branch` -> `Resource`

---

## 2. Entity Ownership Matrix

| Entity | Canonical Owner | Organization Source | Branch / Factory Source | Allowed Scope Access |
|---|---|---|---|---|
| **User** | Branch / Org | `User.organizationId` | `User.branchId` | `GLOBAL`: Read/Write all org users. `BRANCH`: Read/Write own branch users. |
| **SalesOrder** | Branch | `SalesOrder.organizationId` | `SalesOrder.branchId` | `GLOBAL`/`FACTORY`: Read all org orders. `BRANCH`: Read/Write own branch orders. |
| **Dispatch** | Branch (From/To) | `Dispatch.organizationId` | `Dispatch.fromBranchId` / `toBranchId` | `GLOBAL`/`FACTORY`: Read/Write all. `BRANCH`: Read/Write if `fromBranchId` or `toBranchId` matches. |
| **StockBalance** | Branch | `Branch.organizationId` (implicit) | `StockBalance.branchId` | `GLOBAL`: Read all. `FACTORY`: Read all. `BRANCH`: Read/Write own branch stock. |
| **Expense** | Branch | `Expense.branchId -> Branch.organizationId` | `Expense.branchId` | `GLOBAL`: Read/Write all. `BRANCH`: Read/Write own branch expenses. |
| **Employee** | Branch | `Employee.branchId -> Branch.organizationId`| `Employee.branchId` | `GLOBAL`: Read/Write all. `BRANCH`: Read own branch employees. |
| **Customer** | Organization | `Customer.organizationId` (or Global if null) | N/A | `GLOBAL`/`FACTORY`/`BRANCH`: Read all org customers. Write based on specific permissions. |
| **JournalEntry** | Organization | `JournalEntry.organizationId` (implicit via branch/account) | N/A | `GLOBAL`: Read/Write all org journals. `BRANCH`: Denied (Finance team only). |
| **PurchaseOrder**| Factory | `PurchaseOrder.factoryId -> Branch.organizationId` | `PurchaseOrder.factoryId` | `GLOBAL`/`FACTORY`: Read/Write. `BRANCH`: Denied. |
| **ProductionOrder**| Factory | `ProductionOrder.factoryId -> Branch.organizationId` | `ProductionOrder.factoryId` | `GLOBAL`/`FACTORY`: Read/Write. `BRANCH`: Denied. |

---

## 3. Scope Evaluation Rules

### `GLOBAL` Scope
- **Tenancy:** Bounded strictly to `ctx.organizationId`.
- **Branch Limitation:** Unrestricted across all branches/factories within the organization.
- **Enforcement:** `where: { organizationId: ctx.organizationId }` or relational equivalent.

### `FACTORY` Scope
- **Tenancy:** Bounded strictly to `ctx.organizationId`.
- **Branch Limitation:** Allowed unrestricted access to factory-owned resources. For branch-owned resources, access is limited to downstream operations (e.g., dispatching to branch).
- **Enforcement:** `where: { factoryId: ctx.factoryId }` or contextual checks.

### `BRANCH` Scope
- **Tenancy:** Bounded strictly to `ctx.organizationId`.
- **Branch Limitation:** Bounded strictly to `ctx.branchId`.
- **Enforcement:** `where: { branchId: ctx.branchId }`.

### `ASSIGNED` Scope
- **Tenancy:** Bounded strictly to `ctx.organizationId`.
- **Ownership:** Bounded strictly to `ctx.userId` (e.g., SalesRep reading their own leads).
- **Enforcement:** `where: { assignedToId: ctx.userId }`.

---

## 4. Query Safety Guidelines
1. **Never authorize using only the UUID.** E.g., `prisma.salesOrder.update({ where: { id } })` is strictly forbidden.
2. **Explicit Organization:** If the entity has an `organizationId`, append it: `where: { id, organizationId: ctx.organizationId }`.
3. **Implicit Organization:** If the entity derives tenancy from a branch, validate the branch: `where: { id, branch: { organizationId: ctx.organizationId } }`.
4. **Branch Scope Enforcement:** If `ctx.scope === 'BRANCH'`, append `branchId: ctx.branchId` to all relevant queries.
