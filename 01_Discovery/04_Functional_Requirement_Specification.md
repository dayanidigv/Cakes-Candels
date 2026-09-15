# 04. Functional Requirement Specification (FRS)

This document provides the screen-by-screen functional specification for the Cakes & Candles ERP platform. It details screen fields, user roles, navigation entry points, validation rules, business logic, and API dependencies.

---

## Module 1: Factory Management

### Screen 1.1: Production Planner
* **Interface Reference**: Screen 06 in the UI Mockups.
* **Purpose**: Allows the Factory Manager to consolidate branch indents and generate kitchen production runs.
* **User Roles**: FACTORY_MANAGER, SUPER_ADMIN.
* **Entry Points**: Sidebar Navigation -> `Production` -> `Production Planning`.
* **Interface Fields & Elements**:
  - **Branch Demand Summary Panel**: Displays daily demand indents grouped by branch (e.g. Salem: 50 Cakes, Erode: 25 Cakes, Namakkal: 40 Cakes, Karur: 30 Cakes).
  - **Recipe Explosion Summary Panel**: Converts consolidated branch demand into required raw materials weights based on recipe master formulations (e.g. Flour: 120 kg, Cream: 80 kg, Sugar: 60 kg, Cocoa Powder: 40 kg, Chocolate: 25 kg, Eggs: 300 nos).
  - **Action Button**: `Generate Production Run` (primary rose button).
* **Validation Rules**:
  - Indents must be locked before daily cut-off time (18:00 IST).
  - Ingredient stock availability must be verified before launching the batch plan.
* **API Dependencies**: `GET /factory/indents`, `POST /factory/production-plans`.
* **State Updates**: Updates plan status to `PLANNED`, logs raw material commitments.

---

