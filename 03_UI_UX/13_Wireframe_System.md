# 13. UI/UX Wireframe System (Low-Fidelity Layouts)

This document provides low-fidelity structural blueprints for the 12 primary user interfaces of the Cakes & Candles ERP.

---

## Wireframe 01: Login Screen

```text
+-------------------------------------------------------------+
|                                                             |
|                         CAKES & CANDLES                     |
|                           [ Logo ]                          |
|                                                             |
|        +-------------------------------------------+        |
|        | Username                                  |        |
|        +-------------------------------------------+        |
|                                                             |
|        +-------------------------------------------+        |
|        | Password                                  |        |
|        +-------------------------------------------+        |
|                                                             |
|        +-------------------------------------------+        |
|        | [             SUBMIT LOGIN              ] |        |
|        +-------------------------------------------+        |
|                                                             |
+-------------------------------------------------------------+
```

---

## Wireframe 02: Owner Dashboard

```text
+-------------------------------------------------------------+
| Header: Cakes & Candles Control Tower    Owner | Cost Center|
+-------------------------------------------------------------+
| KPI Cards:                                                  |
| +-----------------+ +-----------------+ +-----------------+ |
| | Today's Sales   | | Today's Profit  | | Wastage Cost    | |
| | INR 1,84,390    | | INR 54,200      | | INR 4,200       | |
| +-----------------+ +-----------------+ +-----------------+ |
+-------------------------------------------------------------+
| Grid Layout:                                                |
| +-----------------------------+ +-------------------------+ |
| | Alerts                      | | Branch Performance      | |
| | * 4 items low stock         | | 1. Anna Nagar (₹65k)    | |
| | * 2 items expiring          | | 2. Pudupalayam (₹42k)   | |
| +-----------------------------+ +-------------------------+ |
| +-----------------------------+ +-------------------------+ |
| | Pending Custom Cakes (8)    | | Factory Yield           | |
| | * #CC-9204 (Baking)         | | Run #092: 94% compliance| |
| +-----------------------------+ +-------------------------+ |
+-------------------------------------------------------------+
```

---

## Wireframe 03: POS Billing Register (Tablet-First)

```text
+-------------------------------------------------------------+
| Header: POS Register (Anna Nagar Branch)           Operator |
+-------------------------------------------------------------+
| Product Grid                  | Customer Panel              |
| [Category: Cakes | Bread]     | Phone: [ 9876543210 ]       |
|                               | Name: Ram | Gold Segment    |
| +------------+  +------------+  | Points: 340 (Redeem? [x])   |
| | Truffle    |  | Red Velvet |  +-----------------------------+
| | Half Kg    |  | Half Kg    |  | Cart List                   |
| | INR 450    |  | INR 500    |  | * 1x Truffle Half Kg (₹450) |
| +------------+  +------------+  | * 1x Red Velvet (₹500)      |
| +------------+  +------------+  |                             |
| | Cupcake    |  | Sandwich   |  +-----------------------------+
| | INR 80     |  | Bread      |  | Payment Panel               |
| |            |  | INR 45     |  | Subtotal:  ₹950.00          |
| +------------+  +------------+  | Tax (GST): ₹47.50           |
|                               | Total Due: ₹997.50          |
|                               | [ Cash ] [ UPI ] [ Card ]   |
|                               | [     PRINT & CHECKOUT    ] |
+-------------------------------+-----------------------------+
```

---

## Wireframe 04: Inventory Overview

```text
+-------------------------------------------------------------+
| Header: Stock Overview                                      |
+-------------------------------------------------------------+
| Filters: Location [ All ]  Category [ Finished Goods ]      |
+-------------------------------------------------------------+
| Table List:                                                 |
| SKU         Product        Available  Reserved  Expiry  Stat|
| ----------- -------------- ---------- --------- ------- ----|
| FG-TRUF-01  Truffle Cake   12 pcs     2 pcs     1 day   WAR |
| RM-FLOUR-01 Flour          420 kg     0 kg      30 days OK  |
|                                                             |
+-------------------------------------------------------------+
```

---

## Wireframe 05: Inventory Ledger

```text
+-------------------------------------------------------------+
| Header: Stock Transaction Ledger (Auditable)                 |
+-------------------------------------------------------------+
| Filters: SKU [           ] Type [ All ] Date [             ]|
+-------------------------------------------------------------+
| Table List:                                                 |
| Date        Tx Type      SKU        Qty     Ref ID  User    |
| ----------- ------------ ---------- ------- ------- --------|
| 2026-06-24  SALE         FG-TRUF-01 -1.000  INV-012 Cashier |
| 2026-06-24  WASTAGE      FG-TRUF-01 -2.000  WST-904 Chef-K  |
| 2026-06-24  PROCUREMENT  RM-FLOUR-01 +100.0 GRN-401 Manager |
|                                                             |
+-------------------------------------------------------------+
```

---

## Wireframe 06: Production Planner

```text
+-------------------------------------------------------------+
| Header: Daily Factory Planner                               |
+-------------------------------------------------------------+
| 1. Consolidated Branch Demand                               |
| * Branch 1: 15 Truffle, 20 Red Velvet                       |
| * Branch 2: 10 Truffle, 15 Red Velvet                       |
|                                                             |
| 2. Recipe Explosion Summary                                 |
| * Flour required: 45kg (Available: 420kg)                   |
| * Sugar required: 22kg (Available: 150kg)                   |
|                                                             |
| 3. Create Daily Production Plan                             |
| * Run 1: 25 Truffle Cakes (Chef: Kumar)                     |
| * Run 2: 35 Red Velvet Cakes (Chef: Dev)                    |
|                                                             |
| [                    APPROVE & DISPATCH PLAN               ]|
+-------------------------------------------------------------+
```

