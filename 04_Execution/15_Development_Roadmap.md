# 15. Development Roadmap Specification

This document defines the business-value driven rollout roadmap for the Cakes & Candles ERP platform. The sequence focuses on establishing transactional security and inventory accounting before layering on billing, logistics, and automated CRM triggers.

---

## Phase 0 — Foundation (Timeline: 2 Weeks)
* **Goal**: Establish the structural platform bounds, roles, locations, and audit engines.
* **Modules Included**:
  - Authentication (JWT login / refresh cycles)
  - RBAC (Permission Guards and role profiles)
  - Organization (Company configs)
  - Branch Management (Central factory and 6 stores registries)
  - User Management
  - System Audit Logs (Trigger-based log engines)
* **Deliverables**: Users can authenticate securely and access layout portals tailored to their operational roles.

---

## Phase 1 — Core Inventory ERP (Timeline: 4 Weeks)
* **Goal**: Establish the stock ledger as the absolute source of truth for stock assets.
* **Modules Included**:
  - Product Master (SKU catalogs, pricing, categories)
  - Inventory Ledger (Immutable double-entry log)
  - Stock Balances (Consolidated read-caches)
  - Stock Transfers (Quarantine, dispatch, and accept actions)
  - Expiry Management (Alerts generation)
  - Wastage Management (Waste logging forms)
  - Product Conversions (Whole cake to slice decompositions)
* **Deliverables**: Factory managers and branch operators can track real-time stock balances and register adjustments with zero requirement ambiguity.

---

## Phase 2 — Factory Manufacturing (Timeline: 3 Weeks)
* **Goal**: Digitize the Central Factory recipe explosion and daily kitchen batch runs.
* **Modules Included**:
  - Recipe Management (Ingredential compositions lists)
  - Production Planning (Branch indent consolidations)
  - Production Runs (Batch job instantiations)
  - Yield Tracking (Expected vs actual output logs)
  - Quality Control (QC pass/fail gates)
  - Kitchen Display System (KDS touchscreen interface)
* **Deliverables**: Central Factory operates kitchen flows completely through the ERP, eliminating manual ingredient calculation errors.

---

## Phase 3 — Retail POS Commerce (Timeline: 4 Weeks)
* **Goal**: Modernize branch retail checkout registers and shift closures.
* **Modules Included**:
  - POS Register (Cart, items scanner)
  - Invoices (GST compliance rendering)
  - Payments (UPI QR, Card, Cash splits)
  - Customer Lookup (POS inline panel check)
  - Daily Closing (Cash register balances audit)
  - POS Offline Mode (IndexedDB buffer queues)
* **Deliverables**: Stores can bill customers under volatile connectivity states and verify shift register balances.

---

## Phase 4 — Logistics & Dispatch (Timeline: 2 Weeks)
* **Goal**: Establish complete visibility over materials transit.
* **Modules Included**:
  - Dispatch Sheets (Manifest builders)
  - Transit Tracking (Load statuses)
  - Delivery Confirmations (Branch receipt verification)
  - Vehicle & Driver Registries
* **Deliverables**: Factory dispatch sheets map out loads cleanly, reducing transit variance and shrinkage.

---

## Phase 5 — CRM & Loyalty Automation (Timeline: 3 Weeks)
* **Goal**: Connect checkout behaviors to automated retention campaigns.
* **Modules Included**:
  - Customer Profiles (360-degree transaction query)
  - Customer Segments (Bronze, Silver, Gold, VIP rules)
  - Loyalty Ledger (Points accruals/redemptions)
  - WhatsApp Campaign Manager
  - Birthday & Anniversary Automations
* **Deliverables**: Marketing team can execute segment-targeted automated message runs.

---

## Phase 6 — Custom Cake Workflows (Timeline: 3 Weeks)
* **Goal**: Track complex custom design cake runs as mini-projects.
* **Modules Included**:
  - Custom Cake Orders Form
  - Design Uploads Manager (S3 uploads)
  - Production Pipeline Board (Baking/Decorating drag-and-drop Kanban)
  - Delivery / Pickup Scheduler
* **Deliverables**: High-margin custom order progress is traceable in the kitchen and branch, with auto-notifications on ready states.

---

## Phase 7 — Finance & HR Admin (Timeline: 3 Weeks)
* **Goal**: Digitize overhead tracking, supplier payables, and workforce metrics.
* **Modules Included**:
  - Supplier Ledgers
  - Branch Expense Manager (Petty cash logs)
  - Cost Center P&Ls
  - Employee Registers
  - Attendance Logs (Punch audits)
  - Shift Planners
  - Leave Records & Payroll references
* **Deliverables**: Accountants can manage vendor payables and compile workforce shifts in sync with payroll metrics.

---

## Phase 8 — Analytics & Optimization (Timeline: 2 Weeks)
* **Goal**: Consolidate KPI metrics dashboards for executive planning.
* **Modules Included**:
  - Owner Executive Dashboard (Real-time charts widgets)
  - P&L Profitability Analytics
  - Wastage Audit Dashboards
  - Production Compliance Dashboards
  - Simple Demand Forecasting
* **Deliverables**: Business owners can audit branch P&Ls and track global margins.
