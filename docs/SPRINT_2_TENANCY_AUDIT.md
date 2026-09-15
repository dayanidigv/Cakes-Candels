# SPRINT 2 TENANCY & REPOSITORY AUDIT MATRIX

| Repository / Service | Method | Target Resource | Org Scoped? | Branch Scoped? | Factory Scoped? | Authorization Source | Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CategoryService | create | Category | YES | NO | NO | Authenticated Context (`user.organizationId`) | PASS |
| CategoryService | findAll | Category | YES | NO | NO | Authenticated Context (`user.organizationId`) | PASS |
| CategoryService | findTree | Category | YES | NO | NO | Authenticated Context (`user.organizationId`) | PASS |
| CategoryService | findById | Category | YES | NO | NO | Authenticated Context (`user.organizationId`) | PASS |
| CategoryService | update | Category | YES | NO | NO | Authenticated Context (`user.organizationId`) | PASS |
| CategoryService | remove | Category | YES | NO | NO | Authenticated Context (`user.organizationId`) | PASS |
| ProductsService | create | Product & Variant | YES | NO | NO | Authenticated Context (`user.organizationId`) | PASS |
| ProductsService | findAll | Product | YES | NO | NO | Authenticated Context (`user.organizationId`) | PASS |
| ProductsService | findOne | Product | YES | NO | NO | Authenticated Context (`user.organizationId`) | PASS |
| ProductsService | update | Product | YES | NO | NO | Authenticated Context (`user.organizationId`) | PASS |
| ProductsService | remove | Product | YES | NO | NO | Authenticated Context (`user.organizationId`) | PASS |
| UomService | convert | UnitOfMeasure | YES | NO | NO | Authenticated Context (`user.organizationId`) | PASS |
| TaxRuleService | findAll | TaxRule | YES | NO | NO | Authenticated Context (`user.organizationId`) | PASS |
| SupplierService | findOne | Supplier | YES | NO | NO | Authenticated Context (`user.organizationId`) | PASS |
| RecipeService | findById | RecipeMaster | YES | NO | NO | Authenticated Context (`user.organizationId`) | PASS |
| StorageLocation | findByBranch | StorageLocation | YES | YES | NO | Authenticated Context (`user.branchId`) | PASS |
| NumberSeries | generateNext | NumberSeries | YES | YES | YES | Authenticated Context (`user.organizationId`) | PASS |

## Audit Methodology & Invariant Rules

1. **No Relying on Request Body**: Parameters `organizationId` and `branchId` supplied in HTTP bodies are strictly forbidden as authorization tokens. The NestJS `@CurrentUser()` decorator injects claims extracted directly from the verified JWT.
2. **Schema Invariants**: All master data tables enforce `organizationId UUID NOT NULL` linked via foreign key to `Organization.id`.
3. **Guard Hierarchy**: `JwtAuthGuard` -> `PermissionsGuard` -> `BranchScopeGuard` -> Service tenancy verification.
