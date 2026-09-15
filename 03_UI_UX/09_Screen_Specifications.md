# 09. Screen Specifications

This document defines the functional specifications for the 15 core MVP screens of the Cakes & Candles ERP platform.

---

## 1. Login Screen
* **Screen Name**: Login
* **Purpose**: Authenticates system operators and redirects them to their designated portals.
* **User Roles**: All Roles.
* **Entry Points**: Default application root route (`/login`).
* **Fields**:
  - `username` (text, required)
  - `password` (password, required)
* **Filters**: None.
* **Actions**:
  - `Submit`: Submits authentication request.
* **Validation Rules**: Minimum 3 characters for username, password not empty.
* **Business Rules Applied**: BR-005 (role boundaries).
* **Permissions Required**: Guest access (unauthenticated).
* **API Dependencies**: `POST /auth/login`.
* **Success States**: Access token saved; redirect to designated role dashboard.
* **Error States**: "Invalid credentials", "Account inactive".
* **Responsive Behavior**: Centered card. Fluid width matching mobile, tablet, and desktop screens.

---

## 2. Dashboard
* **Screen Name**: Operational Dashboard
* **Purpose**: Displays KPI indicators and action triggers tailored to the logged-in user's role.
* **User Roles**: OWNER, FACTORY_MANAGER, BRANCH_MANAGER.
* **Entry Points**: Left sidebar `Home` link.
* **Fields**: (Outputs only) Total sales counters, low stock lists, pending transfers, pending custom orders.
* **Filters**: Location filter (available to OWNER and Admin only).
* **Actions**:
  - `Inspect`: Click widget card to redirect to full module list.
* **Validation Rules**: None.
* **Business Rules Applied**: BR-001.1 (low stock indicators).
* **Permissions Required**: View rights on respective domains.
* **API Dependencies**: `GET /dashboard/kpis`, `GET /dashboard/alerts`.
* **Success States**: Cards show refreshed numbers with micro-animations.
* **Error States**: Service unavailable alert, fallback empty states.
* **Responsive Behavior**: Responsive CSS grid (1 column on mobile, 2 columns on tablet, 4 columns on desktop).

---

## 3. Product Master Screen
* **Screen Name**: Product Master
* **Purpose**: Allows administration of catalog SKUs, classifications, and price points.
* **User Roles**: SUPER_ADMIN, OWNER.
* **Entry Points**: Left sidebar `Catalog` -> `Products`.
* **Fields**:
  - `sku` (text, required, unique)
  - `name` (text, required)
  - `category` (dropdown, required)
  - `unit_of_measure` (dropdown, required)
  - `shelf_life_days` (number)
  - `base_cost` (decimal)
  - `retail_price` (decimal)
* **Filters**: Search query by name/SKU, category dropdown.
* **Actions**:
  - `Add Product`: Opens creation modal.
  - `Save`: Submits details.
  - `Toggle Status`: Disables/enables product.
* **Validation Rules**: SKU must follow format `SKU-XXXX`. Prices must be positive values.
* **Business Rules Applied**: BR-001 (shelf life configuration).
* **Permissions Required**: `CREATE`, `UPDATE` on Product domain.
* **API Dependencies**: `GET /inventory/items`, `POST /inventory/items`, `PUT /inventory/items/:id`.
* **Success States**: Success toast notification, catalog table updates.
* **Error States**: "SKU already exists", "Incomplete fields".
* **Responsive Behavior**: Full table list view on desktop; card layout with stack scrolls on mobile/tablet.

---

## 4. POS Billing Register
* **Screen Name**: POS Billing
* **Purpose**: Fast retail sales processing and checkout.
* **User Roles**: CASHIER, BRANCH_MANAGER.
* **Entry Points**: Retail portal -> `POS Billing`.
* **Fields**:
  - `customer_phone` (text)
  - `search_sku` (text / scanner input)
  - `payment_mode` (dropdown: Cash, UPI, Card, Points)
  - `cash_paid` (decimal)
