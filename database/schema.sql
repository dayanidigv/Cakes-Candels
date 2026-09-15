-- ============================================================================
-- CAKES & CANDLES ERP PLATFORM - DATABASE ARCHITECTURE (POSTGRESQL)
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. STAKEHOLDERS, USER ROLES & LOCATIONS
-- ----------------------------------------------------------------------------

CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('FACTORY', 'RETAIL_BRANCH', 'TRANSIT_HUB')),
    address TEXT NOT NULL,
    phone_number VARCHAR(20),
    gstin VARCHAR(15),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE, -- 'SUPER_ADMIN', 'FACTORY_MANAGER', 'BRANCH_MANAGER', 'POS_OPERATOR', 'LOGISTICS_COORDINATOR'
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role_id UUID REFERENCES roles(id),
    primary_location_id UUID REFERENCES locations(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 2. PROCUREMENT & SUPPLIER MANAGEMENT
-- ----------------------------------------------------------------------------

CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(150) NOT NULL,
    contact_name VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20) NOT NULL,
    gstin VARCHAR(15),
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE supplier_ledgers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID REFERENCES suppliers(id),
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    description TEXT NOT NULL,
    debit DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    credit DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    balance DECIMAL(12, 2) NOT NULL
);

-- ----------------------------------------------------------------------------
-- 3. INVENTORY & LOGISTICS (FACTORY & BRANCHES)
-- ----------------------------------------------------------------------------

CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'RAW_MATERIAL', 'PACKAGING', 'FINISHED_GOOD', 'SEMI_FINISHED'
    unit_of_measure VARCHAR(20) NOT NULL, -- 'KG', 'GRAM', 'LITRE', 'ML', 'PIECE', 'BOX'
    min_stock_level DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    is_perishable BOOLEAN DEFAULT TRUE,
    shelf_life_days INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE supplier_item_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID REFERENCES suppliers(id),
    item_id UUID REFERENCES inventory_items(id),
    price_per_unit DECIMAL(12, 4) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stock_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_number VARCHAR(100) UNIQUE NOT NULL,
    item_id UUID REFERENCES inventory_items(id),
    initial_qty DECIMAL(12, 4) NOT NULL,
    current_qty DECIMAL(12, 4) NOT NULL,
    manufacturing_date DATE,
    expiry_date DATE,
    unit_cost DECIMAL(12, 4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stock_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID REFERENCES locations(id),
    item_id UUID REFERENCES inventory_items(id),
    batch_id UUID REFERENCES stock_batches(id),
    quantity DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(location_id, item_id, batch_id)
);

CREATE TABLE inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_location_id UUID REFERENCES locations(id),
    to_location_id UUID REFERENCES locations(id),
    item_id UUID REFERENCES inventory_items(id),
    batch_id UUID REFERENCES stock_batches(id),
    quantity DECIMAL(12, 4) NOT NULL,
    type VARCHAR(30) CHECK (type IN (
        'PURCHASE_RECEIPT', 'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT', 
        'TRANSFER_OUT', 'TRANSFER_IN', 'SALE', 'SALE_RETURN', 'WASTE_PENDING', 
        'WASTE_APPROVED', 'ADJUSTMENT_POSITIVE', 'ADJUSTMENT_NEGATIVE', 
        'CONVERSION_OUT', 'CONVERSION_IN'
    )) NOT NULL,
    reference_id UUID, -- References PO, POS Order, Dispatch sheet etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- ----------------------------------------------------------------------------
-- 4. FACTORY OPERATIONS (PRODUCTION & RECIPES)
-- ----------------------------------------------------------------------------

CREATE TABLE recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    finished_good_id UUID REFERENCES inventory_items(id),
    name VARCHAR(150) NOT NULL,
    yield_quantity DECIMAL(12, 4) NOT NULL,
    yield_unit VARCHAR(20) NOT NULL,
    instructions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    raw_material_id UUID REFERENCES inventory_items(id),
    quantity DECIMAL(12, 4) NOT NULL,
    unit VARCHAR(20) NOT NULL
);

CREATE TABLE production_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_date DATE NOT NULL,
    status VARCHAR(30) DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'RELEASED', 'IN_PROGRESS', 'QC', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE production_plan_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    production_plan_id UUID REFERENCES production_plans(id) ON DELETE CASCADE,
    recipe_id UUID REFERENCES recipes(id),
    target_quantity DECIMAL(12, 4) NOT NULL,
    produced_quantity DECIMAL(12, 4) DEFAULT 0.0000,
    qc_status VARCHAR(20) DEFAULT 'PENDING' CHECK (qc_status IN ('PENDING', 'PASSED', 'FAILED'))
);

-- ----------------------------------------------------------------------------
-- 5. RETAIL COMMERCE (POS BILLING)
-- ----------------------------------------------------------------------------

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(150),
    email VARCHAR(100),
    birthday DATE,
    anniversary DATE,
    loyalty_points INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID REFERENCES locations(id),
    customer_id UUID REFERENCES customers(id),
    bill_number VARCHAR(50) UNIQUE NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    gst_amount DECIMAL(12, 2) NOT NULL,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    net_total DECIMAL(12, 2) NOT NULL,
    payment_mode VARCHAR(30) CHECK (payment_mode IN ('CASH', 'UPI', 'CARD', 'POINTS')) NOT NULL,
    payment_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    item_id UUID REFERENCES inventory_items(id),
    quantity DECIMAL(10, 2) NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    gst_percentage DECIMAL(5, 2) NOT NULL,
    discount DECIMAL(12, 2) DEFAULT 0.00,
    total_price DECIMAL(12, 2) NOT NULL
);

-- ----------------------------------------------------------------------------
-- 6. CUSTOM CAKE OPERATIONS
-- ----------------------------------------------------------------------------

CREATE TABLE custom_cake_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id), -- links back to the billing transaction
    design_reference_url VARCHAR(255),
    flavor VARCHAR(100) NOT NULL,
    cream_type VARCHAR(100),
    eggless BOOLEAN DEFAULT FALSE,
    special_instructions TEXT,
    weight_kg DECIMAL(5,2) NOT NULL,
    tier_count INT DEFAULT 1,
    scheduled_pickup_delivery TIMESTAMP WITH TIME ZONE NOT NULL,
    delivery_type VARCHAR(20) NOT NULL CHECK (delivery_type IN ('PICKUP', 'DELIVERY')),
    delivery_address TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'BOOKED' CHECK (status IN (
        'BOOKED', 'APPROVED', 'BAKING', 'DECORATING', 'QC', 'READY', 'DELIVERED', 'CANCELLED'
    )),
    assigned_chef_id UUID REFERENCES users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 7. CRM, MARKETING & LOYALTY LEDGER
-- ----------------------------------------------------------------------------

CREATE TABLE loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id),
    order_id UUID REFERENCES orders(id),
    points_earned INT DEFAULT 0,
    points_redeemed INT DEFAULT 0,
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    channel VARCHAR(30) NOT NULL CHECK (channel IN ('WHATSAPP', 'EMAIL', 'SMS')),
    template_content TEXT NOT NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'QUEUED', 'SENT', 'FAILED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX idx_stock_balances_location ON stock_balances(location_id);
CREATE INDEX idx_stock_balances_item ON stock_balances(item_id);
CREATE INDEX idx_inventory_transactions_item ON inventory_transactions(item_id);
CREATE INDEX idx_custom_cake_orders_status ON custom_cake_orders(status);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_customers_dates ON customers(birthday, anniversary);
