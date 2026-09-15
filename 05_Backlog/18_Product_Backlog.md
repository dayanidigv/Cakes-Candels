# 18. Product Backlog Specification (Jira-Ready)

This document contains the functional backlog, structured as Epics, Features, and User Stories with Acceptance Criteria to guide engineering sprints.

---

## Epic 1: Authentication & Access Control

### Feature: Role-Based Routing & Context Guard
* **Story ID**: `US-AUTH-01`
* **User Story**:
  ```text
  As a System Operator,
  I want to enter my credentials and be routed to my designated dashboard,
  So that I only see actions and data visibility grids aligned with my role.
  ```
* **Acceptance Criteria**:
  1. Entering invalid credentials triggers a `401 Unauthorized` response with clear warning text.
  2. Cashier role login redirects strictly to the `web-pos` application dashboard.
  3. Factory Manager role login redirects to the KDS/Planner dashboards.
  4. System audit log creates a row for every login attempt (success or fail).

---

## Epic 2: Product Catalog Master

### Feature: Pricing & Expiry Policies Registry
* **Story ID**: `US-CAT-01`
* **User Story**:
  ```text
  As the Business Owner,
  I want to configure custom base costs, branch retail prices, and expiry warnings per SKU,
  So that inventory and POS modules operate on synchronized data rules.
  ```
* **Acceptance Criteria**:
  1. Products can have distinct prices at Branch A vs. Branch B.
  2. Modifying a category's expiry warning offset applies downstream warnings for all items under that category.

---

## Epic 3: Inventory Governance

### Feature: Branch-to-Branch Stock Transfers
* **Story ID**: `US-INV-01`
* **User Story**:
  ```text
  As a Branch Manager,
  I want to request and log stock transfers to another branch,
  So that we can balance inventory and avoid product expiry.
  ```
* **Acceptance Criteria**:
  1. The transferring branch selects SKU, batch ID, and quantity.
  2. The system checks source stock levels and locks items as `PENDING_TRANSFER` (Stock Reservation created).
  3. The receiving branch manager must confirm incoming quantities before the transfer moves to `RECEIVED`.
  4. Discrepancy quantities must automatically write loss/wastage ledgers.

### Feature: Spoilage & Wastage Approvals
* **Story ID**: `US-INV-02`
* **User Story**:
  ```text
  As a Branch Cashier,
  I want to log a spoilage or damaged item,
  So that it is quarantined and audited for write-off approval.
  ```
* **Acceptance Criteria**:
  1. Quarantined stock immediately decrements live available stock balance, creating a `PENDING_WASTAGE` reservation block.
  2. The logged waste displays in the Owner's Wastage approval queue.
  3. Only the Owner (Sudha) or Super Admin can click "Approve Write-off".
  4. Approval triggers a compensating ledger write-down transaction (`WASTE_WRITE_OFF`) and clears the reservation block.

---

## Epic 4: POS Retail Commerce

### Feature: Offline Invoicing & Automatic Synchronization
* **Story ID**: `US-POS-01`
* **User Story**:
  ```text
  As a Branch Cashier,
  I want to compile carts and invoice customers when internet connectivity is down,
  So that register billing never halts.
  ```
* **Acceptance Criteria**:
  1. Local checkout processes invoice transactions and saves them to local IndexedDB tables.
  2. The system prints receipts locally and updates cached branch stock values.
  3. Service Worker detects connectivity and syncs local queue items to backend APIs via FIFO order.
  4. Mismatched inventory parameters (e.g. price locks) trigger validation indicators on the POS sync log.

---

## Epic 5: Custom Cake Pipeline

### Feature: Multi-Stage Custom Order Kanban
* **Story ID**: `US-CAKE-01`
* **User Story**:
  ```text
  As a Kitchen Decorator,
  I want to see custom cake orders organized on a drag-and-drop workflow pipeline,
  So that I can prioritize baking, decorating, and QC steps.
  ```
* **Acceptance Criteria**:
  1. Custom orders display as cards showing flavor specs, eggless tags, design references, and pickup times.
  2. Cards are drag-and-drop compatible through columns: `BOOKED`, `APPROVED`, `BAKING`, `DECORATING`, `QC`, `READY`.
  3. Dragging a card to `READY` automatically triggers the customer's ready WhatsApp template notification.