* **Filters**: Item category filter buttons.
* **Actions**:
  - `Search Customer`: Triggers search callback.
  - `Add Item to Cart`: Increments line count.
  - `Apply Discount`: Modifies line totals.
  - `Checkout`: Generates receipt and closes invoice.
* **Validation Rules**: Payment mode must cover total invoice value.
* **Business Rules Applied**: BR-004 (loyalty calculation), BR-005 (void restriction).
* **Permissions Required**: `CREATE` on POS Orders.
* **API Dependencies**: `GET /retail/customers/:phone`, `POST /retail/orders`.
* **Success States**: Success modal, prints receipt via thermal client, cart clears.
* **Error States**: "Insufficient stock balance", "Invalid coupon code".
* **Responsive Behavior**: Optimized for 10-inch tablets (dual-pane layout: catalog left, checkout cart right).

---

## 5. Inventory Overview
* **Screen Name**: Inventory Overview
* **Purpose**: Live stock levels across warehouses.
* **User Roles**: OWNER, FACTORY_MANAGER, BRANCH_MANAGER.
* **Entry Points**: Left sidebar `Inventory` -> `Stock Overview`.
* **Fields**: Search input.
* **Filters**: Location filter (Defaulted to user location for managers; filterable for Owner), Category filter.
* **Actions**:
  - `Export PDF / CSV`: Downloads matching tables.
* **Validation Rules**: None.
* **Business Rules Applied**: BR-001.1 (low stock alerts).
* **Permissions Required**: `VIEW` on Inventory.
* **API Dependencies**: `GET /inventory/stock-levels`.
* **Success States**: Table loads and flags items below safety thresholds in red.
* **Error States**: Timeout, connection failed.
* **Responsive Behavior**: Tabular data, horizontal scroll on mobile view.

---

## 6. Inventory Ledger
* **Screen Name**: Inventory Ledger
* **Purpose**: Reviewing double-entry historical stock transactions.
* **User Roles**: OWNER, FACTORY_MANAGER, BRANCH_MANAGER.
* **Entry Points**: Left sidebar `Inventory` -> `Ledger`.
* **Fields**: None.
* **Filters**: Start date, end date, transaction type, location, SKU search.
* **Actions**: None (View-only log).
* **Validation Rules**: None.
* **Business Rules Applied**: Immutable ledger rules (No delete actions).
* **Permissions Required**: `VIEW` on Inventory.
* **API Dependencies**: `GET /inventory/ledger`.
* **Success States**: Loaded logs showing debit/credit movements.
* **Error States**: Date range constraint errors.
* **Responsive Behavior**: Desktop optimized. Column visibility toggle dynamically handles mobile displays.

---

## 7. Stock Transfer
* **Screen Name**: Stock Transfer Dashboard
* **Purpose**: Request and dispatch inventory moves between branches.
* **User Roles**: BRANCH_MANAGER, FACTORY_MANAGER, OWNER.
* **Entry Points**: Left sidebar `Inventory` -> `Transfers`.
* **Fields**:
  - `to_location_id` (dropdown)
  - `transfer_items` (array: product_id, quantity)
* **Filters**: Sent transfers, received transfers, status tabs (Draft, Requested, Dispatch, Completed).
* **Actions**:
  - `Request Transfer`: Submits request.
  - `Dispatch Goods`: Dispatches items.
  - `Receive / Accept`: Verifies and accepts incoming stock.
* **Validation Rules**: Cannot transfer more than the active stock balance.
* **Business Rules Applied**: Double-entry ledger updates.
* **Permissions Required**: `CREATE`, `APPROVE` on Inventory.
* **API Dependencies**: `POST /inventory/transfers`, `PATCH /inventory/transfers/:id/status`.
* **Success States**: Status badges update, inventory levels increment/decrement.
* **Error States**: "Quantity not available", "Transit variance detected".
* **Responsive Behavior**: Split-screen lists, fully scrollable details pane on tablets/desktops.

---

## 8. Wastage Form
* **Screen Name**: Wastage Logging
* **Purpose**: Logs item spoilages for QA review and write-off.
* **User Roles**: CASHIER, BRANCH_MANAGER.
* **Entry Points**: POS portal -> `Log Wastage`.
* **Fields**:
  - `product_id` (dropdown)
  - `batch_id` (dropdown)
  - `quantity` (number)
  - `reason` (dropdown: Spoiled, Damaged, Expired)
