# 28. Master Data Definitions Catalogue

This document defines the static categorical registries and master domains for Cakes & Candles ERP. Standardizing these values ensures code consistency, reliable analytics, and uniform database checks. Developers must not invent ad-hoc categories; all code configurations, select inputs, and validation schemas must adhere to this catalogue.

---

## 1. Product Categories

These categories group items in the inventory system, dictating tax treatment, expiration rules, and production workflows.

| Category Code / DB Value | Display Name | Shelf Life Nature | Description / Examples |
| :--- | :--- | :--- | :--- |
| **`RAW_MATERIAL`** | Raw Material | Non-perishable / Perishable | Raw ingredients used in recipes (flour, sugar, yeast, butter, eggs). |
| **`SEMI_FINISHED`** | Semi-Finished Goods | Highly Perishable (1-3 days) | Prepared items not directly sold (cake sponges, frosting mixes, syrups). |
| **`FINISHED_GOOD`** | Finished Goods | Perishable (1-5 days) | Direct-sell cakes, pastries, donuts, bread, cookies. |
| **`PACKAGING`** | Packaging | Non-perishable | Outer cake boxes, base boards, ribbons, carry bags, gift boxes. |
| **`MERCHANDISE`** | Merchandise | Non-perishable | Non-food items sold at POS (candles, birthday toppers, party hats, plastic knives). |

---

## 2. Expense Categories

Classifications for branch-level petty cash pay-outs and cost center recording.

| Category Code / DB Value | Display Name | Ledger Account | Description / Scope |
| :--- | :--- | :--- | :--- |
| **`RENT`** | Rent | Operating Overhead | Monthly location lease/rental payments. |
| **`ELECTRICITY`** | Electricity | Utility Overhead | Branch power bills (ovens, chillers, display units). |
| **`DIESEL`** | Generator & Truck Fuel | Fuel Expense | Diesel purchases for Fargate delivery trucks and factory generators. |
| **`WATER`** | Water Utility | Utility Overhead | Municipal water utility bills for production and cleaning. |
| **`PETTY_CASH`** | Petty Cash Purchases | Cash Outflow | Small local items (cleaning supplies, minor store consumables). |
| **`INTERNET_TELECOM`** | Internet & Telecom | Utility Overhead | Broadband and mobile bills required for POS sync and KDS terminals. |
| **`MAINTENANCE`** | Maintenance & Repairs | Maintenance Expense | Repairs for baking machinery, air conditioning, vehicles, or refrigeration. |
| **`SALARY`** | Salary Cash Advance | Payroll Expense | Small cash advances or daily wages paid out to temporary staff directly. |

---

## 3. Supplier Types

Used to categorize suppliers and route purchase orders and invoices to appropriate ledgers.

| Supplier Type Code | Display Name | Primary Products / Services | Description |
| :--- | :--- | :--- | :--- |
| **`INGREDIENT_SUPPLIER`** | Raw Material Supplier | Flour, sugar, butter, dairy, chocolate | Wholesale distributors supplying ingredients for production. |
| **`PACKAGING_SUPPLIER`** | Packaging Supplier | Cake boxes, custom bags, boards | Specialized vendors for custom-branded containers and packing. |
| **`LOGISTICS_PROVIDER`** | Logistics Partner | Delivery vehicles, drivers | Third-party transport contractors for branch delivery. |
| **`EQUIPMENT_MAINTENANCE`** | Equipment Maintainer | Machinery parts, servicing | Technicians and agencies repairing baking and retail machinery. |
| **`UTILITY_SERVICE`** | Utility Service Provider | Power, water, broadband | Government and private utility companies. |

---

## 4. Payment Modes

Supported transaction mechanisms at POS registers and purchase payouts.

