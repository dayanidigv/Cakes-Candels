# 21. Backend Task Breakdown

This document defines the developer task list for building the Cakes & Candles NestJS-based modular monolith backend API.

---

## Critical Build Order
Backend features must be developed and validated in the following sequence to guarantee database ledger stability:

```text
1. Auth & Encryption
   ↓
2. Users / Roles / Branches (Admin contexts)
   ↓
3. Products (SKU Masters & Catalog)
   ↓
4. Inventory Ledger (Immutable transactions engine)
   ↓
5. Stock Balances (Cached values trigger hooks)
   ↓
6. Production Planning & Runs (Factory kitchen)
   ↓
7. POS Billing (Sales registers & checkouts)
```
> [!IMPORTANT]
> **Operational Constraint**: Do not build CRM, Custom Cakes, or automated campaign marketing APIs until the core inventory ledgers and POS billing engines are 100% stable and load-tested.

---

## 1. NestJS Project Setup
* [ ] Initialize NestJS monorepo (`@nestjs/cli`).
* [ ] Configure compiler paths (`tsconfig.json`) and environments (`@nestjs/config`).
* [ ] Setup message broker (BullMQ NestJS module wrapper) and Redis client connections.
* [ ] Configure global validation pipes (`class-validator`) and logging filters.

---

## 2. Database Modules
* [ ] Setup Prisma ORM (or TypeORM) linking PostgreSQL.
* [ ] Configure Prisma schemas mapping all 37 database tables.
* [ ] Deploy PostgreSQL schema migrations (`prisma migrate dev`).
* [ ] Write seed scripts to populate base Roles, System Admin, and Company settings.

---

## 3. Auth & RBAC Modules
* [ ] Build `AuthModule` containing local login passport strategies.
* [ ] Deploy JWT access token signature and verify guards (`@nestjs/jwt`).
* [ ] Configure `@Roles()` decorator and `RolesGuard` to parse permissions arrays from request tokens.
* [ ] Write global audit middleware capturing write actions to write-audit tables.

---

## 4. Product API Module
* [ ] Build `ProductModule` and controller endpoints (`POST /products`, `GET /products`).
* [ ] Setup location-specific pricing schemas and override validations.
* [ ] Build catalog soft-delete hooks setting `is_active` to false.

---

## 5. Inventory Ledger Module
* [ ] Build `InventoryModule` controlling `inventory_transaction` inserts.
* [ ] **Immutable Ledger Constraint**: Restrict SQL updates/deletes on transaction rows.
* [ ] Configure PostgreSQL database triggers to calculate and cache balances in `stock_balance` tables.
* [ ] Build branch transfers endpoints (`POST /inventory/transfers`).

---

## 6. POS Module
* [ ] Build `POSModule` managing checkout endpoints (`POST /retail/orders`).
* [ ] Configure tax splitting calculation filters (CGST/SGST).
* [ ] Build shifts cash drawer checking endpoints (`PATCH /finance/cash-registers/:id/close`).

---

## 7. Manufacturing Module
* [ ] Build `ManufacturingModule` managing recipe registers and daily indents consolidation.
* [ ] Enforce the 18:00 cut-off business rule inside planning triggers.
* [ ] Deploy production runs queue endpoints and QC yield submissions.

---

## 8. Logistics Module
* [ ] Build `LogisticsModule` managing vehicle/driver statuses.
* [ ] Deploy manifests compiler and branch receipt verify endpoints.

---

## 9. CRM Module
* [ ] Build `CRMModule` managing customer timelines and loyalty point adjustments.
* [ ] Integrate WhatsApp Business API gateways.
* [ ] Setup daily cron jobs scanning birthdays and anniversaries to trigger templates messages.

---

## 10. Backend Testing Tasks
* [ ] Write database integrity tests verifying that updates or deletes on ledger tables are blocked.
* [ ] Deploy unit tests with Vitest targeting recipe explosions and tax calculators.
* [ ] Setup integration E2E tests validating a complete flow (purchasing ingredients -> cooking batch -> POS checkout).
