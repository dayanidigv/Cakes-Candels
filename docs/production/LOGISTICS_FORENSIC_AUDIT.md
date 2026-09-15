# LOGISTICS DOMAIN — FORENSIC AUDIT (PHASE L0)

## Overview
This document represents the initial forensic audit of the `Logistics` domain for Cakes & Candles ERP, validating the structural, architectural, and security integrity of the domain prior to beginning Phase L1 implementation.

---

## 1. Logistics Models Found
**Database Schema:** `packages/database/prisma/schema.prisma`
* `Dispatch`
* `DispatchItem`

**Analysis:**
The domain currently uses `Dispatch` and `DispatchItem` directly without an intermediate `DispatchPlan`, `DistributionRequest`, or `Manifest` model.
`Dispatch` relies on `driverUserId` (which lacks a Prisma foreign-key relation to the `User`/`Driver` model, causing TypeScript inclusion errors) and `vehicleId` (which properly points to `Vehicle`). 
It points explicitly to `fromBranchId` and `toBranchId`, which forces Factory-to-Branch flows to pretend the Factory is a "Branch".

## 2. Logistics Services Found
**Backend Services:** `apps/api/src/modules/logistics/logistics.service.ts`

**Analysis:**
The service encompasses `createDispatch`, `advanceStatus`, `receiveDispatch`, `cancelDispatch`, and `getAllDispatches`. It acts as a monolith for all dispatch-related actions.
Critically, it handles `TRANSFER_IN` and `TRANSFER_OUT` via `InventoryService.postTransaction`, which is the correct integration point, but relies on a simplistic state machine (`STATUS_FLOW`). 

## 3. Logistics Controllers Found
**Backend Controllers:** `apps/api/src/modules/logistics/logistics.controller.ts`

**Analysis:**
The controller maps directly to the service but currently lacks extensive DTO validation pipes. It utilizes standard `req.user` injection.

## 4. Inventory Integration
`LogisticsService` correctly avoids direct Prisma mutations on `StockBalance` and defers to `InventoryService.postTransaction()` to record `TRANSFER_OUT` and `TRANSFER_IN`. 
However:
1. **TOCTOU Risk**: `createDispatch` intentionally defers stock availability checks. The `advanceStatus` (moving to `RECEIVED`) performs `TRANSFER_OUT` and `TRANSFER_IN` *simultaneously*, which means the inventory physically disappears from the source location *only when it reaches the destination*. This violates the `IN_TRANSIT` requirement!

## 5. Dispatch States
Current states: `PACKED`, `DISPATCHED`, `ON_THE_WAY`, `REACHED_BRANCH`, `RECEIVED`.
`CANCELLED` is an out-of-flow state.
There is no `DRAFT` or `PLANNED` state. The initial state is `PACKED`.

## 6. Source/Destination Relationships
Currently bound to `fromBranchId` and `toBranchId`. 
If a Factory distributes to a Branch, the Factory must be represented as a `Branch` in the database, breaking semantic purity.

## 7. Branch/Factory Authorization Path
(Recently patched in Phase 2.1). Prior to patching, there were severe BOLA/IDOR vulnerabilities allowing users to advance statuses or receive dispatches belonging to other branches. Authorization requires continuous enforcement of `AuthorizationContext`.

## 8. Direct Inventory Mutations
None identified *within* Logistics. It appropriately calls `InventoryService`.

## 9. Race Conditions
`advanceStatus` utilizes Prisma `updateMany` for Compare-And-Swap (CAS) to prevent concurrent status updates:
```typescript
const updateResult = await tx.dispatch.updateMany({
  where: { id: dispatchId, status: dispatch.status },
  ...
```
This protects against status progression races.

## 10. Missing Idempotency Boundaries
- `createDispatch` currently generates a random number logic: `(count + 1).toString().padStart(5, '0')`. This is highly vulnerable to concurrent generation conflicts and is not using a robust `NumberSeries`.
- No idempotency keys are supported by the `advanceStatus` or `receiveDispatch` endpoints.

## 11. Missing Audit/Outbox Events
- Outbox events (`logistics.dispatch.created`, `logistics.dispatch.received`) are generated, which is good.
- **Audit Logging is missing.** There are no calls to a unified `AuditLog` service like in `ExpenseService`.

## 12. API/UI Mismatch
UI assumptions suggest a need for a unified "Logistics Dashboard" with manifest tracking, but the API only exposes raw Dispatches.

## 13. Migration Issues
No immediate destructive migration issues found in Logistics. The tables are stable.

## 14. Test Gaps
Extensive gaps in:
- E2E transit tests.
- Concurrent dispatch generation.
- Adversarial tenant boundary access (though covered generally by Phase 2.1 isolation specs).

---

# LOGISTICS AUDIT STATUS:
**AMBER (CONDITIONAL PASS FOR REBUILD)**

### CRITICAL P0:
- **Inventory Transit Void**: `TRANSFER_OUT` and `TRANSFER_IN` happen *simultaneously* at the `RECEIVED` state. This means while a truck is driving for 3 hours, the source branch still mathematically holds the inventory, leading to massive double-selling risks. `TRANSFER_OUT` must occur when leaving the source (`DISPATCHED`).
- **Driver Relation Missing**: `driverUserId` has no foreign key to a `User` or `Driver` model in the Prisma schema.

### P1:
- **Number Series Generator**: Relies on `dispatch.count() + 1` which will fail under load.
- **Factory Ownership Semantics**: Hardcoded `Branch` relations prevent a clean `Factory -> Branch` physical model unless Factory is treated as a Branch.

### P2:
- **No Audit Trail**: Business mutations do not write to the central Audit log.
- **Missing Idempotency**: Mobile/Driver network retries could duplicate state transitions.

### ARCHITECTURAL DECISIONS:
- Introduce `IN_TRANSIT` as an explicit inventory ledger concept, or apply `TRANSFER_OUT` at `DISPATCHED` state, and `TRANSFER_IN` at `RECEIVED` state.
- Decouple Location semantics: Transition from `fromBranchId`/`toBranchId` to polymorphic `sourceLocationId`/`destinationLocationId` or define `Factory` within the identical Location abstraction.

### REQUIRED SCHEMA CHANGES:
- Map `driverUserId` to `User` or introduce a formal `Driver` model.
- Add `idempotencyKey` to `Dispatch`.

### REQUIRED BACKEND CHANGES:
- Split `advanceStatus` into discrete atomic methods: `dispatch()`, `markInTransit()`, `markArrived()`, `startReceiving()`, `receive()`.
- Add central `AuditLog` integration.

### REQUIRED TESTS:
- Concurrency test for dispatch creation (guaranteeing unique Dispatch Numbers).
- State transition validation tests.
- Transit E2E inventory tracking tests.
