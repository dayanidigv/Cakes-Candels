# 04. Domain Model Specification

This document defines the core domains, entities, relationships, state flows, and ownership boundaries for the Cakes & Candles ERP platform.

---

## 1. Product Domain
The foundational registry around which all ERP inventory, manufacturing, and commerce revolve.

### Aggregate Roots & Entities
* **Product [Aggregate Root]**: The main product item. Can be raw material, semi-finished goods (e.g. sponge), or finished goods (e.g. whole cake).
  * **Pricing Record [Child]**: Multi-level price rules (Factory base cost, branch retail price, custom order base price).
  * **Expiry Policy [Child]**: Configurable parameters per product category (shelf-life, alert offsets).
* **Product Category**: Groups products for reporting and tax rules.

### Relationship
```text
Product Category
 └── Product [Aggregate Root]
      ├── Pricing Records
      └── Expiry Policy
```

---

## 2. Organization Domain
Manages structural business units, locations, and access control.

### Aggregate Roots & Entities
* **Company [Aggregate Root]**: The top-level corporate entity (Cakes & Candles).
  * **Branch / Location [Child]**: Physical nodes (Pudupalayam Factory, Transit Hub, 6 Retail Branches).
  * **User [Child]**: System operator credentials.
  * **Role & Permission [Child]**: Granular access control policies.

### Relationship
```text
Company [Aggregate Root]
 └── Branch / Location
      └── Users (Linked to Roles & Permissions)
```

---

## 3. HR & Workforce Domain
Handles employee schedules, branch assignments, attendance, leaves, and payroll calculations.

### Aggregate Roots & Entities
* **Employee [Aggregate Root]**: Individual employee profiles.
  * **Attendance [Child]**: Daily punch-in/out records.
  * **Shift [Child]**: Planned working hour windows.
  * **Leave [Child]**: Requested and approved employee time-off logs.
  * **Branch Assignment [Child]**: Active store or factory location assignments.
  * **Payroll Reference [Child]**: Wage base rates, bonuses, and salary formulas.

### Relationship
```text
Employee [Aggregate Root]
 ├── Attendance
 ├── Shifts
 ├── Leave Records
 ├── Branch Assignment
 └── Payroll Reference
```

---

## 4. Procurement Domain
Handles supplier relations, ordering raw assets, and matching vendor liabilities.

### Aggregate Roots & Entities
* **Purchase Order (PO) [Aggregate Root]**: Procurement request document.
  * **PO Item [Child]**: Item requested with quantity and price.
  * **Goods Received Note (GRN) [Child]**: Verification of actual received assets.
  * **Supplier Invoice [Child]**: Bill issued by the supplier.
* **Supplier [Aggregate Root]**: Registered ingredient/packaging vendor.
* **Supplier Payment**: Ledger settlement records.

### Relationship
```text
Supplier [Aggregate Root]
 └── Purchase Orders (PO) [Aggregate Root]
      └── PO Items
           └── Goods Received Notes (GRN)
                └── Supplier Invoices
```

---

## 5. Manufacturing Domain
The factory floor production framework.

### Aggregate Roots & Entities
* **Recipe [Aggregate Root]**: Master formulation containing steps and quantity metrics.
  * **Recipe Ingredient [Child]**: Specific raw material and weight required per recipe yield.
* **Production Plan [Aggregate Root]**: Weekly/daily scheduling batches.
  * **Production Run [Child]**: Actual active production job in the bakery.
  * **Batch [Child]**: Unique ID assigned to a finished output run for traceability.
  * **QC Check [Child]**: Quality evaluation log (Passed, Failed, Downgraded).
  * **Yield Record [Child]**: Actual vs. planned output quantity analysis (e.g. 50 planned vs 47 actual, 3 waste).

### Relationship
```text
Recipe [Aggregate Root]
 ├── Recipe Ingredients
 └── Production Plan [Aggregate Root]
      └── Production Runs (Generates Batches)
           ├── QC Check
           └── Yield Record
```

---

## 6. Inventory Governance Domain
The double-entry ledger domain controlling all stock balances, movements, and reservations.

### Aggregate Roots & Entities
* **Stock Ledger [Aggregate Root]**: Double-entry journal of every single movement.
  * **Transfer [Child]**: Relocation of assets between branches/warehouses.
  * **Adjustment [Child]**: Corrections from physical audits.
  * **Wastage [Child]**: Write-off records waiting for approval.
  * **Expiry [Child]**: Log of items nearing/at expiration.
  * **Conversion [Child]**: Decomposition entries (e.g. Whole Cake -> 12 Pieces).
* **Warehouse [Aggregate Root]**: Storage zones within physical locations.
* **Stock Reservation [Aggregate Root]**: Inventory committed to pending orders (e.g. custom cake cream/sponge) to prevent double allocation.

### Relationship
```text
Stock Ledger [Aggregate Root]
 ├── Stock Transfers (Between Warehouses)
 ├── Physical Adjustments (Audits)
 ├── Expiry & Wastage Logs
 └── Product Conversion Logs
```

---

## 7. Logistics Domain
Coordinates branch dispatching and driver delivery tracking.

### Aggregate Roots & Entities
* **Dispatch Sheet [Aggregate Root]**: Manifest list containing items for transfer.
  * **Dispatch Item [Child]**: SKU and batch quantity packed for transit.
  * **Delivery Confirmation [Child]**: Signature/log by branch receiving staff.
