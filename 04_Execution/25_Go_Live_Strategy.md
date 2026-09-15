# 25. Go-Live Strategy & Rollout Plan

This document details the transition strategy, data migrations steps, UAT validation, training plan, and fallback rollback measures for launching the Cakes & Candles ERP.

---

## 1. Phased Branch Rollout

To minimize operational disruption, the rollout utilizes a step-by-step branch onboarding model:

```text
               +-------------------------------------------------+
               |            PHASE 1: FACTORY DEPLOYMENT          |
               |  - Launch Recipe master and Production Planner  |
               |  - Activate KDS touchscreen panels in kitchen  |
               |  - Establish Factory finished goods baseline    |
               +-------------------------------------------------+
                                        │
                                        ▼
               +-------------------------------------------------+
               |             PHASE 2: PILOT BRANCH (1 Store)     |
               |  - Onboard Salem branch register POS           |
               |  - Validate live transfers from Factory        |
               |  - Verify local stock ledger audit accuracy     |
               +-------------------------------------------------+
                                        │
                                        ▼
               +-------------------------------------------------+
               |             PHASE 3: DUAL STORES (2 Stores)     |
               |  - Onboard Anna Nagar and Pudupalayam branches  |
               |  - Validate branch-to-branch stock transfers    |
               +-------------------------------------------------+
                                        │
                                        ▼
               +-------------------------------------------------+
               |             PHASE 4: CONSOLIDATED ROLLOUT       |
               |  - Onboard remaining retail branch registers    |
               |  - Decommission legacy registers and spreadsheets|
               +-------------------------------------------------+
```

---

## 2. Data Migration Strategy
Prior to go-live, static data must be extracted, cleansed, and loaded via SQL scripts:

* **Product Master**: Import category IDs, SKU codes, naming values, base costs, and retail prices from legacy files.
* **Suppliers Registry**: Import suppliers names, phone numbers, and active GSTIN metrics.
* **Customer Base**: Import customer details, dynamic segments, and base loyalty points balances.
* **Staff Roster**: Import employees files, phone credentials, and initial roles assignments.
* **Inventory Balance Baseline**: Conduct a physical count at the Factory and pilot store at midnight before go-live, seeding the initial `inventory_transaction` ledger balances.

---

## 3. UAT (User Acceptance Testing) Checklist
Before signing off on go-live, the following validations must pass:

* [ ] **Billing Verification**: POS creates, saves, prints thermal receipts, splits cash/UPI payments, and updates balances.
* [ ] **Transfers Verification**: Stock relocates from Factory $\rightarrow$ Branch, updating ledger transaction logs.
* [ ] **Production Verification**: Consolidation of indents automatically computes recipe explosions. KDS updates baking runs.
* [ ] **Logistics Verification**: Manifests lists lock dispatch quantities. Drivers deliver items successfully.
* [ ] **Reports Verification**: Executive dashboards update today's sales counters instantly.

---

## 4. User Training & Handover

* **Business Owner (Sudha)**: Training on reports, wastage write-off approvals, cash closed audits, and role permission overrides.
* **Store Cashiers**: Training on tablet POS Billing checkouts, customer lookups, and daily register reconciliations.
* **Branch Managers**: Training on transfers requests, stock ledger balances checks, and wastage logging.
* **Pastry Chefs**: Training on touchscreen KDS statuses updates and yield submission forms.
* **Logistics Drivers**: Mobile manifest validations.

---

## 5. Rollback & Fail-Safe Strategy
If critical ERP infrastructure crashes during launch:

1. **POS Failure**: POS terminals immediately activate Offline POS mode, continuing billing locally via IndexedDB. Cashiers continue register checkouts.
2. **Factory/Network Failure**: Kitchen staff fall back to manual recipe calculations using paper operations manuals.
3. **Database Corruption / Rollback**: 
   - De-activate ERP portal routing at DNS level.
   - Cashiers revert to paper invoice pads temporarily.
   - DevOps team restores DB to the previous night's 02:00 AM AWS RDS backup snapshot.
   - Once online, POS terminals automatically synchronize buffered offline IndexedDB checkouts.
