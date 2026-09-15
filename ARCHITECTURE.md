# CAKES & CANDLES - SYSTEM ARCHITECTURE

## 1. Overview

The Cakes & Candles platform is a production-grade multi-branch bakery ERP, CRM, and eCommerce system.
It strictly adheres to a **Modular Monolith** architecture using a PNPM Monorepo.

## 2. Monorepo Structure (apps/ & packages/)

```text
cakes-and-candles/
├── apps/
│   ├── api/             # NestJS single business brain
│   ├── web-storefront/  # Customer B2C React application
│   ├── web-pos/         # In-store Point of Sale application
│   ├── web-admin/       # Head Office / Factory Admin portal
│   ├── web-kds/         # Kitchen Display System
│   └── web-driver/      # Driver Dispatch mobile-friendly web app
├── packages/
│   ├── database/        # Prisma schema and generated client
│   ├── ui/              # Shared React components (Tailwind)
│   ├── business-rules/  # Shared core logic (Pricing, Demand)
│   └── api-client/      # Generated TS client for the API
└── infrastructure/      # Docker, queues, events configuration
```

## 3. Technology Stack

- **Backend**: NestJS, TypeScript, PostgreSQL, Prisma, BullMQ, Redis.
- **Frontend**: React, Vite, TailwindCSS, Zustand.
- **Infrastructure**: Docker, S3-compatible Object Storage.

## 4. Architectural Rules

1. **No Microservices (Yet):** Maintain clear domain boundaries within `apps/api/src/modules/*`.
2. **PostgreSQL is Truth:** Prisma is the ORM. Redis is for caching and queues only.
3. **Outbox Pattern:** Side-effects (CRM updates, emails, webhook callbacks) must be queued transactionally alongside database commits.
4. **Offline POS Sync:** The POS app has a local transaction queue and pushes to the backend using Idempotency Keys to prevent duplicate processing.
