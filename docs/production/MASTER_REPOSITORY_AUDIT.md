# MASTER REPOSITORY AUDIT
## Cakes & Candles ERP — Production Readiness Forensic Report
### Phase 0 Complete | Authored: 2026-09-07

---

## EXECUTIVE SUMMARY

The Cakes & Candles ERP monorepo is a serious, architecturally sound NestJS + Prisma + PostgreSQL system covering 12+ business domains. The backend contains sophisticated, production-grade patterns in its most mature areas (Finance, Inventory, HR/Payroll). However, a cluster of **critical production-blocking defects** exists primarily in the Sales/POS billing pipeline and the Logistics module that would cause **data loss or financial corruption** in a live environment. A significant structural "MVP bypass" in the central billing path actively skips stock enforcement and contains hardcoded variant ID checks. These must be resolved before any production deployment.

**Overall Production Readiness Score: 62 / 100**

---

## 1. REPOSITORY STRUCTURE MAP

```
/Cakes&Candels                          <- Monorepo root (pnpm + Turborepo)
├── apps/
│   ├── api/                            <- NestJS backend (AUTHORITY)
│   ├── web-admin/                      <- React + Vite admin panel
│   ├── web-storefront/                 <- React + Vite customer storefront
│   ├── web-pos/                        <- React + Vite POS terminal
│   └── web-kds/                        <- React kitchen display
├── packages/
│   ├── database/                       <- Prisma schema + client (PostgreSQL)
│   │   └── prisma/schema.prisma       <- 2,720 lines, 80+ models, 13 migrations
│   ├── shared-types/
│   ├── shared-constants/
│   ├── shared-ui/
│   ├── shared-utils/
│   ├── shared-config/
│   ├── eslint-config/
│   └── tsconfig/
├── database/schema.sql                 <- STALE legacy DDL (out of sync with Prisma)
├── docker-compose.yml                  <- Postgres 15 + Redis 7 + Adminer + Mailpit
├── turbo.json                          <- Turborepo pipeline
└── .github/workflows/ci.yml           <- GitHub Actions CI/CD
```

Backend source files: 314 TypeScript files | Test spec files: 60

---

## 2. DOMAIN COVERAGE INVENTORY

| Domain | Sprint | Status | Notes |
|---|---|---|---|
| Identity & Auth | 1 | MATURE | JWT, refresh tokens, lockout, history |
| Master Data | 2-2.5 | MATURE | Products, Variants, Tax, Recipes, UoM |
| Inventory Ledger | 3 | MATURE | Atomic, idempotent, immutable ledger |
| Production/Manufacturing | 5 | MATURE | Atomic state machine |
| Procurement | 6 | MATURE | PR -> PO -> GRN pipeline |
| Sales & Orders | 7 | PARTIAL | OrdersService sound; BillingService DEFECTIVE |
| CRM & Loyalty | 8-10 | PARTIAL | Wrong field reference breaks all LTV |
| HR & Payroll | 11 | MATURE | Full payroll cycle, payslips, leave |
| Finance / GL | 12 | MATURE | Double-entry engine, expense lifecycle |
| Logistics | - | DEFECTIVE | References non-existent Prisma models |
| POS | - | PARTIAL | Billing bypasses stock enforcement |
| KDS | - | MINIMAL | Frontend shell; no backend KDS routing |
| Notifications | - | PARTIAL | Models present; no dispatcher implemented |
| Reporting / Analytics | - | MISSING | No dedicated service |

---

## 3. CRITICAL DEFECTS (PRODUCTION-BLOCKING)

### DEFECT-001: Logistics Module References Non-Existent Schema Models
File: apps/api/src/modules/logistics/logistics.service.ts
The entire LogisticsService creates and queries prisma.dispatch and prisma.dispatchItem.
Neither model exists in schema.prisma. This will throw PrismaClientValidationError
on every logistics API call at runtime.