| Mode Code / DB Value | Display Name | Payment Details JSON Schema | Description |
| :--- | :--- | :--- | :--- |
| **`CASH`** | Cash | `{ "cash_received": 1000.00, "cash_returned": 200.00 }` | Physical cash collected at cash registers. |
| **`UPI`** | UPI QR / Link | `{ "txn_ref": "UPI1234567890", "gateway": "Razorpay" }` | Dynamic QR code or phone transaction checkout. |
| **`CARD`** | Card Payment | `{ "card_type": "VISA/MC", "last_four": "9876", "auth_code": "0981" }` | Credit/Debit card transaction processed on terminal. |
| **`POINTS`** | Loyalty Points | `{ "points_redeemed": 500, "rupee_value": 500.00 }` | Points redemption deducted from customer balance. |

---

## 5. Customer Segments

Governs customer loyalty tiers based on lifetime spend. Evaluated on invoice completion to update status.

| Segment / DB Value | Min Spend Limit | Points Multiplier | Key Benefits / Permissions |
| :--- | :--- | :--- | :--- |
| **`BRONZE`** | ₹0 | 1.0x | Default tier upon enrollment. Standard promotions. |
| **`SILVER`** | ₹5,000 | 1.2x | Free home delivery on orders above ₹1,000. |
| **`GOLD`** | ₹15,000 | 1.5x | Free home delivery. Priority custom cake slots (12-hour skip). |
| **`VIP`** | ₹30,000 | 2.0x | Free delivery on any size order. Direct chef consult for custom orders. |

---

## 6. Employee Roles

Standard roles used across application route guards and DB permissions mapping.

| Role Code / DB Value | Display Name | Primary Workplaces | Key Responsibility |
| :--- | :--- | :--- | :--- |
| **`SUPER_ADMIN`** | System Administrator | Cloud Portal | Total infrastructure, logs, and override rights. |
| **`OWNER`** | Company Owner (Sudha) | All Locations | Overall audits, void invoice approvals, financial check releases. |
| **`FACTORY_MANAGER`** | Factory Manager | Factory | Governs ingredient indents, recipes, and yields. |
| **`BRANCH_MANAGER`** | Branch Manager | Retail Shops | Branch inventory, local staff logs, wastage approvals. |
| **`CASHIER`** | POS Cashier | Retail POS | Conducts billing, cash register openings, and retail sales. |
| **`DISPATCH_COORDINATOR`** | Dispatch Coordinator | Transit Hub / Factory | Generates shipping manifests and routes trucks. |
| **`DRIVER`** | Route Driver | Transit / Vehicles | Moves stock from Factory to branches; verifies delivery loads. |
| **`CRM_EXECUTIVE`** | CRM Executive | Corporate Portal | Manages campaigns, birthday/anniversary automation templates. |
| **`HR_EXECUTIVE`** | HR Coordinator | Corporate Portal | Configures shifts, approves leaves, and audits timecards. |
| **`ACCOUNTANT`** | Accountant | Corporate Portal | Processes supplier payments, audits registers, petty cash expenses. |

---

## 7. Reason Codes

Reason descriptors utilized when adjustments, voids, returns, or waste logs are recorded.

| Reason Code / DB Value | Display Name | Context / Module | Description |
| :--- | :--- | :--- | :--- |
| **`SPOILAGE`** | Stock Spoiled | Wastage Log | Ingredients or baked goods decayed/spoiled in storage. |
| **`DAMAGED_IN_TRANSIT`** | Transit Damage | Wastage Log | Item smudged, broken, or dropped during truck delivery. |
| **`CUSTOMER_RETURN`** | Customer Return | Sale Return | Custom cake rejected or retail item returned by purchaser. |
| **`CONVERSION_WRITE_OFF`** | Conversion Write-off | Inventory Conversion | Whole cake removed to yield separate pastry slice units. |
| **`ADJUSTMENT_VARIANCE`** | Audit Discrepancy | Stock Adjustment | Stock balance correction recorded during a physical count. |
| **`EXPIRED`** | Past Expiry Date | Wastage Log | Item exceeded its designated sell-by/expiration threshold. |
| **`THEFT_OR_SHRINKAGE`** | Unaccounted Loss | Wastage Log / Adjustment | Stolen goods or discrepancies where no physical item remains. |
