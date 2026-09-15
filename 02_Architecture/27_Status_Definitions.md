# 27. Status Definitions Catalogue

This document defines the strict status states, trigger actions, and state transitions for the primary ERP pipelines. Developers must utilize these enums inside API models and database column check constraints.

---

## 1. Dispatch & Logistics Pipeline

```text
  [DRAFT] ➔ [PACKED] ➔ [DISPATCHED] ➔ [IN_TRANSIT] ➔ [REACHED] ➔ [RECEIVED]
                                                               └──➔ [CANCELLED]
```

* **`DRAFT`**: Manifest items compiled by the dispatch coordinator. No driver or vehicle assigned.
* **`PACKED`**: Items verified and packed into crates. Driver and vehicle assigned.
* **`DISPATCHED`**: Truck loaded; security gate pass printed.
* **`IN_TRANSIT`**: Truck active on delivery route.
* **`REACHED`**: Driver arrives at branch and begins item offloading.
* **`RECEIVED`**: Branch staff verify quantities and accept load. Stock ledger transaction posted.
* **`CANCELLED`**: Manifest cancelled prior to dispatch.

---

## 2. Custom Cake Project Pipeline

```text
  [BOOKED] ➔ [APPROVED] ➔ [BAKING] ➔ [DECORATING] ➔ [QC] ➔ [READY] ➔ [DELIVERED]
                                                                  └──➔ [CANCELLED]
```

* **`BOOKED`**: Order logged at branch register, design reference uploaded, deposit payment confirmed.
* **`APPROVED`**: Specialty pastry chef reviews specs and confirms ingredients slot allocation.
* **`BAKING`**: Cake base sponge and tiers baked in kitchen ovens.
* **`DECORATING`**: Icing, frosting, and piping applied by decorator chef.
* **`QC`**: Inspected for weight accuracy, design match, and eggless validation check.
* **`READY`**: Cake boxed and placed in branch refrigerator drawer. WhatsApp ready notification triggered.
* **`DELIVERED`**: Final payment collected, driver delivers or customer pickups.
* **`CANCELLED`**: Order aborted (deposit refunds governed by billing rules).

---

## 3. Factory Production Pipeline

```text
  [PLANNED] ➔ [RELEASED] ➔ [IN_PROGRESS] ➔ [QC] ➔ [COMPLETED]
                                                └──➔ [CANCELLED]
```

* **`PLANNED`**: Production planner consolidating indents schedules weekly plan runs.
* **`RELEASED`**: Ingredient allocations locked; batch orders sent to KDS touchscreen lists.
* **`IN_PROGRESS`**: Chefs check-in run and start baking.
* **`QC`**: Completed batch runs logged and evaluated for quality pass metrics.
* **`COMPLETED`**: Yield logs submitted, raw material consumption debited, finished goods credited.
* **`CANCELLED`**: Scheduled run aborted.