* **Filters**: None.
* **Actions**:
  - `Log Waste`: Submits item for quarantine block.
* **Validation Rules**: Wastage quantity must be positive and within stock bounds.
* **Business Rules Applied**: Wastage approval workflow rules.
* **Permissions Required**: `CREATE` on Inventory.
* **API Dependencies**: `POST /inventory/wastage`.
* **Success States**: Quarantine success indicator, adds to the active write-off queue.
* **Error States**: "Batch mismatch", "Permissions denied".
* **Responsive Behavior**: Simple card form optimized for mobile and tablet entries.

---

## 9. Expiry Management
* **Screen Name**: Expiry & Conversions Manager
* **Purpose**: Flags and acts on products nearing expiration limits.
* **User Roles**: BRANCH_MANAGER, CASHIER.
* **Entry Points**: Left sidebar `Inventory` -> `Expiry alerts`.
* **Fields**: Multi-select row selectors.
* **Filters**: Days to expiry slider.
* **Actions**:
  - `Trigger Discount`: Applies discount rates (e.g. 30%).
  - `Convert to Slices`: Executes whole-to-slice conversions.
* **Validation Rules**: Only whole cakes can trigger slice conversions.
* **Business Rules Applied**: BR-001 (expiry triggers), BR-003 (whole to slice conversion).
* **Permissions Required**: `UPDATE` on Inventory.
* **API Dependencies**: `GET /inventory/expiring`, `POST /inventory/conversions`.
* **Success States**: Success toast notification, displays new product slice counts.
* **Error States**: "Product not convertible".
* **Responsive Behavior**: Card-based alert views on tablets; grid views on desktop.

---

## 10. Production Planner
* **Screen Name**: Factory Production Planner
* **Purpose**: Review branch demands and schedule runs.
* **User Roles**: FACTORY_MANAGER.
* **Entry Points**: Factory portal -> `Planner`.
* **Fields**:
  - `plan_date` (date)
  - `recipe_id` (dropdown)
  - `target_quantity` (number)
* **Filters**: Plan date.
* **Actions**:
  - `Consolidate Indents`: Automatically reviews indents.
  - `Launch Batch Plan`: Generates production run orders.
* **Validation Rules**: Date must be in the future.
* **Business Rules Applied**: BR-002 (Daily 18:00 cut-off bounds validation).
* **Permissions Required**: `CREATE`, `UPDATE` on Manufacturing.
* **API Dependencies**: `GET /factory/indents`, `POST /factory/production-plans`.
* **Success States**: Schedules show in calendar view, recipe lists populate.
* **Error States**: "Cut-off time exceeded".
* **Responsive Behavior**: Desktop optimized interface (dual-column layout).

---

## 11. Production Queue (KDS)
* **Screen Name**: Kitchen Display System (KDS)
* **Purpose**: Touchscreen task tracking for chefs.
* **User Roles**: FACTORY_MANAGER, Pastry Chef.
* **Entry Points**: Factory portal -> `KDS Display`.
* **Fields**: Status click handlers.
* **Filters**: Plan date, batch priority.
* **Actions**:
  - `Start Baking`: Sets status to IN_PROGRESS.
  - `Complete Run`: Opens QC dialog.
  - `Submit QC`: Logs Yield and QC metrics.
* **Validation Rules**: Yield records must define actual output.
* **Business Rules Applied**: Recipe consumption adjustments.
* **Permissions Required**: `UPDATE`, `APPROVE` on Manufacturing.
* **API Dependencies**: `PATCH /factory/production-plans/:id/status`, `POST /factory/yields`.
* **Success States**: Dashboard card advances to the next step, updates live inventory.
* **Error States**: "Stock ingredients insufficient for recipe run".
* **Responsive Behavior**: Built for wall-mounted 15-inch touchscreens (large, high-contrast tap interfaces).

---

