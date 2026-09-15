# 06. Database Design Specification (PostgreSQL)

This document details the physical database design for the Cakes & Candles ERP platform. It describes schema structures, datatypes, constraints, indexes, and transactional auditing rules.

---

## 1. Database Design Principles
* **Double-Entry Stock Ledger**: The `inventory_transactions` table acts as the sole source of truth for stock quantities. All inventory modifications must generate a transaction.
* **Cached stock balances**: Table `stock_balances` serves as a read-cache/computed table. A PostgreSQL trigger updates this table automatically upon inserts into `inventory_transactions`.
* **Soft Deletes**: Active status columns (`is_active` or `deleted_at`) ensure historical records are preserved.
* **Strong Audit Trail**: Every table contains standard audit fields (`created_at`, `updated_at`, `created_by`, `updated_by`).

---

## 2. Naming Conventions
* **Tables and Columns**: All names must use `snake_case` in lower-case singular form (e.g. `inventory_transaction`, not `inventory_transactions` or `InventoryTransactions`).
* **Primary Keys**: Explicitly named `id` using `UUID` type.
* **Foreign Keys**: Named `<parent_table_singular>_id` referencing parent primary keys.
* **Indexes**: Named `idx_<table_name>_<column_names>`.

---

## 3. Common Columns
Every table must include the following structural columns for auditability:
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
deleted_at TIMESTAMP WITH TIME ZONE,
created_by UUID, -- References user(id)
updated_by UUID  -- References user(id)
```

---

## 4. Product Tables
```sql
CREATE TABLE product_category (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE product (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES product_category(id) NOT NULL,
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    unit_of_measure VARCHAR(20) NOT NULL, -- KG, PIECE, LITRE etc.
    is_perishable BOOLEAN DEFAULT TRUE NOT NULL,
    shelf_life_days INT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE product_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES product(id) NOT NULL,
    location_id UUID NOT NULL, -- references branch_location
    base_cost DECIMAL(12,4) NOT NULL,
    retail_price DECIMAL(12,2) NOT NULL,
    custom_order_price DECIMAL(12,2),
    effective_from TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE expiry_policy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES product_category(id) UNIQUE NOT NULL,
    alert_offset_days INT NOT NULL DEFAULT 2,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

---

## 5. Organization Tables
```sql
CREATE TABLE company (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) UNIQUE NOT NULL,
    tax_identifier VARCHAR(50), -- GSTIN
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE branch_location (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES company(id) NOT NULL,
    name VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(30) CHECK (type IN ('FACTORY', 'RETAIL_BRANCH', 'TRANSIT_HUB')) NOT NULL,
    address TEXT NOT NULL,
    gstin VARCHAR(15),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE role (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL, -- e.g. SUPER_ADMIN, FACTORY_MANAGER
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE app_user (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id UUID REFERENCES role(id) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

---

## 6. Procurement Tables
```sql
CREATE TABLE supplier (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(150) NOT NULL,
    gstin VARCHAR(15),
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE purchase_order (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES supplier(id) NOT NULL,
    status VARCHAR(30) CHECK (status IN ('DRAFT', 'SENT', 'RECEIVED', 'CANCELLED')) DEFAULT 'DRAFT' NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE purchase_order_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID REFERENCES purchase_order(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES product(id) NOT NULL,
    quantity DECIMAL(12,4) NOT NULL,
    unit_price DECIMAL(12,4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE goods_received_note (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID REFERENCES purchase_order(id) NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE grn_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_id UUID REFERENCES goods_received_note(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES product(id) NOT NULL,
    quantity_received DECIMAL(12,4) NOT NULL,
    quantity_rejected DECIMAL(12,4) DEFAULT 0.0000 NOT NULL
);

CREATE TABLE supplier_invoice (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_id UUID REFERENCES goods_received_note(id) NOT NULL,
    invoice_number VARCHAR(100) NOT NULL,
    invoice_date DATE NOT NULL,
    net_amount DECIMAL(12,2) NOT NULL,
    gst_amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

---

## 7. Manufacturing Tables
```sql
CREATE TABLE recipe (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES product(id) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    yield_quantity DECIMAL(12,4) NOT NULL,
    instructions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE recipe_ingredient (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID REFERENCES recipe(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES product(id) NOT NULL, -- raw material ingredient
    quantity DECIMAL(12,4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE production_plan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_date DATE NOT NULL,
    status VARCHAR(30) CHECK (status IN ('PLANNED', 'RELEASED', 'IN_PROGRESS', 'QC', 'COMPLETED', 'CANCELLED')) DEFAULT 'PLANNED' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE production_run (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_plan_id UUID REFERENCES production_plan(id) NOT NULL,
    recipe_id UUID REFERENCES recipe(id) NOT NULL,
    target_quantity DECIMAL(12,4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE stock_batch (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_run_id UUID REFERENCES production_run(id), -- Nullable for raw material batches
    batch_number VARCHAR(100) UNIQUE NOT NULL,
    product_id UUID REFERENCES product(id) NOT NULL,
    manufacturing_date DATE,
    expiry_date DATE NOT NULL,
    unit_cost DECIMAL(12,4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE yield_record (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_run_id UUID REFERENCES production_run(id) NOT NULL,
    planned_quantity DECIMAL(12,4) NOT NULL,
    actual_quantity DECIMAL(12,4) NOT NULL,
    wastage_quantity DECIMAL(12,4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE qc_check (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES stock_batch(id) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('PASSED', 'FAILED', 'DOWNGRADED')) NOT NULL,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

---

## 8. Inventory Ledger Tables
```sql
CREATE TABLE inventory_transaction (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES product(id) NOT NULL,
    batch_id UUID REFERENCES stock_batch(id) NOT NULL,
    from_location_id UUID REFERENCES branch_location(id), -- Nullable for purchases/production yield
    to_location_id UUID REFERENCES branch_location(id),   -- Nullable for sales/wastage write-off
    quantity DECIMAL(12,4) NOT NULL,
    type VARCHAR(30) CHECK (type IN (
        'PURCHASE_RECEIPT', 'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT', 
        'TRANSFER_OUT', 'TRANSFER_IN', 'SALE', 'SALE_RETURN', 'WASTE_PENDING', 
        'WASTE_APPROVED', 'ADJUSTMENT_POSITIVE', 'ADJUSTMENT_NEGATIVE', 
        'CONVERSION_OUT', 'CONVERSION_IN'
    )) NOT NULL,
    reference_id UUID, -- References Order ID, GRN ID, Transfer ID, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Read Cache Table (Trigger Consolidated)
CREATE TABLE stock_balance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID REFERENCES branch_location(id) NOT NULL,
    product_id UUID REFERENCES product(id) NOT NULL,
    batch_id UUID REFERENCES stock_batch(id) NOT NULL,
    quantity DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(location_id, product_id, batch_id)
);

CREATE TABLE stock_reservation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES product(id) NOT NULL,
    quantity DECIMAL(12,4) NOT NULL,
    reference_id UUID NOT NULL, -- references custom_cake_order id
    status VARCHAR(20) CHECK (status IN ('ACTIVE', 'FULFILLED', 'RELEASED')) DEFAULT 'ACTIVE' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE stock_transfer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_location_id UUID REFERENCES branch_location(id) NOT NULL,
    to_location_id UUID REFERENCES branch_location(id) NOT NULL,
    status VARCHAR(30) CHECK (status IN ('REQUESTED', 'IN_TRANSIT', 'RECEIVED', 'REJECTED')) DEFAULT 'REQUESTED' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE wastage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES product(id) NOT NULL,
    batch_id UUID REFERENCES stock_batch(id) NOT NULL,
    location_id UUID REFERENCES branch_location(id) NOT NULL,
    quantity DECIMAL(12,4) NOT NULL,
    reason VARCHAR(100) NOT NULL,
    status VARCHAR(30) CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING' NOT NULL,
    approved_by UUID REFERENCES app_user(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

---

## 9. Logistics Tables
```sql
CREATE TABLE vehicle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plate_number VARCHAR(30) UNIQUE NOT NULL,
    model VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE TABLE dispatch_sheet (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES vehicle(id) NOT NULL,
    driver_employee_id UUID NOT NULL, -- References Employee
    from_location_id UUID REFERENCES branch_location(id) NOT NULL,
    to_location_id UUID REFERENCES branch_location(id) NOT NULL,
    dispatched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    arrived_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE dispatch_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_sheet_id UUID REFERENCES dispatch_sheet(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES product(id) NOT NULL,
    batch_id UUID REFERENCES stock_batch(id) NOT NULL,
    quantity_dispatched DECIMAL(12,4) NOT NULL,
    quantity_received DECIMAL(12,4)
);
```

---

## 10. POS Tables
```sql
CREATE TABLE customer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(150),
    email VARCHAR(100),
    birthday DATE,
    anniversary DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE order_invoice (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customer(id),
    location_id UUID REFERENCES branch_location(id) NOT NULL,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    gst_amount DECIMAL(12,2) NOT NULL,
    discount_amount DECIMAL(12,2) DEFAULT 0.00 NOT NULL,
    net_total DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE invoice_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES order_invoice(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES product(id) NOT NULL,
    quantity DECIMAL(12,2) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    tax_percentage DECIMAL(5,2) NOT NULL,
    discount_applied DECIMAL(12,2) DEFAULT 0.00 NOT NULL,
    total DECIMAL(12,2) NOT NULL
);

CREATE TABLE transaction_payment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES order_invoice(id) NOT NULL,
    payment_mode VARCHAR(30) CHECK (payment_mode IN ('CASH', 'UPI', 'CARD', 'POINTS')) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    payment_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

---

## 11. Custom Cake Tables
```sql
CREATE TABLE custom_cake_order (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES order_invoice(id) NOT NULL,
    flavor VARCHAR(100) NOT NULL,
    cream_type VARCHAR(100),
    eggless BOOLEAN DEFAULT FALSE NOT NULL,
    special_instructions TEXT,
    weight_kg DECIMAL(5,2) NOT NULL,
    scheduled_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    delivery_type VARCHAR(20) CHECK (delivery_type IN ('PICKUP', 'DELIVERY')) NOT NULL,
    status VARCHAR(30) CHECK (status IN (
        'BOOKED', 'APPROVED', 'BAKING', 'DECORATING', 'QC', 'READY', 'DELIVERED', 'CANCELLED'
    )) DEFAULT 'BOOKED' NOT NULL,
    assigned_chef_id UUID, -- References Employee
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE cake_design (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    custom_cake_order_id UUID REFERENCES custom_cake_order(id) ON DELETE CASCADE NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

---

## 12. CRM Tables
```sql
CREATE TABLE loyalty_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customer(id) NOT NULL,
    invoice_id UUID REFERENCES order_invoice(id),
    points_earned INT DEFAULT 0 NOT NULL,
    points_redeemed INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE customer_segment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL, -- BRONZE, SILVER, GOLD, VIP
    min_spend_limit DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE marketing_campaign (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    channel VARCHAR(30) CHECK (channel IN ('WHATSAPP', 'EMAIL', 'SMS')) NOT NULL,
    template_content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE communication_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customer(id) NOT NULL,
    campaign_id UUID REFERENCES marketing_campaign(id) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('SENT', 'FAILED')) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

---

## 13. HR Tables
```sql
CREATE TABLE employee (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID REFERENCES branch_location(id) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    salary_rate DECIMAL(12,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE employee_shift (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE attendance_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employee(id) NOT NULL,
    shift_id UUID REFERENCES employee_shift(id) NOT NULL,
    clock_in TIMESTAMP WITH TIME ZONE NOT NULL,
    clock_out TIMESTAMP WITH TIME ZONE,
    status VARCHAR(30) CHECK (status IN ('PRESENT', 'ABSENT', 'LATE')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE leave_record (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employee(id) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

---

## 14. Finance Tables
```sql
CREATE TABLE cost_center (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID REFERENCES branch_location(id) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE supplier_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES supplier(id) NOT NULL,
    invoice_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE branch_expense (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID REFERENCES branch_location(id) NOT NULL,
    cost_center_id UUID REFERENCES cost_center(id) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    category VARCHAR(50) NOT NULL, -- e.g. ELECTRICITY, RENT, DIESEL
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE cash_register_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID REFERENCES branch_location(id) NOT NULL,
    operator_user_id UUID REFERENCES app_user(id) NOT NULL,
    opening_balance DECIMAL(12,2) NOT NULL,
    closing_balance DECIMAL(12,2),
    status VARCHAR(20) CHECK (status IN ('OPEN', 'CLOSED')) DEFAULT 'OPEN' NOT NULL,
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE
);
```

---

## 15. Reporting Tables
```sql
CREATE TABLE kpi_snapshot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date DATE NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(16,4) NOT NULL,
    segment VARCHAR(50), -- e.g. LOCATION_ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

---

## 16. Indexing Strategy
To optimize ledger operations and real-time POS queries:
```sql
CREATE INDEX idx_inv_tx_product_batch ON inventory_transaction(product_id, batch_id);
CREATE INDEX idx_inv_tx_from_to ON inventory_transaction(from_location_id, to_location_id);
CREATE INDEX idx_stock_bal_composite ON stock_balance(location_id, product_id, batch_id);
CREATE INDEX idx_invoice_cust ON order_invoice(customer_id);
CREATE INDEX idx_cc_order_status ON custom_cake_order(status);
CREATE INDEX idx_attendance_emp_date ON attendance_log(employee_id, clock_in);
```

---

## 17. Data Integrity Rules
* **Ledger Immutability**: `inventory_transaction` entries cannot be updated or deleted. Only compensating transactions can be posted.
* **Soft Deletes**: Product soft deletion updates `is_active` to `FALSE` but leaves historic transactions untouched.
* **Foreign Key Constraints**: All relational bindings use `ON DELETE RESTRICT` by default (except order lines which cascade with parent orders).

---

## 18. MVP vs Phase 2 Table Split

### MVP Tables
* `product`, `product_category`, `product_pricing`
* `company`, `branch_location`, `role`, `app_user`
* `inventory_transaction`, `stock_balance`, `stock_transfer`, `wastage_log`
* `supplier`, `purchase_order`, `purchase_order_item`, `goods_received_note`, `grn_item`
* `recipe`, `recipe_ingredient`, `production_plan`, `production_run`, `stock_batch`, `qc_check`
* `customer`, `order_invoice`, `invoice_item`, `transaction_payment`
* `cash_register_log`, `cost_center`, `branch_expense`

### Phase 2 Tables
* `expiry_policy`
* `yield_record`, `stock_reservation`
* `vehicle`, `dispatch_sheet`, `dispatch_item`
* `custom_cake_order`, `cake_design`
* `loyalty_ledger`, `customer_segment`, `marketing_campaign`, `communication_log`
* `employee`, `employee_shift`, `attendance_log`, `leave_record`
* `supplier_ledger`, `supplier_invoice`
* `kpi_snapshot`
