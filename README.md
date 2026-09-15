# Cakes & Candles - Central ERP Platform

An enterprise-grade, monorepo-based ERP platform for Cakes & Candles operations. Built using Turborepo, NestJS (API module), React + Vite (Web frontends), and Prisma (PostgreSQL).

## Repository Architecture

```text
Cakes&Candels/
│
├── apps/
│   ├── api          # NestJS Bounded-Context API Monolith
│   ├── web-admin    # React Admin Panel
│   ├── web-pos      # React Point-of-Sale Register
│   └── web-kds      # React Kitchen Display System
│
├── packages/
│   ├── database     # Prisma Client, Models, and Repositories
│   ├── shared-ui    # Shared React component widgets (Buttons, etc.)
│   ├── shared-types # Shared TypeScript contracts and DTO mappings
│   ├── shared-config# Workspace constants and environment utilities
│   ├── shared-utils # Date helpers and math rounding engines
│   └── tsconfig     # Global compiler config rules
```

## Local Development Prerequisites

- **Node.js**: v22+
- **pnpm**: v11+
- **PostgreSQL**: v15 (Homebrew natively or via Docker compose)
- **Redis**: v7 (Homebrew natively or via Docker compose)

## Getting Started

1. **Install Dependencies**:
   ```bash
   pnpm install
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and fill in your connection details (PostgreSQL and Redis credentials).

3. **Verify/Run Database Migrations**:
   ```bash
   pnpm prisma migrate dev --schema=packages/database/prisma/schema.prisma --name init
   ```

4. **Seed Database**:
   ```bash
   export $(cat .env | xargs) && node packages/database/dist/seed/index.js
   ```

5. **Start Development Services**:
   ```bash
   pnpm dev
   ```
   - API runs on: `http://localhost:3000`
   - Admin Panel runs on: `http://localhost:5173`
   - POS Retail runs on: `http://localhost:5174`
   - Kitchen Display (KDS) runs on: `http://localhost:5175`

## System Integration Endpoints

- Health verification:
  - `GET http://localhost:3000/health` (Database connectivity indicators)
  - `GET http://localhost:3000/ready` (Readiness check)
  - `GET http://localhost:3000/live` (Liveness check)
- Authenticated login:
  - `POST http://localhost:3000/api/auth/login` (Body: `{"username": "admin", "password": "adminpassword"}`)