* **Vehicle [Aggregate Root]**: Delivery trucks/vans.
* **Driver [Aggregate Root]**: Logistics team members.

### Relationship
```text
Dispatch Sheet [Aggregate Root]
 ├── Vehicle & Driver
 ├── Dispatch Items
 └── Delivery Confirmation (Branch Acknowledgment)
```

---

## 8. Retail Commerce (POS) Domain
Manages high-velocity retail sales at the 6 retail branches.

### Aggregate Roots & Entities
* **Invoice / Order [Aggregate Root]**: Completed sales transaction.
  * **Invoice Item [Child]**: Sold SKU, qty, taxes (GST), and discounts.
  * **Payment [Child]**: Cash, UPI, Card, or Points.
* **Customer [Aggregate Root]**: Guest or loyalty account profile.
  * **Loyalty Transaction [Child]**: Points awarded or redeemed.
* **Discount / Promotion**: Applied markdown campaigns.

### Relationship
```text
Customer [Aggregate Root]
 └── Invoice / Order [Aggregate Root]
      ├── Invoice Items
      ├── Payments (Multi-payment Support)
      └── Loyalty Transactions
```

---

## 9. Custom Cake Domain
Workflow for design-focused mini-projects.

### Aggregate Roots & Entities
* **Custom Cake Order [Aggregate Root]**: High-level contract specifying pick-up and deposit details.
  * **Cake Design [Child]**: Uploaded reference sketches, text instructions, and dimensions.
  * **Production Job [Child]**: Stage tracking for baking.
  * **Decoration Job [Child]**: Stage tracking for icing and piping.
  * **Delivery Schedule [Child]**: Logistics handover.

### Status Flow
```text
BOOKED -> APPROVED -> BAKING -> DECORATING -> QC -> READY -> DELIVERED
```

---

## 10. CRM & Marketing Domain
Drives customer retention and engagement.

### Aggregate Roots & Entities
* **Customer Profile [Aggregate Root]**: 360-degree history of purchases and custom cake designs.
  * **Voucher [Child]**: Promo code tied to loyalty tiers.
  * **Communication Log [Child]**: Record of messages sent.
* **Campaign [Aggregate Root]**: Communication blasts (WhatsApp templates).
* **Customer Segment**: Dynamic tags based on spend value (Bronze, Silver, Gold, VIP).

### Relationship
```text
Customer Profile [Aggregate Root]
 ├── Customer Segment
 ├── Vouchers
 └── Communication Logs
```

---

## 11. Finance Domain
Core bookkeeping for expenses, cash flows, margins, and profitability.

### Aggregate Roots & Entities
* **Supplier Ledger [Aggregate Root]**: Outstanding vendor payables.
* **Branch Expense [Aggregate Root]**: Petty cash logs per retail branch.
  * **Expense [Child]**: Non-procurement costs (e.g. electricity, rent).
* **Cash Register Log [Aggregate Root]**: Daily opening/closing cash balances per shift.
* **Revenue**: Inflows from POS and Custom Cake orders.
* **Cost Center**: Financial division (e.g. Branch A, Central Factory) to track localized profit/loss.
* **Profitability Snapshot**: System-computed yield profit reports.

---

## 12. Reporting & Analytics Domain
Consolidates snapshots across all domains for owner and manager dashboards.

### Aggregate Roots & Entities
* **KPI Snapshot [Aggregate Root]**: Cached key indicators (e.g., total sales, average order value).
  * **Dashboard Widget [Child]**: Visual panel items.
* **Branch Performance**: Metrics comparing branch sales, conversions, and footfalls.
* **Profitability Report**: Consolidated financial P&L.
* **Waste Report**: Wastage losses categorized by location and reason.
* **Production Report**: Manufacturing efficiency, plan compliance, and yield accuracy.

---

## Domain Dependency Map

```text
Product
│
├── Procurement
├── Manufacturing
├── Inventory Governance
├── Retail Commerce (POS)
└── CRM

Manufacturing
│
├── Recipe
├── Production Plan
└── Inventory Governance

Inventory Governance
│
├── Logistics
├── Retail Commerce (POS)
└── Custom Cake

HR & Workforce
│
├── Organization
└── Finance
```

---

## Domain Ownership Matrix

| Domain | Owner Role | Key Responsibilities |
| --- | --- | --- |
| **Product** | Super Admin / Owner | SKU Master, pricing structures, and expiry policies |
| **Organization** | Super Admin | Managing user permissions, roles, and branch details |
| **HR & Workforce** | HR Manager / Owner | Shifts, leaves, branch assignments, payroll references |
| **Procurement** | Factory Manager | Supplier accounts, POs, and GRNs |
| **Manufacturing** | Factory Manager / Chef | Recipes, production runs, yield records, and batch QC |
| **Inventory Governance** | Factory / Branch Manager | Transfers, waste logging, ledger audits, stock reservations |
| **Logistics** | Dispatch Coordinator | Dispatch sheets, drivers, and transit validation |
| **Retail Commerce** | Branch cashier | POS sales checkout and cash drawer balancing |
| **Custom Cakes** | Specialty Chef / Operator | Intake specs, design reviews, and baking/decorating stages |
| **CRM** | Marketing Lead | Customer segments, automated campaigns, and vouchers |
| **Finance** | Owner (Sudha) | Expense audits, cost centers, supplier payments |
| **Reporting & Analytics**| Owner / Sudha | Performance tracking, waste audits, and P&L reviews |
