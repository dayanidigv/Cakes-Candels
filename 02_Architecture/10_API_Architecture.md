# 10. API Architecture Specification

This document details the REST API endpoints and the system-wide Event-Driven Architecture (EDA) for the Cakes & Candles ERP platform.

---

## 1. Authentication APIs

### POST `/auth/login`
* **Purpose**: Authenticates credentials and issues JWT token.
* **Request Payload**:
  ```json
  {
    "username": "cashier_01",
    "password": "SecurePassword123"
  }
  ```
* **Response Payload**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": "a9b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      "username": "cashier_01",
      "role": "CASHIER",
      "location_id": "b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e"
    }
  }
  ```
* **Validation Rules**: Username and password must not be empty.
* **Permission Required**: Public.
* **Business Rules Applied**: BR-005.
* **Events Triggered**: `UserLoggedIn`.

---

## 2. Product APIs

### POST `/products`
* **Purpose**: Creates a new product SKU in the catalog.
* **Request Payload**:
  ```json
  {
    "sku": "FG-TRUF-01",
    "name": "Truffle Cake Half KG",
    "category_id": "c1c2c3c4-d5d6-7d8d-9d0d-1e2e3e4e5e6e",
    "unit_of_measure": "PIECE",
    "is_perishable": true,
    "shelf_life_days": 7
  }
  ```
* **Response Payload**:
  ```json
  {
    "id": "e1e2e3e4-f5f6-7f8f-9f0f-1a2a3a4a5a6a",
    "sku": "FG-TRUF-01",
    "name": "Truffle Cake Half KG"
  }
  ```
* **Validation Rules**: SKU must be unique; shelf life must be positive.
* **Permission Required**: `SUPER_ADMIN`, `OWNER`.
* **Business Rules Applied**: BR-001.
* **Events Triggered**: `ProductCreated`.

---

## 3. Inventory APIs

### POST `/inventory/transfers`
* **Purpose**: Dispatches stock relocations between branch locations.
* **Request Payload**:
  ```json
  {
    "from_location_id": "l1l2l3l4-m5m6-7m8m-9m0m-1n2n3n4n5n6n",
    "to_location_id": "o1o2o3o4-p5p6-7p8p-9p0p-1q2q3q4q5q6q",
    "items": [
      {
        "product_id": "e1e2e3e4-f5f6-7f8f-9f0f-1a2a3a4a5a6a",
        "batch_id": "b1b2b3b4-c5c6-7c8c-9c0c-1d2d3d4d5d6d",
        "quantity": 10.0000
      }
    ]
  }
  ```
* **Response Payload**:
  ```json
  {
    "transfer_id": "t1t2t3t4-u5u6-7u8u-9u0u-1v2v3v4v5v6v",
    "status": "IN_TRANSIT"
  }
  ```
* **Validation Rules**: Quantity must be available in source location balance.
* **Permission Required**: `BRANCH_MANAGER`, `FACTORY_MANAGER`, `OWNER`.
* **Business Rules Applied**: Double-entry ledger validation.
* **Events Triggered**: `StockTransferred`.

### POST `/inventory/wastage`
* **Purpose**: Records inventory damages or spoilages.
* **Request Payload**:
  ```json
  {
    "product_id": "e1e2e3e4-f5f6-7f8f-9f0f-1a2a3a4a5a6a",
    "batch_id": "b1b2b3b4-c5c6-7c8c-9c0c-1d2d3d4d5d6d",
    "quantity": 2.0000,
    "reason": "Spoiled"
  }
  ```
* **Response Payload**:
  ```json
  {
    "wastage_id": "w1w2w3w4-x5x6-7x8x-9x0x-1y2y3y4y5y6y",
    "status": "PENDING"
  }
  ```
* **Validation Rules**: Quantity must not exceed batch stock level.
* **Permission Required**: `CASHIER`, `BRANCH_MANAGER`.
* **Business Rules Applied**: Wastage approval workflow rules.
* **Events Triggered**: `WasteLogged`.

---

## 4. Manufacturing APIs

### POST `/factory/production-plans`
* **Purpose**: Creates the daily manufacturing schedule batch.
* **Request Payload**:
  ```json
  {
    "plan_date": "2026-06-24",
    "runs": [
      {
        "recipe_id": "r1r2r3r4-s5s6-7s8s-9s0s-1t2t3t4t5t6t",
        "target_quantity": 50.0000
      }
    ]
  }
  ```
* **Response Payload**:
  ```json
  {
    "plan_id": "p1p2p3p4-q5q6-7q8q-9q0q-1r2r3r4r5r6r",
    "status": "PLANNED"
  }
  ```
* **Validation Rules**: Plan date must be in the future.
* **Permission Required**: `FACTORY_MANAGER`.
* **Business Rules Applied**: BR-002 (Cut-off times verification).
* **Events Triggered**: `ProductionStarted`.

### POST `/factory/yields`
* **Purpose**: Submits completed production yield statistics.
* **Request Payload**:
  ```json
  {
    "production_run_id": "pr1pr2pr3-pr4-pr5",
    "actual_quantity": 47.0000,
    "wastage_quantity": 3.0000
  }
  ```
* **Response Payload**:
  ```json
  {
    "yield_id": "y1y2y3y4-y5",
    "efficiency_percentage": 94.00
  }
  ```
* **Validation Rules**: Actual plus wastage must equal planned bounds (+/- variance limits).
* **Permission Required**: `FACTORY_MANAGER`, `CHEF`.
* **Business Rules Applied**: Yield tracking limits.
* **Events Triggered**: `ProductionCompleted`.

---

## 5. Logistics APIs

### POST `/logistics/dispatches`
* **Purpose**: Creates an outbound truck/van load list.
* **Request Payload**:
  ```json
  {
    "vehicle_id": "v1v2-v3",
    "driver_employee_id": "e1e2-e3",
    "to_location_id": "l1l2-l3",
    "items": [
      {
        "product_id": "p1p2-p3",
        "batch_id": "b1b2-b3",
        "quantity": 30.0000
      }
    ]
  }
  ```
* **Response Payload**:
  ```json
  {
    "dispatch_id": "d1d2-d3",
    "status": "DISPATCHED"
  }
  ```
* **Validation Rules**: Vehicle and driver must be available.
* **Permission Required**: `DISPATCH_COORDINATOR`.
* **Business Rules Applied**: Double-entry logistics locks.
* **Events Triggered**: `DispatchCreated`.

---

## 6. POS APIs

### POST `/retail/orders`
* **Purpose**: Records a new POS checkout transaction.
* **Request Payload**:
  ```json
  {
    "customer_phone": "9876543210",
    "items": [
      {
        "product_id": "e1e2e3e4-f5f6-7f8f-9f0f-1a2a3a4a5a6a",
        "quantity": 1.00,
        "price": 450.00,
        "discount": 50.00
      }
    ],
    "payment_mode": "CASH",
    "amount_paid": 400.00
  }
  ```
* **Response Payload**:
  ```json
  {
    "invoice_id": "i1i2i3i4-i5",
    "invoice_number": "CC-INV-2026-00001",
    "net_total": 400.00,
    "loyalty_points_earned": 40
  }
  ```
* **Validation Rules**: Subtotal minus discounts must match amount paid.
* **Permission Required**: `CASHIER`, `BRANCH_MANAGER`.
* **Business Rules Applied**: BR-004 (loyalty accumulation), BR-005 (void restriction checks).
* **Events Triggered**: `InvoiceCreated`, `InventoryDeducted`, `LoyaltyPointsAwarded`.

---

## 7. CRM APIs

### POST `/crm/campaigns`
* **Purpose**: Broadcasts targeted discount vouchers.
* **Request Payload**:
  ```json
  {
    "name": "June Birthday Blast",
    "channel": "WHATSAPP",
    "template_content": "Happy Birthday! Use code BDAY30 for 30% off.",
    "segment_id": "s1s2-s3"
  }
  ```
* **Response Payload**:
  ```json
  {
    "campaign_id": "c1c2-c3",
    "status": "QUEUED"
  }
  ```
* **Validation Rules**: Template parameters must match whitelist tokens.
* **Permission Required**: `CRM_EXECUTIVE`.
* **Business Rules Applied**: BR-004.
* **Events Triggered**: `CampaignDispatched`.

---

## 8. Custom Cake APIs

### POST `/custom-cakes`
* **Purpose**: Books a customized design order.
* **Request Payload**:
  ```json
  {
    "invoice_id": "i1i2i3i4-i5",
    "flavor": "Chocolate Fudge",
    "weight_kg": 3.00,
    "design_image_url": "https://s3.amazonaws.com/cakes/design1.jpg",
    "scheduled_datetime": "2026-06-25T16:00:00Z"
  }
  ```
* **Response Payload**:
  ```json
  {
    "custom_cake_id": "cc1-cc2",
    "status": "BOOKED"
  }
  ```
* **Validation Rules**: Weight must not exceed 25Kg.
* **Permission Required**: `CASHIER`, `BRANCH_MANAGER`.
* **Business Rules Applied**: Ingredient reservations.
* **Events Triggered**: `CustomCakeCreated`.

---

## 9. HR APIs

### POST `/hr/attendance/clock-in`
* **Purpose**: Logs worker arrival.
* **Request Payload**:
  ```json
  {
    "employee_id": "emp-101",
    "shift_id": "shift-morning"
  }
  ```
* **Response Payload**:
  ```json
  {
    "attendance_id": "att-202",
    "status": "LATE",
    "clock_in_time": "2026-06-24T09:12:00Z"
  }
  ```
* **Validation Rules**: Double clock-in checks per day.
* **Permission Required**: `HR_EXECUTIVE`, `BRANCH_MANAGER`, `FACTORY_MANAGER`.
* **Business Rules Applied**: Shift cut-off checks.
* **Events Triggered**: `EmployeeClockedIn`.

---

## 10. Finance APIs

### POST `/finance/expenses`
* **Purpose**: Records overhead transactions.
* **Request Payload**:
  ```json
  {
    "location_id": "l1l2-l3",
    "cost_center_id": "cc-01",
    "amount": 2500.00,
    "category": "ELECTRICITY"
  }
  ```
* **Response Payload**:
  ```json
  {
    "expense_id": "exp-505",
    "status": "APPROVED"
  }
  ```
* **Validation Rules**: Cost center must correspond with location.
* **Permission Required**: `ACCOUNTANT`, `OWNER`.
* **Business Rules Applied**: Expense limits logic.
* **Events Triggered**: `ExpenseRecorded`.

---

## 11. Reporting APIs

### GET `/reports/kpis`
* **Purpose**: Pulls analytics data.
* **Request Payload**: None (Query string: `?startDate=2026-06-01&endDate=2026-06-30&locationId=l1l2-l3`).
* **Response Payload**:
  ```json
  {
    "sales": 184390.00,
    "wastage_percent": 2.4,
    "yield_compliance": 98.2
  }
  ```
* **Validation Rules**: Date range limited to 12 months.
* **Permission Required**: `OWNER`, `ACCOUNTANT`.
* **Business Rules Applied**: Localized cost center scope checks.
* **Events Triggered**: None.

---

## 12. Event-Driven Architecture Section

Every transaction in the Cakes & Candles ERP is documented and processed asynchronously via our central message broker (BullMQ / Redis).

### Core Events Catalog

| Event Name | Source Domain | Target Handlers (Asynchronous Actions) |
| --- | --- | --- |
| **`ProductCreated`** | Product | Pre-computes initial pricing profiles, indexes cache maps. |
| **`PurchaseReceived`** | Procurement | Updates stock balances (+), registers accounts payable values in supplier ledger. |
| **`ProductionStarted`** | Manufacturing | Commits raw materials in factory inventory, releases reservations. |
| **`ProductionCompleted`** | Manufacturing | Increments finished goods (+), creates new batch IDs, evaluates yields. |
| **`StockTransferred`** | Inventory | Moves balances to transit location, updates logs. |
| **`DispatchCreated`** | Logistics | Generates driver manifest, locks transit items. |
| **`DispatchReceived`** | Logistics | Increments branch stock (+), records transfer losses. |
| **`InvoiceCreated`** | POS Commerce | Deducts branch inventory (-), adds loyalty metrics, flags dashboard. |
| **`InvoiceVoided`** | POS Commerce | Inserts compensating transaction (+) to restore stock, voids loyalty. |
| **`CustomerCreated`** | CRM | Registers baseline segments, formats birthday crons. |
| **`CustomCakeCreated`** | Custom Cakes | Places stock reservation locks for key ingredients (cream, sponge). |
| **`CustomCakeDelivered`**| Custom Cakes | Clears reservations, triggers delivery WhatsApp confirmation. |
| **`WasteLogged`** | Inventory | Stages stock under quarantines. |
| **`WasteApproved`** | Inventory | Releases quarantine, posts wastage deduction transactions (-). |
| **`DailyClosingCompleted`**| Finance | Seals register transactions, emails daily summary report to Sudha. |