Additionally: processDispatchReceipt() uses { branchId } but StockBalance uses
{ locationId } as its FK field — wrong field name causing additional runtime errors.

Additionally: Stock is manipulated with raw updateMany(increment/decrement), bypassing
InventoryService.postTransaction entirely — no InventoryTransaction ledger entries created.

Fix Required:
1. Add Dispatch + DispatchItem models to schema.prisma + create migration
2. Route all inventory movements through InventoryService.postTransaction
3. Fix field name from branchId to locationId in all stock queries

### DEFECT-002: BillingService Bypasses Stock Enforcement
File: apps/api/src/modules/sales/billing/billing.service.ts (Lines 48-52, 121-124)

Stock check is silently bypassed with console.warn instead of throwing.
Hardcoded variantId checks ('1','2','3','4') skip stock deduction entirely.
This means POS can oversell inventory with no error and mock variants never deduct stock.

Fix Required:
1. Restore the BadRequestException for insufficient stock
2. Remove hardcoded variant ID bypass block entirely
3. Route stock deduction through InventoryService.postTransaction

### DEFECT-003: BillingController MVP Mock Bypass
File: apps/api/src/modules/sales/billing/billing.controller.ts (Lines 28-33)
Controller-level mock returns fake "success" without processing checkout.

### DEFECT-004: PricingService Contains MVP Mock Override
File: apps/api/src/modules/sales/orders/pricing.service.ts (Line 19)
Mock override in pricing resolution path for "Storefront demo" corrupts all order financials.

### DEFECT-005: CrmService Uses Wrong Field for Total Spend
File: apps/api/src/modules/crm/crm.service.ts (Line 54)
Queries { _sum: { totalAmount: true } } but SalesOrder has no 'totalAmount' field.
Correct field is 'grandTotal'. All customer LTV and segmentation returns 0.

### DEFECT-006: LoyaltyTransaction Type Inconsistency
crm.service.ts queries type:'EARNED' but billing.service.ts creates type:'EARN'.
These never match — loyalty balance calculations are always wrong.

### DEFECT-007: VoidRequest Stored as Pipe-Delimited String
File: apps/api/src/modules/sales/billing/billing.service.ts (Line 187)
Void requests stored in SalesOrder.notes as "VOID_REQUESTED|reason|userId|timestamp".
No structured model, no approval workflow record, no query capability.

### DEFECT-008: NumberSeries Race Condition
Files: orders.service.ts, production.service.ts
NumberSeries fetched and incremented without optimistic locking.
Under concurrent requests, duplicate order numbers can be generated.

### DEFECT-009: BillingService Has No GL Journal Entry Emission
POS checkout creates SalesOrder + Payment but never calls FinancePostingEngine.
Every POS sale is financially invisible — no Revenue, COGS, or Cash entries in GL.

### DEFECT-010: Payroll GL Posting Has No Independent Idempotency Guard
If payroll run succeeds but GL posting fails, system is left in half-posted state
with no structured recovery path.

---

## 4. SECURITY AUDIT

### Well-Implemented Controls
- JWT with 15-minute access token TTL
- HMAC-SHA256 webhook verification with timing-safe comparison
- Account brute-force lockout (configurable attempts + duration)
- Branch scope isolation via BranchScopeGuard
- Redis-cached permission checks (5-min TTL, DB fallback)
- Organization-scoped validation in posting engine
- Payment webhook idempotency via PaymentWebhookEvent
- Prisma parameterized queries (no SQL injection surface)
- Global ValidationPipe with whitelist:true
- Helmet headers + CORS + Rate limiting (throttler)

### Security Gaps

