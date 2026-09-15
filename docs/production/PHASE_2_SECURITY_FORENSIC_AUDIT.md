# CAKES & CANDLES ERP - SECURITY FORENSIC AUDIT (PHASE 2.0)

## Overview
This document represents the comprehensive security forensic audit and architecture assessment of the Cakes & Candles ERP repository. The goal is to identify structural and component-level vulnerabilities before initiating Phase 2.1 hardening.

---

## 1. Executive Summary
The system currently relies heavily on frontend-supplied context (e.g., passing `:id` via API routes without backend-enforced ownership) and has multiple critical authentication/authorization bypasses. The overall architecture is robust (NestJS, Prisma, strict typings), but the security implementation contains high-severity logical flaws that completely invalidate RBAC and Tenant Isolation.

**Status for Phase 2.1:** **GO** (Proceed with remediation according to the recommended execution order).

---

## 2. Findings by Category

### A. Authentication & Authorization Bypass (P0)
1. **Developer Token Backdoor (`x-dev-token`):**
   - **Location:** `apps/api/src/common/guards/dev-token.guard.ts` and `jwt-auth.guard.ts`
   - **Issue:** Hardcoded fallback `CC-Dev-Token-2026` grants instant `SUPER_ADMIN` privileges globally. While wrapped in `NODE_ENV === 'development'` checks, relying purely on the environment variable for production security is a P0 risk.
2. **Wildcard / String Inclusion Privilege Escalation:**
   - **Location:** `apps/api/src/common/guards/permissions.guard.ts`
   - **Issue:** `p.toLowerCase().includes('admin')` automatically bypasses all permission checks. Any user with a role like `"READ_ONLY_ADMIN"` or `"NOT_AN_ADMIN"` instantly receives global super-admin permissions. 

### B. Tenant & Branch Isolation (IDOR / BOLA) (P0)
1. **Missing Backend Ownership Checks:**
   - **Location:** `apps/api/src/modules/sales/customers/customers.service.ts` (and likely others).
   - **Issue:** Controllers pass `id` directly to services. The services fetch/update/delete records using `prisma.customer.findUnique({ where: { id } })` without enforcing `organizationId` or `branchId` from the authenticated user's JWT payload.
2. **Global Query Leakage:**
   - **Location:** `CustomersService.findAll()`
   - **Issue:** Fetches all customers across the entire database, disregarding tenant isolation.

### C. Database / Prisma Security (P1)
1. **Unsafe Raw SQL Execution:**
   - **Location:** `apps/api/src/modules/hr/services/leave.service.ts` (Line 294)
   - **Issue:** Usage of `await tx.$executeRawUnsafe(...)` instead of `$executeRaw` or `$queryRaw` for pessimistic locking. While parameters are passed, the use of the `Unsafe` variant disables Prisma's template literal guarantees and poses a high risk if the query string is ever made dynamic.

### D. Input Validation (P2)
1. **Mass Assignment Risk:**
   - **Location:** `apps/api/src/main.ts`
   - **Issue:** The global `ValidationPipe` uses `whitelist: true` but omits `forbidNonWhitelisted: true`. Attackers can send arbitrary properties that may be inadvertently saved if DTOs are mapped loosely (e.g., `Object.assign()`).

---

## 3. Recommended Remediation Order (Phase 2.1 -> 2.10)

1. **Phase 2.1 (Auth & Authz):** Eliminate `DevTokenGuard` and the `x-dev-token` bypass in JWT. Fix the string inclusion bug (`.includes('admin')`) in `PermissionsGuard`. Enforce strict exact-match or hierarchical RBAC checks.
2. **Phase 2.2 (Tenant Isolation):** Audit and rewrite all generic REST endpoints (Customers, Orders, Employees) to append `organizationId` and `branchId` to all Prisma `where` clauses (e.g., `where: { id, organizationId: user.organizationId }`).
3. **Phase 2.3 (Prisma/DB Security):** Replace all instances of `$executeRawUnsafe` with `$executeRaw` or parameterized ORM calls.
4. **Phase 2.4 (Validation):** Enable `forbidNonWhitelisted: true` globally and explicitly define all allowed DTO properties.
5. **Phase 2.5+:** Follow the master plan for web security, secrets management, rate limiting, and adversarial testing.
