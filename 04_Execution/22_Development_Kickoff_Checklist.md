# 22. Development Kickoff Checklist

This document details the configuration requirements, access configurations, and acceptance gates for developers launching Sprint 0 of the Cakes & Candles ERP.

---

## 1. Repository Setup
* [ ] Create Git organization or repository named `cakes-candles-erp`.
* [ ] Configure branch protection rules (e.g. `main` requires peer reviews, blocking direct force pushes).
* [ ] Setup monorepo workspace configuration (Turborepo `turbo.json` or Nx configurations).
* [ ] Create project directories tree structure:
  - `apps/web-admin`
  - `apps/web-pos`
  - `apps/web-kds`
  - `apps/api`
  - `packages/shared-ui`
  - `packages/shared-types`

---

## 2. Environment Setup
Create a standardized `.env.example` at monorepo root containing:
```ini
# Core API Settings
PORT=4000
NODE_ENV=development

# Database URIs
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cakes_candles_erp?schema=public"
REDIS_URL="redis://localhost:6379"

# Security Secrets
JWT_ACCESS_SECRET="dev-access-secret-key-123"
JWT_REFRESH_SECRET="dev-refresh-secret-key-123"

# AWS S3 Storage Configs
AWS_S3_BUCKET_NAME="dev-cakes-candles-references"
AWS_REGION="us-east-1"
```

---

## 3. Database Setup
* [ ] Deploy local PostgreSQL instance using Docker (`docker-compose.yml`).
* [ ] Deploy local Redis instance using Docker (configured on port `6379`).
* [ ] Initialize Prisma / ORM models inside `@packages/database-client`.
* [ ] Run baseline SQL migration scripts to apply [06_Database_Design.md](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/02_Architecture/06_Database_Design.md).

---

## 4. Frontend Setup
* [ ] Initialize TailwindCSS variables under `packages/shared-ui` using design tokens from [12_UI_UX_Design_System.md](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/03_UI_UX/12_UI_UX_Design_System.md).
* [ ] Setup Vite or Next.js configurations for all 3 frontend apps.
* [ ] Configure global paths aliasing (`tsconfig.json` configurations).

---

## 5. Backend Setup
* [ ] Initialize NestJS project structure in `apps/api`.
* [ ] Configure global validation pipes and exception interceptors.
* [ ] Setup Prisma client service wrapper injection.

---

## 6. Design Assets
* [ ] Upload logo and assets to shared Google Drive or Figma project.
* [ ] Extract brand colors and fonts configurations guides.

---

## 7. Developer Access
* [ ] Grant access permissions for Figma UI design files.
* [ ] Add developer SSH keys to Git repositories.
* [ ] Setup AWS staging environment account access parameters.

---

## 8. Sprint 0 Acceptance Criteria
Before moving to Sprint 1, the following gates must be fully met and verified by the tech lead:

* [ ] **Monorepo Created**: Turborepo workspace compiles with zero dependency errors.
* [ ] **`web-admin` Runs**: Admin app boots up locally and renders static landing layouts.
* [ ] **`web-pos` Runs**: POS checkouts register dashboard boots locally.
* [ ] **`web-kds` Runs**: Kitchen touchscreen app dashboard boots locally.
* [ ] **`api` Runs**: Modular NestJS monolith server boots locally on port `4000`.
* [ ] **PostgreSQL Connected**: API server successfully logs connection status to local DB.
* [ ] **Redis Connected**: Message queues successfully initialize connections to Redis container.
* [ ] **Auth Module Skeleton Ready**: Auth endpoints return stub responses.
* [ ] **Shared UI Package Working**: Frontend apps import components from `packages/shared-ui` package.
* [ ] **First CI Pipeline Passing**: Merging to `main` triggers green checkmark on Github Actions check.