| Severity | Gap |
|---|---|
| CRITICAL | JWT_SECRET defaults to 'super_secret_key_for_dev_only' in .env in VCS |
| CRITICAL | PAYMENT_WEBHOOK_SECRET hardcoded default in payments.service.ts source |
| CRITICAL | JWT_REFRESH_SECRET absent from .env/.env.example — weak dev default |
| HIGH | .env committed to repository — must never reach VCS |
| HIGH | DevTokenGuard bypass not verified to be disabled in production |
| HIGH | AuditInterceptor falls back to DEV_BRANCH_ID '00000000-...' fake UUID |
| MEDIUM | No auth-specific rate limit on /auth/login, /auth/reset-password |
| MEDIUM | S3/WhatsApp tokens in env.example but no upload validation found |

---

## 5. DATABASE & SCHEMA AUDIT

### Data Integrity — Correct Patterns
- All monetary fields: @db.Decimal(12,2) or @db.Decimal(14,2)
- All PKs: @default(uuid()) @db.Uuid
- All master models: soft delete (deletedAt + deletedBy)
- All models: createdAt + updatedAt @updatedAt
- InventoryTransaction: immutable ledger (no UPDATE/DELETE)
- JournalEntry: totalDebit === totalCredit enforced in posting engine
- IdempotencyRecord + OutboxEvent models present

### Schema Gaps
| Severity | Issue |
|---|---|
| HIGH | database/schema.sql is stale — conflicts with Prisma schema |
| HIGH | Dispatch/DispatchItem models missing from schema.prisma |
| HIGH | StockBalance.locationId vs branchId mismatch in logistics service |
| MEDIUM | LoyaltyTransaction.type is String not enum |
| MEDIUM | Supplier.status is String not enum |
| MEDIUM | CrmActivity.activityType is String not enum |
| MEDIUM | Employee.phone has no @unique constraint |

---

## 6. CONCURRENCY & IDEMPOTENCY AUDIT

### Correctly Implemented
- InventoryService.postTransaction — atomic ledger + updateMany with version check
- InventoryService.receiveTransfer — IdempotencyRecord table
- ProductionService — atomic state machine via updateMany WHERE status='PLANNED'
- FinancePostingEngine — DB-level unique constraint on org+source+entityId+ref
- PaymentWebhookService — PaymentWebhookEvent unique + retry loop
- ExpenseService — idempotencyKey on Expense model
- PayrollRunService — idempotencyKey on PayrollRun

### Concurrency Issues
- NumberSeries increment: non-atomic findFirst + update without optimistic lock
- BillingService stock deduction: updateMany without row lock — negative stock possible
- LogisticsService stock: raw updateMany without lock

---

## 7. OUTBOX & EVENT INFRASTRUCTURE

OutboxEvent model exists and is populated by: Inventory, Production, Finance, Payments.
NOT populated by: Logistics, POS Billing, CRM automation.
NO outbox processor/dispatcher found in codebase.
Events accumulate but are never consumed — missing infrastructure component.

---

## 8. CI/CD AUDIT

| Step | Status |
|---|---|
| Checkout + Node 22 + pnpm | PASS |
| pnpm install --frozen-lockfile | PASS |
| Lint | PASS |
| Typecheck | BYPASSED (|| echo "Skipping") |
| Prisma migrate deploy | PASS |
| Unit Tests | BYPASSED (|| echo "Skipping") |
| Build | PASS |
| CodeQL SAST | PASS |
| Docker build | FAILS (no Dockerfile exists) |
| Trivy scan | PLACEHOLDER (echo only) |
| Deploy staging | PLACEHOLDER |

CI can pass with failing tests and type errors — gate bypasses must be removed.
No Dockerfile exists for any application.

---

## 9. TYPE SAFETY AUDIT

