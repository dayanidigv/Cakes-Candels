# Cakes & Candles ERP - Executive Summary & MVP Plan

This document serves as the high-level executive summary and MVP plan for the Cakes & Candles management team. It consolidates the technical specifications into a clear, business-focused execution plan.

---

## 1. Project Objectives
To replace disconnected branch registers and manual spreadsheets with a single, centralized Bakery ERP platform. The system will unify the **Central Factory (Pudupalayam)** and **6 Retail Branches** onto an active ledger to control margins, eradicate wastage, and coordinate production and delivery dispatch.

---

## 2. Recommended MVP Release Plan
To deliver immediate value and minimize deployment risk, the platform rollout is split into three phases:

```text
  +------------------------------------------------------------+
  |  RELEASE A: MVP CORE (Weeks 1 - 12)                        |
  |  - Secure Auth, Roles, and Branch Audits                  |
  |  - Product Catalog and Location-Specific Pricing          |
  |  - Immutable Stock Ledger and Branch-to-Branch Transfers   |
  |  - Spoilage Logging and Owner Wastage Approvals            |
  |  - Factory Recipe Master and Kitchen KDS touchscreens      |
  |  - POS Register (GST Invoicing, Cash drawer, Offline POS)  |
  +------------------------------------------------------------+
                                │
                                ▼
  +------------------------------------------------------------+
  |  RELEASE B: VERSION 2 (Weeks 13 - 18)                      |
  |  - Custom Cake orders Spec form and S3 reference uploads   |
  |  - Baking/Decorating drag-and-drop Kanban kitchen dashboard|
  |  - CRM dynamic customer segments and loyalty rules        |
  |  - Automated WhatsApp ready notifications & promo codes    |
  +------------------------------------------------------------+
                                │
                                ▼
  +------------------------------------------------------------+
  |  RELEASE C: VERSION 3 (Weeks 19 - 24)                      |
  |  - Expense Logs & Supplier Ledgers                        |
  |  - Employee Shift Scheduling & Attendance logs            |
  |  - Profitability Snapshots & Cost Center Margins           |
  +------------------------------------------------------------+
```

---

## 3. Project Estimates & Sizing

### Timeline & Team Scenarios

| Scenario | Development Duration | Team Size | Estimated Budget |
| --- | :---: | :---: | :---: |
| **Aggressive** | 18 Weeks | 5 Resources | $75,000 - $90,000 |
| **Realistic (Recommended)** | 24 Weeks | 7 Resources | $110,000 - $130,000 |
| **Conservative** | 30 Weeks | 8 Resources | $145,000 - $165,000 |

### Estimated Cloud Infrastructure Costs (Production)
* **RDS PostgreSQL Database (Multi-AZ)**: $120.00 / month
* **ECS app servers**: $180.00 / month
* **Redis cache & memory brokers**: $45.00 / month
* **S3 files hosting (ref images)**: $15.00 / month
* **Networking, CDN, DNS routing**: $90.00 / month
* **Total Estimated Cost**: **~$450.00 / Month**

---

## 4. Key Architectural Decisions
* **Ledger-first accounting**: Quantities are calculated dynamically from transactional ledger entries. There is no manual overriding of stock balances, guaranteeing a transparent audit trail.
* **POS Offline-first capability**: POS tablet registers automatically buffer transactions inside local IndexedDB tables if internet is lost, syncing with the cloud as soon as connection is recovered.
* **Asynchronous triggers**: Heavy calculations and WhatsApp messaging dispatch functions run asynchronously using background queues, maintaining fast POS response speeds under peak sales rushes.

---

## 5. Main Risks & Mitigation Strategies
1. **Branch Network Outages**: Solved via PWA POS client hosting with offline IndexedDB caches.
2. **Internal Inventory Shrinkage**: Addressed by blocking deletions, enforcing branch-isolation rules, and requiring manager-level approvals for wastage write-offs and transfer acknowledgments.
