# Cakes & Candles ERP - API Architecture Specification

This document details the RESTful API endpoints for the Cakes & Candles ERP platform.

---

## Base URL
`https://api.erp.cakesandcandles.com/v1`

---

## 1. Authentication & User Management
* **POST** `/auth/login`
  - Body: `{ username, password }`
  - Response: `{ token, user: { id, username, role, location_id } }`
* **POST** `/auth/logout`
  - Auth required. Clears session/token.

---

## 2. Multi-Warehouse Inventory & Logistics
* **GET** `/inventory/items`
  - Query parameters: `category`, `search`, `page`, `limit`
  - Response: List of products (SKUs, names, UoMs).
* **GET** `/inventory/stock-levels`
  - Query parameters: `location_id`, `item_id`
  - Response: Real-time stock levels grouped by location, item, and batch.
* **POST** `/inventory/transfers`
  - Auth: Warehouse manager/Logistics
  - Body: `{ from_location_id, to_location_id, items: [ { item_id, batch_id, quantity } ] }`
  - Response: Created transfer sheet.

---

## 3. Factory Operations
* **POST** `/factory/recipes`
  - Body: `{ finished_good_id, name, yield_quantity, yield_unit, ingredients: [ { raw_material_id, quantity, unit } ] }`
* **POST** `/factory/production-plans`
  - Create daily production schedule.
  - Body: `{ plan_date, recipes: [ { recipe_id, target_quantity } ] }`
* **PATCH** `/factory/production-plans/:id/status`
  - Body: `{ status: "IN_PROGRESS" | "COMPLETED", items: [ { recipe_id, produced_quantity, qc_status } ] }`
  - *Side Effect*: Updates stock balances (consumes raw materials based on recipes, yields finished goods into factory stock).

---

## 4. Retail Commerce (POS)
* **GET** `/retail/customers/:phone`
  - Fetches customer 360 profile, loyalty balance, and transaction history.
* **POST** `/retail/orders`
  - Auth: POS operator
  - Body: `{ customer_phone, items: [ { item_id, quantity, discount } ], payment_mode, payment_details }`
  - Response: Invoice PDF link, receipt payload, loyalty points earned.

---

## 5. Custom Cake Operations
* **POST** `/custom-cakes/orders`
  - Body: `{ order_id, design_image_url, flavor, cream_type, eggless, special_instructions, weight_kg, scheduled_pickup_delivery, delivery_type, delivery_address }`
* **GET** `/custom-cakes/pipeline`
  - Query parameters: `status`, `assigned_chef_id`
  - Response: Custom cakes kanban/pipeline items.
* **PATCH** `/custom-cakes/:id/status`
  - Body: `{ status: "BAKING" | "DECORATING" | "READY_FOR_PICKUP" | "DELIVERED" }`
  - *Side Effect*: Triggers WhatsApp notification to customer when status changes to `READY_FOR_PICKUP`.

---

## 6. CRM & WhatsApp Marketing
* **POST** `/crm/campaigns`
  - Body: `{ name, channel: "WHATSAPP", template_content, filters: { segment: "BIRTHDAY_TODAY" | "LAPSED_30_DAYS" } }`
* **GET** `/crm/customers/:id/timeline`
  - Timeline of purchases, custom cake bookings, and communications sent.
