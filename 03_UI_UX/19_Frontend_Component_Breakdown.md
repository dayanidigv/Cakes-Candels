# 19. Frontend Component Breakdown

This document provides the frontend modular component breakdown for the Cakes & Candles ERP applications. It bridges the gap between the UI design screens and component-driven coding.

---

## 1. Screen Component Trees

### A. POS Billing
The core cashier checkout module inside `apps/web-pos`:
```text
POSBilling (Container / Page)
├── ProductSearch (Text input with barcode scanner listener)
├── CategoryTabs (Horizontal selection tabs for category pills)
├── ProductGrid (Grid compiler of active SKU cards)
│    └── ProductCard (Renders photo, title, price, add click)
├── CustomerLookupPanel (Lookup form with points metrics display)
│    └── VIPBadge (VIP segment indicator)
├── CartSummary (Cart item stack compiler)
│    └── CartItemRow (SKU name, quantity buttons, line total)
├── PaymentSelector (Buttons list for cash, UPI, card, and splits)
└── CompleteSaleButton (Checkout trigger button)
```

### B. Owner Dashboard
The high-level manager screen inside `apps/web-admin`:
```text
OwnerDashboard (Container / Page)
├── KPIWidget (Animated metric cards for Sales, Profit, Wastage)
├── SalesChart (Line graph showing daily sales trends)
├── AlertsPanel (Scrolling log list for low stock and expiry events)
├── BranchPerformanceTable (Sorted leaderboards of branch sales)
└── CustomCakeTimeline (Timeline tracking pending custom cake counts)
```

### C. Production Planner
The daily scheduler layout:
```text
ProductionPlanner (Container / Page)
├── BranchDemandConsolidator (Aggregated indents list)
├── RecipeExplosionDisplay (Recipe ingredient conversion weights details)
└── BatchRunCreator (Form mapping chef assignments and run sizes)
```

### D. Inventory Overview
```text
InventoryOverview (Container / Page)
├── InventorySummaryCards (Total SKU, Low Stock, Expiring counters)
├── StockSearchBar (Live search input)
├── StockStatusFilter (All/Low Stock/Expiring filter selectors)
├── StockBalanceTable (List of products, categories, stock, reserved, and expiry status values)
└── LowStockAlertPanel (Banner highlighting items below reorder levels)
```

### E. Inventory Ledger
```text
InventoryLedger (Container / Page)
├── LedgerDateRangePicker (Start date to end date selector)
├── LedgerTypeFilter (Transaction type dropdown selector)
├── LedgerTable (Lists historical inventory log records)
└── ExportLedgerButton (CSV/PDF export action button)
```

### F. Wastage Form
```text
WastageForm (Container / Page)
├── ProductBatchSelector (Dropdown selectors for product and active batch)
├── DamageReasonDropdown (Spoiled, Damaged, Expired picker)
├── PhotoUploader (Upload damage references images)
├── QuantityInput (Number field constraint validation)
└── SubmitForApprovalButton (Submits to owner wastage queue)
```

### G. Kitchen Display System (KDS)
The kitchen touchscreen display inside `apps/web-kds`:
```text
KDSDisplay (Container / Page)
├── PriorityCakeCard (Highlight design references and decoration tags)
├── KDSQueueGrid (Active kitchen card lists)
│    └── KDSJobCard (Timer, baking progress tags, complete button)
└── YieldQCModal (Form input logging actual yield vs waste weights)
```

### E. Dispatch Builder
The logistics manifests compiler:
```text
DispatchBuilder (Container / Page)
├── DispatchForm (Destination dropdown selectors)
├── VehicleDriverSelector (Truck availability checks)
└── ManifestGrid (SKU, batch, and transfer quantity lists)
```

### F. Expiry Center
The warning lists dashboards:
```text
ExpiryCenter (Container / Page)
├── ExpiringSoonTable (List showing days to expiry)
└── ConversionOptionsDialog (Whole-to-slice conversions actions)
```

### G. Product Master
The catalog management layout:
```text
ProductMaster (Container / Page)
├── ImageUploader (Drag-and-drop file interface)
├── ProductDetailForm (SKU, name, selling/cost price inputs)
└── StatusToggle (Active/Inactive state toggle switch)
```

---

## 2. Component Props & State Specifications

### A. `ProductGrid` Component
* **Props**:
  - `products`: `ProductPayload[]` (Array of items to render in active catalog)
  - `onAddItem`: `(productId: string) => void` (Triggered on item selection)
* **Local State**:
  - `activeTab`: `string` (Current category tab pill selected)
  - `searchQuery`: `string` (Text filter string value)

### B. `CustomerLookupPanel` Component
* **Props**:
  - `onCustomerApply`: `(customer: CustomerPayload) => void` (Sets active customer details in checkout cart)
* **Local State**:
  - `phoneNumber`: `string` (10-digit customer query input)
  - `isLoading`: `boolean` (Fetch status spinner control)
  - `foundCustomer`: `CustomerPayload | null` (Returned database profile payload)

### C. `KDSJobCard` Component
* **Props**:
  - `job`: `ProductionJobPayload` (Current batch details, chef, targets)
  - `onStatusChange`: `(jobId: string, status: string) => void` (Updates job progress on backend)
* **Local State**:
  - `elapsedTime`: `number` (Baking/decorating active runtime counter)
  - `showQCModal`: `boolean` (Triggers yield logging modal popup)
