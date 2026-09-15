# CAKES & CANDLES - RBAC & SECURITY

## 1. Roles

System supports explicit roles to map directly to operational functions:
`OWNER`, `FACTORY_MANAGER`, `BRANCH_MANAGER`, `CASHIER`, `DISPATCH_COORDINATOR`, `DRIVER`, `CRM_EXECUTIVE`, `HR`, `ACCOUNTANT`, `CHEF`.

## 2. Scopes

Roles map to access Scopes:

- `GLOBAL`: Full cross-branch access (e.g. OWNER).
- `FACTORY`: Access strictly to factory production operations.
- `BRANCH`: Access strictly isolated to a single assigned `branchId`.
- `ASSIGNED_RECORD`: Access only to explicitly assigned tasks (e.g. Driver's manifest).

## 3. Enforcement

- **`PermissionsGuard`**: Evaluates Route-Level metadata to ensure the User holds the correct generic permissions/roles.
- **`BranchScopeGuard`**: Intercepts requests handling a `branchId` parameter/payload and rejects the request if it does not match the user's assigned `branchId` (unless they have `GLOBAL` scope).

> **Never rely only on frontend route protection. Backend must enforce all authorization.**