---

## Wireframe 07: Kitchen Display System (KDS - Touchscreen)

```text
+-------------------------------------------------------------+
| Kitchen Display System (KDS)                       Chefs    |
+-------------------------------------------------------------+
| Priority Custom Cakes (Gold alerts)                         |
| +-----------------------------------------+                 |
| | #CC-9204: 3Kg Princess Cake - Eggless   | [START DECOR]   |
| | Pickup: Anna Nagar, Tomorrow 4:00 PM    |                 |
| +-----------------------------------------+                 |
+-------------------------------------------------------------+
| Active Batch Runs                                           |
| +----------------------+ +----------------------+           |
| | Run #092: Truffle    | | Run #093: Red Velvet |           |
| | Target: 25 pieces    | | Target: 35 pieces    |           |
| | [ START BAKING ]     | | [ MARK COMPLETED ]   |           |
| +----------------------+ +----------------------+           |
+-------------------------------------------------------------+
| QC & Yield Queue                                            |
| +---------------------------------------------------------+ |
| | Batch #TR-92: Target 25 | Yield: [ 24 ] Waste: [ 1 ]    | |
| | [ SUBMIT YIELD & QC ]                                    | |
| +---------------------------------------------------------+ |
+-------------------------------------------------------------+
```

---

## Wireframe 08: Dispatch Builder

```text
+-------------------------------------------------------------+
| Header: Dispatch Manifest Compiler                          |
+-------------------------------------------------------------+
| Config:                                                     |
| Destination Location: [ Branch 1 - Anna Nagar ]             |
| Vehicle: [ Truck A - TN-01-A-1234 ]                         |
| Driver:  [ Kumar - Driver ]                                 |
+-------------------------------------------------------------+
| Manifest Items:                                             |
| SKU         Product        Batch ID       Quantity          |
| ----------- -------------- -------------- ----------------- |
| FG-TRUF-01  Truffle Cake   BT-092         15 pcs            |
| FG-REDV-01  Red Velvet     BT-093         20 pcs            |
|                                                             |
| [                   BUILD & DISPATCH MANIFEST              ]|
+-------------------------------------------------------------+
```

---

## Wireframe 09: Custom Cake Kanban Board (Drag-and-Drop)

```text
+-------------------------------------------------------------------------------------------------+
| Custom Cake Pipeline Board                                                                      |
+-------------------------------------------------------------------------------------------------+
| [BOOKED]       | [APPROVED]     | [BAKING]       | [DECORATING]   | [QC]           | [READY]        |
| -------------- | -------------- | -------------- | -------------- | -------------- | -------------- |
| #CC-9204       | #CC-9200       | #CC-9190       | #CC-9188       | #CC-9180       | #CC-9177       |
| 3Kg Princess   | 2Kg RedVelvet  | 5Kg Wedding    | 1Kg Chocolate  | 2Kg Butterc    | 1.5Kg Fruit    |
| Chef: -        | Chef: Dev      | Chef: Kumar    | Chef: Roy      | Chef: Dev      | Driver: Roy    |
|                |                |                |                |                |                |
+-------------------------------------------------------------------------------------------------+
```

---

## Wireframe 10: CRM Dashboard

```text
+-------------------------------------------------------------+
| Header: Customer Relationship Management (CRM)              |
+-------------------------------------------------------------+
| Tiers Summary:                                              |
| VIP: 120 customers  | Gold: 340 customers  | Silver: 1,200  |
+-------------------------------------------------------------+
| Birthdays Today & Tomorrow:                                 |
| * Ram (9876543210) - Gold - Birthday tomorrow (Promo sent)  |
| * Sita (9876543211) - VIP - Birthday today (Redeemed)       |
+-------------------------------------------------------------+
| Campaign Performance:                                       |
| * Campaign: "June Birthday Blast" | Channel: WhatsApp       |
| * Dispatched: 140 messages | Redemptions: 42 (30% rate)     |
+-------------------------------------------------------------+
```

---

## Wireframe 11: Daily Register Closing

```text
+-------------------------------------------------------------+
| Header: End of Shift Cash Reconciliation                    |
+-------------------------------------------------------------+
| Location: Branch 1 - Anna Nagar | Register ID: REG-01       |
+-------------------------------------------------------------+
| 1. System Cash Expected:                 INR 45,390.00      |
| 2. Counted Cash In Drawer:               [ 45,390.00 ]      |
| 3. Counted UPI Invoices Total:           [ 24,000.00 ]      |
| 4. Counted Card Invoices Total:          [ 12,000.00 ]      |
| 5. Expenses Paid Out (Petty Cash):       [  1,500.00 ]      |
|                                                             |
| Reconciled Variance:                     INR 0.00           |
| Notes: [ Register balanced perfectly.                      ]|
|                                                             |
| [                   CLOSE REGISTER & LOG SHIFT             ]|
+-------------------------------------------------------------+
```

---

## Wireframe 12: Reports Dashboard

```text
+-------------------------------------------------------------+
| Header: Business Analytics Reports                          |
+-------------------------------------------------------------+
| Parameters:                                                 |
| Date Range: [ 2026-06-01 ] to [ 2026-06-24 ]                |
| Location:   [ All Locations ]                               |
| Report Type: [ Cost Center Profitability ]                  |
| [ Export CSV ] [ Export PDF ]                               |
+-------------------------------------------------------------+
| Profitability Chart:                                        |
|   ₹100k |      █                                            |
|    ₹50k |   █  █  █                                         |
|      ₹0 | ──█──█──█──                                       |
|         Br1 Br2 Br3                                         |
+-------------------------------------------------------------+
```
