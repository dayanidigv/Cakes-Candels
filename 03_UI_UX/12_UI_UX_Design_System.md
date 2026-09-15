# 12. UI/UX Design System Specification

This document details the UI/UX Design System for the Cakes & Candles ERP platform. It establishes the visual parameters, component patterns, and responsiveness rules for all portals.

---

## 1. Design Philosophy
The platform's design combines three key aspects:
* **Industrial ERP**: Dense data layouts, high-contrast states, keyboard navigability (shortcuts for all common forms), and minimum click paths.
* **Modern Retail POS**: Touch-friendly target sizing (minimum tap area of 44x44px), immediate visual response, and high-visibility status tags.
* **Premium Bakery Branding**: Polished dark background themes punctuated by a harmonized warm brand palette (rose pinks, soft creams, and rich chocolates).

---

## 1.1 UX Principles
1. **Maximum 3 clicks** to complete common workflows (e.g. log wastage, initiate transfer).
2. **POS billing under 10 seconds** from scan to checkout.
3. **No hidden critical actions** - all operational controls (void, conversion) must remain visible in their context layouts.
4. **Confirmation required** for all destructive or override actions (e.g. billing void requests, waste log deletions).
5. **Inventory alerts always visible** via the global status dashboard.
6. **Mobile-first only** for logistics dispatch delivery checks and attendance clock-ins.
7. **Tablet-first** optimization for POS Cash registers and Kitchen KDS TV setups.
8. **Dashboard widgets must be actionable** - clicking any metric card must drill down into its database detail screens.

---

## 2. Color System

### A. Brand Layer
* **Rose (Primary Accent)**: `#f43f5e` (Rose-500) - Highlights key CTA actions, logins, and primary states.
* **Cream (Secondary Backgrounds)**: `#fafaf9` (Stone-50) - Soft text colors and high contrast tags.
* **Chocolate (System Borders / Neutrals)**: `#3e2723` - Muted base backgrounds and dividers.
* **Gold (Premium Indicator)**: `#d97706` (Amber-600) - Reserved for custom cake highlight tags and VIP tiers.

### B. System Layer
* **Success**: `#10b981` (Emerald-500) - Completed states, cash in, paid status.
* **Warning**: `#f59e0b` (Amber-500) - Pending actions, indents awaiting approvals.
* **Danger**: `#ef4444` (Red-500) - Voids, invalidations, validation errors.
* **Info**: `#3b82f6` (Blue-500) - General instructions, tooltips.

### C. Operational Alert Layer
* **Inventory Alert**: `#f43f5e` (Blinks when stock < safety limits).
* **Expiry Alert**: `#f59e0b` (Triggered 2 days before expiration).
* **Transfer Alert**: `#06b6d4` (Triggered upon incoming transit dispatch).
* **Production Alert**: `#8b5cf6` (Flashes when plan run yields are below plan compliance metrics).

---

## 3. Typography System
Fonts must use the Google Font **Outfit** (modern, clean, humanist sans-serif).

| Type Class | CSS Font Size | Line Height | Usage Context |
| --- | --- | --- | --- |
| **Display** | `2.25rem` (36px) | `2.5rem` | POS big amount counters, total due labels |
| **Heading** | `1.5rem` (24px) | `2.0rem` | Page headers, module main tags |
| **Title** | `1.125rem` (18px) | `1.5rem` | Card titles, modal headers, table summaries |
| **Body** | `0.875rem` (14px) | `1.25rem` | Core labels, text fields, table row items |
| **Caption** | `0.75rem` (12px) | `1.0rem` | Expiry logs, timestamps, SKU metadata |

*Note: POS screens utilize larger typography scales (+2px offset) to ensure readability at counter heights.*

---

## 4. Component Library Specification

### Buttons
* **Primary**: `bg-color: --color-primary`, bold text, micro-scale click effect (`transform: scale(0.97)`).
* **Secondary**: Transparent background, 1px border using stone accents.
* **Danger**: `bg-color: --color-danger` for deletes, voids, cancel actions.

### Inputs & Dropdowns
* Under dark mode: 1px border opacity, dark slate background, active states marked by primary rose highlight rings.

### Tables
* Dense formats (8px vertical cell padding), auto horizontal overflow indicators, fixed headers.

### Dialogs & Alerts
* Modals slide from center or right-hand screens. Require backdrop filter blurring.