## 12. Dispatch Builder
* **Screen Name**: Logistics Dispatch Manifests
* **Purpose**: Compiles truck/delivery load lists.
* **User Roles**: DISPATCH_COORDINATOR.
* **Entry Points**: Left sidebar `Logistics` -> `New Dispatch`.
* **Fields**:
  - `vehicle_id` (dropdown)
  - `driver_id` (dropdown)
  - `destination_location_id` (dropdown)
  - `manifest_items` (array: SKU, Batch, Qty)
* **Filters**: None.
* **Actions**:
  - `Submit Manifest`: Locks items as IN_TRANSIT.
* **Validation Rules**: Driver and vehicle must be active and available.
* **Business Rules Applied**: Stock updates to Transit Hub locations.
* **Permissions Required**: `CREATE` on Logistics.
* **API Dependencies**: `POST /logistics/dispatches`.
* **Success States**: Prints dispatch sheet, lists manifest details.
* **Error States**: "Vehicle already assigned".
* **Responsive Behavior**: Grid tables on desktop; list scrolls on tablet/mobile screens.

---

## 13. Customer Lookup
* **Screen Name**: CRM Customer Query
* **Purpose**: Fast profile checks during billing.
* **User Roles**: CASHIER, BRANCH_MANAGER, CRM_EXECUTIVE.
* **Entry Points**: Inline POS checkout or Left sidebar `CRM` -> `Customer Lookup`.
* **Fields**:
  - `phone_query` (text)
* **Filters**: None.
* **Actions**:
  - `Fetch Profile`: Pulls CRM timeline logs.
  - `Add Loyalty Account`: Registers a new customer.
* **Validation Rules**: Phone number must contain precisely 10 digits.
* **Business Rules Applied**: BR-004 (loyalty mechanics).
* **Permissions Required**: `VIEW`, `CREATE` on CRM.
* **API Dependencies**: `GET /retail/customers/:phone`, `POST /retail/customers`.
* **Success States**: Displays name, current tier, active coupons, points timeline.
* **Error States**: "Customer profile not found".
* **Responsive Behavior**: Modal drawer popup sliding in from the right edge on POS screens.

---

## 14. Daily Closing
* **Screen Name**: Daily Register Close
* **Purpose**: Cash register reconciliations and drawer counts.
* **User Roles**: CASHIER, BRANCH_MANAGER.
* **Entry Points**: Branch dashboard -> `Daily Closing`.
* **Fields**:
  - `actual_cash_count` (decimal)
  - `actual_upi_count` (decimal)
  - `actual_card_count` (decimal)
  - `closing_notes` (text)
* **Filters**: None.
* **Actions**:
  - `Submit Reconcile`: Closes shift register.
* **Validation Rules**: Closing entry can only be done if shift register was marked OPEN.
* **Business Rules Applied**: Finance rules.
* **Permissions Required**: `CREATE` on Finance.
* **API Dependencies**: `PATCH /finance/cash-registers/:id/close`.
* **Success States**: Lock register, generate closing shift PDF receipt.
* **Error States**: "Shift mismatch detected".
* **Responsive Behavior**: Vertical card form optimized for mobile/tablet checkouts.

---

## 15. Reports Dashboard
* **Screen Name**: Executive Reports
* **Purpose**: Analytics and KPI snapshot evaluations.
* **User Roles**: OWNER, ACCOUNTANT.
* **Entry Points**: Left sidebar `Reports`.
* **Fields**: None.
* **Filters**: Date range picker, Location selector, Report Type (P&L, Waste, Yield).
* **Actions**:
  - `Download CSV`: Exports matching results.
  - `Print PDF`: Generates print layouts.
* **Validation Rules**: Date range limits capped at 12 months.
* **Business Rules Applied**: Cost center calculations.
* **Permissions Required**: `VIEW`, `EXPORT` on Finance & Analytics.
* **API Dependencies**: `GET /reports/kpi-snapshots`.
* **Success States**: Renders interactive metrics charts.
* **Error States**: "Access denied for specified cost center".
* **Responsive Behavior**: Responsive analytics view (grid rows collapse on mobile).
