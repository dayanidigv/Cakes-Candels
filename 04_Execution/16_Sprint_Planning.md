# 16. Sprint Planning Specification

This document translates the conceptual roadmap into an executable engineering sprint timeline. It structures tasks into focused 1-to-2 week cycles, defining deliverables, outcomes, milestones, and resource counts.

---

## 1. Sprint Schedule (Execution Plan)

### Sprint 0 (Infrastructure Setup)
* **Duration**: 1 Week
* **Modules & Tech**:
  - Monorepo Setup (Turborepo + apps/packages separation)
  - CI/CD Pipelines (Github Actions configuration)
  - PostgreSQL & Redis Docker Compose containers setup
  - Local Dev and AWS environments instantiation
  - RBAC baseline database models setup
* **Outcome**: Developers can pull, run, and commit codebase updates safely with standard environments.

---

### Sprint 1 (Authentication & Organization)
* **Duration**: 2 Weeks
* **Modules & Tech**:
  - Authentication (JWT auth, token refresh middleware)
  - User registries, Roles, and Permission guards
  - Branch location models (Factory and 6 stores)
  - Database-trigger audit log trackers
* **Outcome**: Secure user login, role-based layout routing, and transaction audit trails functional on admin endpoints.

---

### Sprint 2 (Product Master Catalog)
* **Duration**: 1 Week
* **Modules & Tech**:
  - Product Categories registers
  - Product masters, pricing records per location, and expiry policies
* **Outcome**: Centralized SKU catalog available for stock planning and sales.

---

### Sprint 3 (Inventory Ledger Core)
* **Duration**: 2 Weeks
* **Modules & Tech**:
  - Immutable `inventory_transaction` logic
  - Trigger-consolidated `stock_balance` tables
  - Branch transfer request, dispatch, and receipt pipelines
  - Discrepancies adjustment ledgers
* **Milestone**: **Inventory becomes the absolute source of truth** across all locations.

---

### Sprint 4 (Expiry & Wastage Governance)
* **Duration**: 1 Week
* **Modules & Tech**:
  - Expiry Engine (Warning rules alerts triggers)
  - Wastage Workflow (Logging, manager review, Owner approvals quarantine)
  - Product conversion engine (Slice-cake decompositions triggers)
* **Outcome**: Nearing-expiry items easily tracked, logged as wastage, or converted to piece cakes.

---

### Sprint 5 (Manufacturing core)
* **Duration**: 2 Weeks
* **Modules & Tech**:
  - Recipe master formulation registries
  - Production indents consolidator
  - Daily Production Plans & Runs
  - Actual Yield records & Quality checks
* **Outcome**: Bakery kitchens can manage runs and audits through the backend.

---

### Sprint 6 (Kitchen Display System - KDS)
* **Duration**: 1 Week
* **Modules & Tech**:
  - `web-kds` frontend client
  - WebSockets / SSE channels triggers for production runs
  - Touchscreen UI layouts for chefs
* **Outcome**: Real-time kitchen task display active for decorators and pastry chefs.

---

### Sprint 7 (POS Billing Register)
* **Duration**: 2 Weeks
* **Modules & Tech**:
  - `web-pos` checkout layouts
  - Tax (GST) automated splits calculator
  - Payments processing (UPI, cash, card, splits)
  - Thermals printer client driver
* **Milestone**: **First revenue-generating billing workflow live at stores**.

---

### Sprint 8 (Offline POS Sync Engine)
* **Duration**: 1 Week
* **Modules & Tech**:
  - Local IndexedDB store
  - Service Worker sync cron checks
  - Local stock reservations logic
  - Sync conflict resolver hooks
* **Outcome**: POS register continues checkouts when offline, syncs changes automatically when online.

---

### Sprint 9 (Logistics & Manifests)
* **Duration**: 1 Week
* **Modules & Tech**:
  - Dispatch manifest builders
  - Vehicle & driver assignments registries
  - Delivery verification & branches receipt checklist
* **Outcome**: Logistics coordinator tracks vehicle transits and limits branch transfer losses.

---

### Sprint 10 (CRM & Marketing Engines)
* **Duration**: 2 Weeks
* **Modules & Tech**:
  - Customer 360 registries
  - Loyalty point allocations triggers
  - WhatsApp Business API connector
  - Birthday campaigns templates dispatcher
* **Outcome**: Automated birthday and anniversary promo flows trigger over WhatsApp.

---

### Sprint 11 (Custom Cakes Mini-Projects)
* **Duration**: 2 Weeks
* **Modules & Tech**:
  - Custom specifications intake form
  - Image files uploads (S3 integrations)
  - Baking & Decorating Kanban dashboards
  - Pickups scheduler and WhatsApp notifications
* **Outcome**: Custom cake pipeline visualized via drag-and-drop Kanban, syncing kitchen and front counter staff.

---

### Sprint 12 (Finance & HR Operations)
* **Duration**: 2 Weeks
* **Modules & Tech**:
  - Expense category managers
  - Supplier Ledgers & payments releasing triggers
  - Employees shifts schedulers
  - Clock-in attendance registries & Leave approvals
* **Outcome**: Store managers track staff shifts and log daily registers closing, accounting for petty expenses.

---

### Sprint 13 (Owner Reporting & Analytics)
* **Duration**: 1 Week
* **Modules & Tech**:
  - Consolidated KPI Snapshots
  - Executive Dashboard widgets (Sales, Waste, Margins)
  - Exports systems (CSV, PDF, Excel)
* **Outcome**: Owner (Sudha) reviews consolidated reports, margins, and branch waste ratios.

---

### Sprint 14 (Hardening & Delivery)
* **Duration**: 2 Weeks
* **Modules & Tech**:
  - Bug fixes & regression reviews
  - Load testing POS sync and KDS streams
  - End-to-end UAT reviews with Owner and managers
* **Outcome**: Complete platform stable and ready for production go-live rollout.

---

## 2. Resource Planning Matrix

To execute this 24-week timeline, we require the following dedicated project team structure:

| Role | Count | Responsibilities | Allocation |
| --- | :---: | --- | --- |
| **Product Manager** | 1 | Epics definitions, UAT sign-offs, sprint backlog | Full-Time |
| **UI/UX Designer** | 1 | Component Design System, high-fidelity wireframes | Full-Time |
| **Frontend Developer** | 2 | Monorepo implementation, POS, KDS, Admin apps | Full-Time |
| **Backend Developer** | 2 | PostgreSQL architecture, APIs endpoints, message queues | Full-Time |
| **QA Engineer** | 1 | Automation tests, billing accuracy check, API audits | Full-Time |
| **DevOps Engineer** | 1 | Docker, CI/CD, AWS host infrastructure, backups | Part-Time |
