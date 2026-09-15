# 03. Business Rules Catalogue

This document catalogs the operational business rules for Cakes & Candles. These rules dictate constraints, state transitions, validation criteria, and system automation behaviors.

---

## 1. Inventory & Governance Rules

### BR-001: Shelf Life & Expiry Alerts
* **Rule**: Different product classes have fixed shelf life metrics. Expiry alerts must trigger proactively.
* **Logic**:
  ```text
  IF Product Type = 'Fresh Cream Cake'
  THEN Shelf Life = 7 Days AND Expiry Alert = Expiry Date - 2 Days

  IF Product Type = 'Butter Cream Cake'
  THEN Shelf Life = 4 Days AND Expiry Alert = Expiry Date - 2 Days

  IF Product Type = 'Bread' OR Product Type = 'Bun'
  THEN Shelf Life = 4 Days AND Expiry Alert = Expiry Date - 1 Day
  ```

### BR-001.1: Reorder & Low Stock Alerts
* **Rule**: Maintain continuity of supply at retail branches and factory.
* **Logic**:
  ```text
  IF Current Stock Level <= Safe Stock Threshold
  THEN Flag Low Stock Alert AND Send Daily Indent Notification
  ```

---

## 2. Production Rules

### BR-002: Branch Indent & Cut-Off Schedules
* **Rule**: Production plans require inputs before a fixed cut-off time.
* **Logic**:
  ```text
  IF Current Time > 18:00 (6:00 PM)
  THEN Block New Branch Indent submissions for the following day's production run.
  ```

---

## 3. Product Conversion Rules

### BR-003: Whole Cake to Slice / Piece Cake Conversion
* **Rule**: Whole cakes nearing expiry can be decomposed to slices to maximize sales probability.
* **Logic**:
  ```text
  IF Whole Cake Days To Expiry <= 2
  AND Whole Cake Status = 'IN_STOCK'
  THEN Allow POS Operator to perform 'Slice Conversion'
  
  -- Inventory conversion ratio
  1 Whole Cake (0.5Kg/1Kg) = Deduct 1 Unit
  Slice Cakes = Add 12 Units (or relevant fractional weight count)
  ```

---

## 4. CRM & Customer Rules

### BR-004: Birthday & Anniversary Promo Alerts
* **Rule**: Automatically engage customers with localized deals before their special day.
* **Logic**:
  ```text
  IF Customer Birthday = Today + 3 Days
  THEN Generate Unique Promo Code AND Send Birthday WhatsApp Campaign
  ```

---

## 5. Billing & Deletion Governance

### BR-005: Order / Bill Deletion Rules
* **Rule**: Protect against POS cash fraud.
* **Logic**:
  ```text
  IF Request = 'DELETE_BILL' OR Request = 'VOID_TRANSACTION'
  THEN Require Role = 'BUSINESS_OWNER' (Sudha) OR Role = 'SUPER_ADMIN'
  ELSE Block Action AND Log Unauthorized Attempt
  ```