### Screen 1.2: Kitchen Display System (KDS)
* **Interface Reference**: Screen 07 in the UI Mockups.
* **Purpose**: Touchscreen task tracking for decorators and chefs on the kitchen floor.
* **User Roles**: Pastry Chef, FACTORY_MANAGER.
* **Entry Points**: Sidebar Navigation -> `Production` -> `KDS Display`.
* **Interface Fields & Elements**:
  - **Priority Custom Cakes Panel**: Highlighted list of high-margin custom orders (e.g. #CC-9204: 3Kg Princess Cake - Eggless). Action button: `Start Decorating`.
  - **Active Production Queue Cards**: Lists active runs (e.g. Run #092: Black Forest Cake, Target: 50 Cakes). Status indicators: `BAKING`, `DECORATING`. Action buttons: `Start Baking`, `Mark as Complete`.
  - **QC & Yield Inputs Form**: Inside the Complete Batch modal. Input fields: `Actual Quantity` (integer), `Wastage Quantity` (integer). Action button: `Submit Yield & QC`.
* **Validation Rules**:
  - Actual yield + wastage must equal scheduled target quantity.
  - "Eggless" flag must display in flashing bold alerts on KDS cards.
* **API Dependencies**: `PATCH /factory/production-plans/:id/status`, `POST /factory/yields`.
* **State Updates**: Moves batch status to `QC_PASSED`, increments Factory finished goods stock.

---

## Module 2: Branch Inventory & Products

### Screen 2.1: Inventory Overview & Stock Balances
* **Interface Reference**: Screen 04 in the UI Mockups.
* **Purpose**: Live stock levels lookup across warehouses.
* **User Roles**: BRANCH_MANAGER, FACTORY_MANAGER, OWNER.
* **Entry Points**: Sidebar Navigation -> `Inventory` -> `Stock Overview`.
* **Interface Fields & Elements**:
  - **Summary Widgets**: Total SKUs (542), Low Stock Items (12), Expiring Soon (18).
  - **Search Input**: Live SKU or name text filter.
  - **Stock Levels Table**: Columns: Product, Category, Stock, Reserved, Expiry.
  - **Action Button**: `View all inventory`.
* **Validation Rules**: None.
* **API Dependencies**: `GET /inventory/stock-levels`.

---

### Screen 2.2: Inventory Ledger
* **Interface Reference**: Screen 05 in the UI Mockups.
* **Purpose**: Reviewing double-entry historical stock transactions.
* **User Roles**: OWNER, BRANCH_MANAGER, FACTORY_MANAGER.
* **Entry Points**: Sidebar Navigation -> `Inventory` -> `Ledger`.
* **Interface Fields & Elements**:
  - **Date Range Picker**: Defaulted to current month.
  - **Filter Button**: Opens dropdown to select transaction type (PURCHASE, SALE, WASTE, PRODUCTION, TRANSFER_IN).
  - **Ledger Table**: Columns: Date, Type, Product, Qty, Ref No.
* **Validation Rules**: Entry modifications or deletions are completely blocked.
* **API Dependencies**: `GET /inventory/ledger`.

---

### Screen 2.3: Expiry Center & Conversions
* **Interface Reference**: Screen 09 in the UI Mockups.
* **Purpose**: Flags and acts on products nearing expiration limits.
* **User Roles**: BRANCH_MANAGER, CASHIER.
* **Entry Points**: Sidebar Navigation -> `Inventory` -> `Expiry Center`.
* **Interface Fields & Elements**:
  - **Tabs**: `Expiring Soon`, `Convert / Discount`.
  - **Expiring List Table**: Columns: Product, Expiry Date, Days Left, Recommended Action.
  - **Action Buttons**: `Convert to Slice`, `Discount Sale`, `Combo Offer`.
* **Validation Rules**:
  - Convert to Slice action is disabled if the item is not registered as convertible.
  - Slice conversion ratio: 1 Whole Cake deducts 1 unit and yields 12 Slice Cakes.
* **API Dependencies**: `GET /inventory/expiring`, `POST /inventory/conversions`.

---

### Screen 2.4: Product Master Registry
* **Interface Reference**: Screen 10 in the UI Mockups.
* **Purpose**: Product creation and metadata management.
* **User Roles**: SUPER_ADMIN, OWNER.
* **Entry Points**: Sidebar Navigation -> `Catalog` -> `Product Master`.
* **Interface Fields & Elements**:
  - **Image Uploader**: `Upload Image` block with thumbnail preview.
  - **Form Fields**: `Product Name` (text), `Category` (dropdown), `Selling Price` (decimal), `Cost Price` (decimal), `Shelf Life` (days), `HSN Code` (text), `Description` (textarea).
  - **Status Toggle**: `Active / Inactive` switch.
  - **Action Button**: `Save Product`.
* **Validation Rules**: Prices and shelf life must be positive numbers.
* **API Dependencies**: `POST /products`, `PUT /products/:id`.

---

## Module 3: Billing POS

### Screen 3.1: Sales Counter (POS Billing)
* **Interface Reference**: Screen 03 in the UI Mockups.
* **Purpose**: Retail point of sale checkout interface.
* **User Roles**: CASHIER, BRANCH_MANAGER.
* **Entry Points**: Retail portal -> `POS Billing`.
* **Interface Fields & Elements**:
  - **Product Selection Grid**: Tabbed categories (All, Cakes, Pastries, Breads, Snacks) showing cards with images, names, and retail prices.
  - **Integrated CRM Panel**: Customer Phone lookup field (`+91 98765 43210`), VIP Customer segment badge, and Loyalty Points balance.
  - **Cart Summary**: Lists active items, quantities, and net total (e.g. Total: ₹1,200).
  - **Payment Mode Buttons**: `Cash`, `UPI`, `Card`.
  - **Action Button**: `Complete Sale`.
* **Validation Rules**:
  - Checkout is blocked if local stock balance is zero.
  - Returns or voiding bills requires Owner authentication.
* **API Dependencies**: `GET /retail/customers/:phone`, `POST /retail/orders`.
* **Events Triggered**: `InvoiceCreated`, `InventoryDeducted`.

---

## Module 4: Custom Cake Orders

### Screen 4.1: Custom Cake Booking Form
* **Purpose**: Intake of bespoke cake orders with design reference files.
* **User Roles**: CASHIER, BRANCH_MANAGER.
* **Entry Points**: Sidebar Navigation -> `Sales` -> `Book Custom Cake`.
* **Interface Fields**:
  - `Customer Name` (text, required)
  - `Mobile Number` (text, required, 10 digits)
  - `Cake Type` (dropdown: 1 Layer, 2 Layer, 3 Layer)
  - `Weight` (number, required)
  - `Flavor` (dropdown)
  - `Shape` (dropdown)
  - `Design Reference` (file upload)
  - `Delivery Date` (date-time, required)
  - `Advance Payment` (decimal, required)
* **Validation Rules (from BRD)**:
  - `1 Layer` -> Minimum weight must be `1.0 kg`.
  - `2 Layer` -> Minimum weight must be `1.5 kg`.
  - `3 Layer` -> Minimum weight must be `3.0 kg`.
  - Delivery date must be at least 24 hours in the future.
* **API Dependencies**: `POST /custom-cakes`.
* **Events Triggered**: `CustomCakeCreated`.

---

## Module 5: Delivery Tracking & Logistics

### Screen 5.1: Dispatch Management & Builder
* **Interface Reference**: Screen 08 in the UI Mockups.
* **Purpose**: Creates outbound delivery loads from the Factory to branches.
* **User Roles**: DISPATCH_COORDINATOR.
* **Entry Points**: Sidebar Navigation -> `Logistics` -> `Dispatch Builder`.
* **Interface Fields & Elements**:
  - **Destination Branch**: Dropdown menu (e.g. Salem).
  - **Add Products Section**: Select SKU and input quantity (e.g. Black Forest Cake: 20, Red Velvet: 15).
  - **Logistics Assignments**: Driver dropdown (e.g. Kumar), Vehicle Number (text), Expected Delivery time selector.
  - **Action Button**: `Create Dispatch`.
* **Status Flow**:
  ```text
  [PACKED] ➔ [DISPATCHED] ➔ [ON THE WAY] ➔ [REACHED BRANCH] ➔ [RECEIVED]
  ```
* **Validation Rules**:
  - Driver and vehicle must be marked "Available".
  - Dispatched quantities cannot exceed available Factory finished goods stock.
* **API Dependencies**: `POST /logistics/dispatches`.
* **Events Triggered**: `DispatchCreated`.

---

## Module 6: CRM & Loyalty

### Screen 6.1: Customer Profiles & Loyalty
* **Purpose**: Manages customer profiles, segmentation, and campaigns.
* **User Roles**: CRM_EXECUTIVE, OWNER.
* **Entry Points**: Sidebar Navigation -> `CRM`.
* **Features**:
  - **Customer Database**: Dynamic lists of customers, tiers (Bronze, Silver, Gold, VIP), and loyalty transactions logs.
  - **Birthday & Anniversary Reminders**: Daily triggers scanning customer date logs.
  - **WhatsApp Campaigns**: Batch template dispatchers (integrates with template codes).
* **Validation Rules**:
  - WhatsApp messages can only utilize pre-approved templates.
* **API Dependencies**: `POST /crm/campaigns`, `GET /crm/customers/:id`.

---

## Module 7: HR & Attendance

### Screen 7.1: Employee Attendance & Shift Tracking
* **Purpose**: Logs daily staff attendance and shifts details.
* **User Roles**: HR_EXECUTIVE, BRANCH_MANAGER.
* **Entry Points**: Sidebar Navigation -> `HR` -> `Attendance`.
* **Features**:
  - **Employee Punch Log**: Logs daily check-ins and check-outs.
  - **Daily Shift Schedulers**: Configures shift allocations per location.
* **Daily Closing Rules & Locks**:
  > [!IMPORTANT]
  > **Daily closing constraint**: Shift and Attendance records cannot be closed, and register tallies cannot be submitted, until the daily production yield reports (for Factory) and retail sales reports (for branches) are successfully uploaded and reconciled.
* **API Dependencies**: `POST /hr/attendance/clock-in`, `PATCH /finance/cash-registers/:id/close`.
