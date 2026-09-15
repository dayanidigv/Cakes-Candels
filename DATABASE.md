# CAKES & CANDLES - DATABASE RULES

## 1. Immutable Ledgers

Never directly update stock quantity or point balances.

The following models are **Immutable Ledgers**:

- `InventoryTransaction`
- `FinancialTransaction`
- `LoyaltyTransaction`

### Rule: Stock Calculation

`StockBalance` is a projection. Changes MUST occur by inserting an `InventoryTransaction`, which triggers an update to `StockBalance`.

Valid `InventoryTransactionType`s:
`OPENING`, `PURCHASE_RECEIPT`, `PRODUCTION_CONSUMPTION`, `PRODUCTION_OUTPUT`, `SALE`, `SALE_RETURN`, `TRANSFER_OUT`, `TRANSFER_IN`, `RESERVATION`, `RESERVATION_RELEASE`, `WASTAGE`, `WASTAGE_REVERSAL`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `CONVERSION_OUT`, `CONVERSION_IN`.

## 2. Transactions

Every important business operation must be wrapped in a Prisma transaction (`$transaction`).

- Partial inventory updates are forbidden.
- Failed operations must roll back entirely.

## 3. Product Supply Types

Products define how they interact with inventory using `ProductSupplyType`:

- `STOCKED_FINISHED_GOOD`: Sales deduct finished stock.
- `MAKE_TO_ORDER`: Sales trigger raw material consumption directly.
- `ASSEMBLED_PRODUCT` / `PURCHASED_PRODUCT` / `CONVERTED_PRODUCT`.

## 4. Idempotency & Outbox

- `IdempotencyRecord`: Prevents double processing for webhooks (payments), POS syncs, and GRNs.
- `OutboxEvent`: Captures asynchronous side-effects (e.g. CRM triggers) natively inside the business `$transaction`.
