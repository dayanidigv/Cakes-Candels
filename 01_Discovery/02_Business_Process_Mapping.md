# 02. Business Process Mapping (BPM) - Bakery ERP Edition

This document details the Cakes & Candles-specific business processes, introducing the new **Inventory Governance** domain to control expiry, wastage, transfers, adjustments, audits, and ledger operations.

---

## 1. Expiry & Revenue Recovery Flow
Designed to prevent product waste by converting nearing-expiry inventory into revenue-generating formats.

```mermaid
graph TD
    A[Daily Branch Stock Scan] --> B{Days to Expiry = 2?}
    B -- Yes --> C[Trigger Expiry Alert on POS Dashboard]
    C --> D{Item type: Whole Cake?}
    D -- Yes --> E[Convert Whole Cake to Piece Cakes]
    E --> F[Update Branch Inventory: -1 Whole Cake, +12 Pieces]
    D -- No --> G[Apply Auto-Discount: 30% Off Promotion]
    F --> H[Highlight on POS for Active Retail Sale]
    G --> H
    B -- No (Expired) --> I[Remove from Shelves & Send to Wastage Queue]
```

---

## 2. Branch-to-Branch Transfer Flow
Enables inventory balancing across branches to prevent local expiry or address sudden demand surges.

```mermaid
sequenceDiagram
    autonumber
    actor BranchA as Branch A (Requesting / Expiring Stock)
    participant ERP as ERP Inventory Governance
    actor BranchB as Branch B (High Demand)
    actor Driver as Logistics Driver

    BranchA->>ERP: Request Stock Transfer (Due to near-expiry/high local stock)
    ERP->>ERP: Validate Branch B's demand & capacity
    ERP->>BranchB: Dispatch Transfer Request notification
    BranchB->>ERP: Approve / Accept Transfer
    ERP->>ERP: Lock stock at Branch A (Status: PENDING_TRANSFER)
    ERP->>Driver: Dispatch Transfer sheet / pickup task
    Driver->>BranchA: Collect stock
    Driver->>BranchB: Deliver stock
    BranchB->>ERP: Inward verification & Accept Goods
    rect rgba(0, 150, 0, 0.1)
        ERP->>ERP: Ledger: Debit Branch A Stock, Credit Branch B Stock
    end
```

---

## 3. Wastage Approval Workflow
Ensures all product write-offs are inspected and approved by upper management to prevent internal theft.

```mermaid
sequenceDiagram
    autonumber
    actor BranchStaff as Branch Staff
    participant ERP as ERP Inventory Governance
    actor QA as QA Inspector / Area Manager
    actor Owner as Business Owner (Sudha)

    BranchStaff->>ERP: Log Waste Event (Damaged / Expired / Spoiled)
    ERP->>ERP: Mark stock status: PENDING_WASTAGE_APPROVAL (Staged)
    QA->>ERP: Inspect physical item & verify reason code
    QA->>ERP: Submit QA recommendation
    Owner->>ERP: Review daily Wastage Queue & Approve/Reject write-off
    alt Approved
        ERP->>ERP: Write-off stock (Ledger: WASTE_WRITE_OFF)
    else Rejected
        ERP->>ERP: Flag for audit / return to shelf / adjustment
    end
```

---

## 4. CRM & Campaign Automation Flow
Links POS data, birth dates, and automated channels to drive repeat visits.

```mermaid
graph TD
    A[Daily Cron Check: Customers DOB in 3 Days] --> B[Generate WhatsApp Birthday Promo Code]
    B --> C[Send WhatsApp Campaign Message]
    C --> D[Customer Visits Branch POS]
    D --> E[POS Operator Enters Phone & Promo Code]
    E --> F{Validate Promo & Date?}
    F -- Valid --> G[Apply Birthday Discount + Redeem Code]
    G --> H[Accrue Loyalty Points: ₹10 Spent = 1 Point]
    F -- Invalid --> I[Decline Discount]
```

---

## 5. Production Planning Engine
The manufacturing heart that drives daily factory operations based on actual data.

```mermaid
graph TD
    A[Branch Indents Submitted] --> B[Consolidate Total Demand]
    B --> C[Analyze Historical Trends & Buffer Margin]
    C --> D[Check Raw Material Stock levels in Factory]
    D --> E{Stock Available?}
    E -- No --> F[Auto-Draft Purchase Orders for missing ingredients]
    E -- Yes --> G[Generate Batch Production Run Orders]
    G --> H[Predict Expected Finished Goods Yield]
```

---

## 6. Inventory Ledger Flow (Double-Entry Movement)
Every single inventory change is logged as an auditable ledger entry.

```text
+-----------------------+      +-----------------------+      +-----------------------+
|   Opening Stock       |  --> |    Movement Transaction|  --> |    Closing Stock      |
|  (Verified Balance)   |      |  (Auditable Ledger Row)|      |  (Derived Real-time)  |
+-----------------------+      +-----------------------+      +-----------------------+
                                           |
                           +---------------+---------------+
                           |                               |
                   Additions (+)                    Deductions (-)
                   - Purchase (GRN)                 - Sales (POS Checkout)
                   - Production Yield               - Production Consumption
                   - Transfer In                    - Transfer Out
                   - Returns                        - Damage / Wastage / Expiry
```
