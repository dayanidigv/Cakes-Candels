# CAKES & CANDLES ERP - SECURITY THREAT MODEL

## 1. System Overview
Cakes & Candles ERP is a multi-tenant monorepo application built on NestJS and Prisma, supporting a factory, multiple branches, a storefront, POS terminals, and back-office modules (HR, Procurement, Finance, CRM). It processes sensitive operational, financial, and personal data.

## 2. Threat Actors
- **External Attackers:** Unauthenticated users attempting to exploit public endpoints, webhook receivers, or exposed storefront interfaces.
- **Malicious/Compromised Storefront Customers:** Authenticated customers attempting to manipulate pricing, inventory, or access other customers' PII.
- **Malicious Branch Employees (Cashiers, Drivers):** Authenticated staff attempting privilege escalation, fraudulent transactions, or cross-branch data access.
- **Malicious Internal Admins/Factory Workers:** Staff attempting to bypass separation of duties (e.g., approving their own payroll, mutating audit logs).
- **Compromised Integrations:** Exploitation via payment gateways or other third-party webhooks.

## 3. Trust Boundaries & Attack Surfaces
- **Public ↔ Web/API:** Storefront APIs, Login/OTP endpoints, and Payment Webhook receivers.
- **Branch POS ↔ Backend:** Branch terminals syncing offline data to the central DB.
- **Worker/Queue ↔ Database:** BullMQ workers executing background tasks (e.g., async financial postings).
- **Tenant ↔ Tenant:** Data sharing boundaries across multiple organizations sharing the same database.

## 4. Key Threats (STRIDE)
| Threat Category | Description | Examples in Architecture |
|-----------------|-------------|--------------------------|
| **Spoofing** | Faking identity or roles. | Bypassing JWT auth, exploiting hardcoded dev tokens (`x-dev-token`). |
| **Tampering** | Modifying data maliciously. | Modifying API requests to change order amounts, prices, or payroll data. |
| **Repudiation** | Denying performed actions. | Lack of robust audit logging for financial mutations or inventory adjustments. |
| **Information Disclosure** | Exposing sensitive data. | Error stack trace leakage, cross-tenant IDOR, leaking internal secrets. |
| **Denial of Service** | Exhausting resources. | Missing rate limits on OTP, login, or public search endpoints. |
| **Elevation of Privilege**| Gaining unauthorized rights. | Exploiting wildcard/regex flaws in role/permission evaluation logic. |

## 5. Critical Assets
- **Payment & Financial Data:** Order amounts, journal entries, payment gateway secrets.
- **Tenant / Branch Data:** Inventory stock balances, CRM records.
- **HR & Payroll Data:** Employee salaries, PII, and leave balances.
- **System Integrity:** Audit logs, outbox events.