- 44+ files contain 'as any' casts
- logistics.service.ts and crm.service.ts cast entire Prisma client to 'any'
  (this is why non-existent 'dispatch' model wasn't caught at compile time)
- tsconfig.json strict mode not confirmed enabled
- CI typecheck is non-enforced

---

## 10. FRONTEND AUDIT

| App | Status | Issues |
|---|---|---|
| web-admin | Functional | No centralized API client; raw fetch() calls; App.tsx.backup (93KB) present |
| web-storefront | Not deeply audited | — |
| web-pos | Not deeply audited | — |
| web-kds | Minimal | No backend KDS routing service |

web-admin/src/api/ directory is empty — no centralized API client.
No React Query/SWR — no cache invalidation or optimistic updates.
No frontend permission enforcement (backend is correctly the authority).

---

## 11. PRIORITIZED REMEDIATION ROADMAP

### PHASE 1 — CRITICAL DEFECT RESOLUTION (Before any production traffic)
[P1-1] Remove all [MVP] bypasses in billing.service.ts + billing.controller.ts
[P1-2] Create Dispatch + DispatchItem + DispatchEvent models in schema.prisma
[P1-3] Rewrite LogisticsService using correct schema + InventoryService.postTransaction
[P1-4] Fix crm.service.ts: totalAmount -> grandTotal
[P1-5] Add LoyaltyTransaction.type as Prisma enum; fix all call sites
[P1-6] Remove .env from VCS; rotate all committed secrets
[P1-7] Fail fast at startup if PAYMENT_WEBHOOK_SECRET not set in production

### PHASE 2 — SECURITY HARDENING
[P2-1] Add JWT_REFRESH_SECRET, PAYMENT_WEBHOOK_SECRET, NODE_ENV to .env.example
[P2-2] Gate DevTokenGuard behind NODE_ENV !== 'production'
[P2-3] Fix AuditInterceptor to not use fake UUIDs as fallback
[P2-4] Add auth-specific rate limits on login/reset endpoints
[P2-5] Enable strict: true in all tsconfig.json files

### PHASE 3 — DATA INTEGRITY FIXES
[P3-1] Fix NumberSeries increment with optimistic locking
[P3-2] Add VoidRequest model and proper approval workflow
[P3-3] Add GL journal entry emission to BillingService.processCheckout
[P3-4] Add idempotent GL posting guard to payroll posting
[P3-5] Archive database/schema.sql — Prisma schema is authoritative

### PHASE 4 — OUTBOX PROCESSOR
[P4-1] Implement outbox event processor (polling/cron) for notification dispatch
[P4-2] Implement NotificationQueue dispatcher

### PHASE 5 — INFRASTRUCTURE
[P5-1] Write Dockerfile for apps/api (multi-stage)
[P5-2] Add application containers to docker-compose.yml
[P5-3] Remove || echo "Skipping" from CI typecheck and test steps
[P5-4] Replace placeholder Trivy with real aquasecurity/trivy-action

### PHASE 6-20 — FEATURE COMPLETION
Following defect remediation: KDS backend, centralized API client,
E2E test suite, Reporting service, multi-branch optimization,
logistics driver app, storefront hardening, performance tuning,
staging deployment, production certification.

---

## 12. FILES REQUIRING IMMEDIATE ACTION

| File | Action |
|---|---|
| apps/api/src/modules/sales/billing/billing.service.ts | Remove MVP bypasses; restore stock enforcement; add GL posting |
| apps/api/src/modules/sales/billing/billing.controller.ts | Remove mock bypass response |
| apps/api/src/modules/logistics/logistics.service.ts | Complete rewrite after schema migration |
| apps/api/src/modules/crm/crm.service.ts | Fix totalAmount->grandTotal; fix loyalty type |
| apps/api/src/modules/sales/orders/pricing.service.ts | Remove MVP mock override |
| apps/api/src/modules/sales/payments/payments.service.ts | Move webhookSecret to env-only |
| packages/database/prisma/schema.prisma | Add Dispatch/DispatchItem; convert string enums |
| .env | Rotate secrets; add to .gitignore immediately |
| .github/workflows/ci.yml | Remove "|| echo Skipping" gate bypasses |
| apps/web-admin/src/App.tsx.backup | Delete |

---

Audit completed: 2026-09-07
Overall Production Readiness Score: 62 / 100
Next Phase: Phase 1 Critical Defect Resolution
