# 20. Frontend Task Breakdown

This document provides the developer task list for building the Cakes & Candles ERP frontend layout structure.

---

## 1. Shared UI Components (Design System Library)
These foundational components are developed in `/packages/shared-ui` and utilized across all 3 portals:
* **`Button`**: Highly responsive button wrapping brand color modes (Primary Rose, Secondary Slate, Danger Red), loading indicators, disabled styles, and active hover scales.
* **`Input`**: Text field wrapper with validation borders, left/right icons, and floating placeholder labels.
* **`Select`**: Dynamic dropdown select widget supporting multi-select parameters and virtualized row scroll.
* **`Modal`**: Base backdrop overlay wrapper with slide-in animation anchors (center or drawer format).
* **`DataTable`**: Dense table mapping column pinning, pagination scrolls, bulk row selection boxes, and column sorting.
* **`Badge`**: Status chip (Success Emerald, Warning Amber, Danger Red, VIP Gold).
* **`Card`**: Base panel containers incorporating brand borders, loading skeleton placeholders, and hover scale transitions.
* **`Tabs`**: Segment selection bars (Category pills, status headers).
* **`Toast`**: Global message boxes sliding in from bottom right (Red/Amber/Blue dismiss levels).
* **`FileUploader`**: Drag-and-drop file target mapping upload progress states and S3 triggers.

---

## 2. POS App Components (`apps/web-pos`)
* **`ProductGridContainer`**: Renders category pills list and filters catalog lists based on active category.
* **`ProductCard`**: Individual grid blocks display images, price tags, and add-to-cart clicks.
* **`CustomerLookupPanel`**: Input search phone numbers, queries loyalty tiers, and formats point options overlays.
* **`CartSummary`**: Displays quantity selectors, line item detail listings, and GST cost totals.
* **`PaymentPanel`**: UPI QR display modals and cash change calculators.
* **`RegisterCloseForm`**: Shifts closing cash reconciliation calculator interfaces.

---

## 3. Admin App Components (`apps/web-admin`)
* **`KPIWidget`**: Renders executive sales cards with percentage difference vectors.
* **`SalesChart`**: Chart library (Chart.js / Recharts) rendering sales line segments.
* **`LowStockAlertPanel`**: Displays items falling below threshold configurations.
* **`BranchPerformanceTable`**: Branch rankings grids.
* **`ReportsDashboard`**: PDF rendering portals and CSV tables downloads trigger buttons.

---

## 4. KDS App Components (`apps/web-kds`)
* **`PriorityCakeCard`**: Specialty cards featuring gold warning borders, custom flavor specs, and decoration timers.
* **`KDSJobCard`**: Kitchen layout cards displaying recipes, plan targets, status checkboxes, and active timers.
* **`YieldQCModal`**: Touch form to input actual pass quantities and waste write-offs.

---

## 5. API Hooks (TanStack React Query)
Custom React hooks targeting core REST routes:
* **`useAuth`**: Manages login POST submissions and refresh triggers.
* **`useProducts`**: Fetches product listings and triggers updates on additions.
* **`useStockLevels`**: Live inventory hooks query location-specific inventory caches.
* **`useProductionPlans`**: Loads active manufacturing scheduler.
* **`usePOSCheckout`**: Handles order invoice creation and updates inventory caches.

---

## 6. Client Zustand Stores
* **`useAuthStore`**: Manages current user object, access JWT tokens, location IDs, and active permissions array.
* **`useCartStore`**: Local POS checkout basket array state: items, quantities, applied discounts, customer loyalty redemptions.
* **`useNotificationStore`**: Stack of active WebSocket message indicators (stock alerts, transfer arrivals).

---

## 7. Validation Schemas (Zod / Yup)
* **`LoginSchema`**: Username minimum 3 characters, password not empty.
* **`ProductSchema`**: SKU must match format, pricing must be positive decimals, shelf life > 0.
* **`CustomCakeSchema`**: Enforces layer constraints:
  - 1 Layer $\rightarrow$ Min Weight = `1.0 kg`
  - 2 Layer $\rightarrow$ Min Weight = `1.5 kg`
  - 3 Layer $\rightarrow$ Min Weight = `3.0 kg`
* **`WastageSchema`**: Quantity must not exceed batch stock levels; reason code must match enum list.
* **`DailyClosingSchema`**: Physical cash counted must match numeric parameters; closing notes must be provided if variance != 0.

---

## 8. Frontend Testing Checklist
* **Theme & Tokens**: Verify all components pull variables from core CSS design tokens.
* **POS Offline Mock**: Simulate internet disconnects; verify orders save to IndexedDB tables and local stock reservation levels decrement correctly.
* **KDS Timer Accuracy**: Verify active kitchen timers tick accurately without resetting upon queue updates.
* **Form Validators**: Submit invalid layer configurations and verify error validations trigger correctly.
