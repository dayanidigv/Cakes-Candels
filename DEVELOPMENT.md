# CAKES & CANDLES - DEVELOPMENT GUIDE

## 1. Local Setup

Ensure you have PNPM and Docker installed.

```bash
# 1. Install dependencies
pnpm install

# 2. Start Infrastructure (PostgreSQL, Redis, Adminer, Mailpit)
docker-compose up -d

# 3. Apply Prisma Schema
cd packages/database
npx prisma generate
npx prisma db push --accept-data-loss

# 4. Start Development Servers
cd ../../
pnpm dev
```

## 2. Definition of Done

A feature is NOT DONE unless:

- [ ] Database migrated & Prisma generated
- [ ] Seed data created
- [ ] API routes and strict DTO validation implemented
- [ ] Authorization / Branch scope enforced via Guards
- [ ] Immutable Ledgers populated using transactions
- [ ] Idempotency implemented for any async callback/sync
- [ ] Outbox events emitted for side-effects
- [ ] Unit, Integration, and E2E tests written and passing
- [ ] Linting, Typechecking, and Build succeed

> **Never compromise data integrity for implementation convenience.**
