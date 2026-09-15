# 11. Frontend Application Architecture

This document details the frontend implementation strategy, directory architecture, client state mechanics, offline checkout logic, and design token configurations for the Cakes & Candles ERP system.

---

## 1. Monorepo Strategy (Application Architecture)
The client application is built as a monorepo (using Turborepo or Nx) to isolate concern areas while sharing components:

```text
apps/
 ├── web-admin (Owner Portal & Reports. Highly analytical, heavy charting, desktop only)
 ├── web-pos   (Branch Billing Portal. Optimized for touch screens, offline-first execution, tablet-first)
 ├── web-kds   (Kitchen Display System. Rapid live reloading, simplified gesture commands, large TV/tablet formats)
 └── shared-ui (Shared Component library containing Design Token declarations and wrappers)
```

---

## 2. Routing & Route Guards
All client routing (using React Router or Next.js App Router) uses layout wrappers protected by role guards:

```typescript
// Example Route Guard logic
const protectedRoutes = [
  { path: "/owner/*", allowedRoles: ["OWNER", "SUPER_ADMIN"] },
  { path: "/factory/*", allowedRoles: ["FACTORY_MANAGER", "SUPER_ADMIN"] },
  { path: "/branch/*", allowedRoles: ["BRANCH_MANAGER", "CASHIER", "OWNER"] },
  { path: "/finance/*", allowedRoles: ["ACCOUNTANT", "OWNER"] }
];
```

---

## 3. Layout System
Each portal uses a dedicated layout file containing:
* **Sidebar**: Section navigation links restricted by dynamic roles.
* **Header**: Displays current User profile and Location context.
* **Notifications**: Central alert bell (WebSocket feeds).
* **Quick Actions**: Hotkey commands (e.g. `F1` to search products in POS, `F2` to trigger waste log).

---

## 4. Client State Management (Zustand & React Query)
Avoid Redux boilerplate. The application splits state into two frameworks:

### Global Client State (Zustand)
```typescript
interface GlobalState {
  user: UserPayload | null;
  permissions: string[];
  currentLocationId: string;
  theme: "light" | "dark";
  notifications: AppNotification[];
  setContext: (locationId: string) => void;
}
```

### Domain Server Cache State (TanStack React Query)
Pulls dynamic entity arrays from backend. Handles automatic caching, polling, and invalidation:
* `/inventory/stock-levels` (invalidated when transaction posted)
* `/factory/production-plans` (refetched via KDS notifications)
* `/retail/customers/:phone` (cached for checkout reference)

---

## 5. Shared API Layer Structure
All endpoints map to isolated service classes:
```text
src/api/
 ├── auth.api.ts
 ├── product.api.ts
 ├── inventory.api.ts
 ├── manufacturing.api.ts
 ├── pos.api.ts
 └── hr.api.ts
```
*Note: API calls utilize a pre-configured Axios / Fetch client wrapping Authorization tokens and global error interceptors.*

---

## 6. Frontend Permission System
RBAC is component-driven. Elements render conditionally based on client checks:

```tsx
// Permission Guard Component wrapper
export const PermissionGuard: React.FC<{
  permission: "CanViewInventory" | "CanApproveWaste" | "CanVoidInvoice";
  children: React.ReactNode;
  fallback?: React.ReactNode;
}> = ({ permission, children, fallback = null }) => {
  const { userPermissions } = useAuthStore();
  return userPermissions.includes(permission) ? <>{children}</> : <>{fallback}</>;
};
```

---

## 7. Component Library
Shared UI elements developed under `/packages/shared-ui` containing:
* **DataTable**: Multi-column sorting table with dynamic page scrolls.
* **POSCart**: Fast checkout basket with item modifiers and math summaries.
* **CustomerLookup**: Fast phone lookup form returning customer segment badges.
* **KanbanBoard**: Interactive drag-and-drop workflow tracking board.
* **KPIWidget**: Animated summary statistics card.

---

## 8. Offline POS Strategy
Since internet failures can halt retail branches, the `web-pos` app acts as an offline-first client:

```text
POS Transaction Request
        │
  [Online Check?]
    ├── Yes ➔ POST directly to Server API
    └── No  ➔ Store in Local IndexedDB Queue ➔ Set Status: "PENDING_SYNC"
```

### Technical Workflow
1. **Local Storage**: Transactions are serialized and written to IndexedDB.
2. **Dynamic Stock Reservation**: Local memory decrements the cached branch inventory to prevent double-selling before synchronization.
3. **Background Sync Worker**: An active Service Worker polls connection status. Once connectivity restores, it loops through the IndexedDB queue and submits POST orders to `/retail/orders`.
4. **Conflict Resolution**: The backend assigns the order UUID. In case of pricing mismatch, the server's matched rate takes precedence, and updates are synchronized back to the client.

---

## 9. Real-Time Architecture (SSE & WebSockets)
Allows dashboards and KDS display units to update without manual reload.
* **Kitchen KDS**: Listens to channel `production-plans:created` to append new runs.
* **Owner Dashboard**: Listens to channel `kpi:refresh` to increment total sales cards.
* **Branch Portal**: Listens to channel `dispatch:arrived` to trigger incoming transfer notifications.

---

## 10. Centralized Error Interceptor
Global interceptors intercept API exceptions:
* **Validation (400)**: Highlights form inputs in red, displays validation messages.
* **Permission (403)**: Triggers permission restriction modal.
* **Network (500 / Timeout)**: Automatically checks offline state and activates IndexedDB buffers for POS orders.

---

## 11. Notification System
Notifications are triggered via WebSockets and categorized dynamically:
* `LOW_STOCK_ALERT`: Triggered when item quantity drops below threshold.
* `EXPIRY_WARNING`: Triggered 2 days before expiration.
* `CUSTOM_CAKE_READY`: Triggered when cake progresses to READY.

---

## 12. Frontend Folder Structure
Standard folder structure for portals and shared components:
```text
src/
 ├── app/                 # Next.js App routing
 ├── components/          # Reusable shared components (buttons, text inputs)
 ├── hooks/               # Custom React hooks (useAuth, useLocalStorage)
 ├── layouts/             # Shared Portal Wrapper Layouts
 ├── modules/             # Main Feature Modules
 │    ├── pos/
 │    ├── inventory/
 │    └── manufacturing/
 ├── services/            # API call class wraps
 ├── store/               # Zustand state files
 └── utils/               # String helpers, date formatters
```

---

## 13. Design Token System (CSS System variables)
Declares the baseline tokens to guarantee cross-portal styling consistency:

```css
:root {
  /* Color Palette */
  --color-primary: #f43f5e;       /* Rose-500 (Brand Red) */
  --color-primary-hover: #e11d48; /* Rose-600 */
  --color-success: #10b981;       /* Emerald-500 */
  --color-warning: #f59e0b;       /* Amber-500 */
  --color-danger: #ef4444;        /* Red-500 */
  --color-bg-dark: #0f172a;       /* Slate-900 */
  --color-panel-dark: #1e293b;    /* Slate-800 */
  
  /* Spacing Scale */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;

  /* Typography Scale */
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.25rem;
  --font-size-xl: 1.5rem;
  --font-size-2xl: 2rem;

  /* Borders & Shadows */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --shadow-sm: 0 1px 2px 0 rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1);
}
```