---

## 5. ERP-Specific Components

### A. Inventory Badge
Renders SKU indicators. Hover displays reorder bounds:
```text
[ SKU: RM-FLOUR-01 | Qty: 420kg ] -> Hover: "Safety level: 100kg. OK"
```

### B. Batch Card
Collapsible list element tracking `batch_number`, manufacturing date, and computed cost parameters.

### C. Expiry Indicator
Color-coded indicator tags reflecting days to expiration:
* `< 2 Days`: Flashing Red.
* `2-4 Days`: Static Amber.
* `> 4 Days`: Green outline.

### D. Stock Transfer Card
Displays origin location, destination location, and dispatch status with a linear progress bar (Requested -> Dispatched -> Completed).

### E. Dispatch Timeline
Visual tracking line displaying timestamps for drivers (Loaded -> Out for delivery -> Acknowledged at branch).

### F. Production Queue Card
Displays plan item quantity details with a checkbox to trigger kitchen ingredient allocation.

---

## 6. POS Design System

```text
+-------------------------------------------------+------------------------+
|  Product Grid (Category tabs, large SKU blocks) | Customer Lookup Panel  |
|                                                 +------------------------|
|  [Truffle Cake]  [Black Forest] [Red Velvet]   | Cart list with items   |
|  [Cupcake]       [Butterscotch] [Pineapple]    |                        |
|                                                 +------------------------|
|                                                 | Payment Panel (upi/cs) |
+-------------------------------------------------+------------------------+
```
* **Product Grid**: Large touch blocks (min 120x120px) with photo assets.
* **Inline CRM panel**: Inputs phone number, dynamically returns loyalty tier (VIP, Gold) and applies matching vouchers.
* **Payment Panel**: Single-tap actions for "Exact Cash", "UPI QR", and split-payment fields.

---

## 7. Kitchen Display System (KDS)
Optimized for 15"+ touch monitors inside hot kitchens. Includes:
* **Order Card**: Large display block indicating target items, planned batch count, eggless status flag (rendered in bold flashing text if true), and timer.
* **Priority Order Tag**: Flashing gold outline.
* **QC Queue Interface**: A single-tap panel to log yield quantities (e.g. 50 planned -> 47 pass, 3 scrap).

---

## 8. Dashboard Widgets

### KPI Dashboard Widgets (Common Styles)
* **Sales KPI**: Rupee count with comparative percentage growth markers.
* **Waste KPI**: Renders waste write-offs compared to batch production costs.
* **Production KPI**: Ratio of compliance to schedules.
* **Profit KPI**: Direct margin analytics based on cost center computations.

---

## 9. Tables & Data Grids
* **Sticky Headers**: Scroll regions lock the top headers.
* **Bulk Actions Bar**: Bottom pop-up dock when selecting multiple rows (e.g., select 10 batches -> Click "Convert to Slices" in bulk).
* **Column Pinning**: Pin crucial columns (SKU, quantity) while horizontally scrolling details.

---

## 10. Forms System
* **Validation**: Inline errors trigger instant feedback using red outlines.
* **Auto-Save**: Production planning forms auto-save state drafts to LocalStorage every 30 seconds.
* **Draft Indicators**: Status icons showing "Draft Saved Locally".

---

## 11. Notification System
Notifications popup from the screen bottom-right corner and persist based on critical priority:
* **High (Red)**: Expiry alerts, low stock thresholds. Must be manually dismissed.
* **Medium (Amber)**: Stock transfers incoming, Custom Cake assigned. Self-dismisses in 10 seconds.
* **Low (Blue)**: Sync queue complete, report generated. Self-dismisses in 5 seconds.

---

## 12. Responsive Grid Rules

| Application Module | Desktop Behavior | Tablet Behavior | Mobile Behavior |
| --- | --- | --- | --- |
| **POS Billing** | Hide sidebars; fixed width | Full screen layout; touch target grid | Disabled (Redirect to tablet POS) |
| **KDS Queue** | Grid grid alignment (4 cards) | Stack grid view (2 columns) | Scroll list list (1 column) |
| **Driver Dispatch** | Table view dashboard | Table view dashboard | Full screen map, single-column checklist |
| **Owner Dashboards** | Full desktop charts grid | Chart list layout | Read-only summaries layout |
