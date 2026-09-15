# CAKES & CANDLES - TESTING PROTOCOL

## 1. Test-First Development

Every feature must be implemented with tests. We mandate:

- **Unit Tests**: Domain logic, pricing, tax calculations, FEFO allocations.
- **Integration Tests**: Database persistence, API routing, Guards.
- **E2E Tests**: Cross-domain flows (e.g. Web checkout to KDS to POS).

## 2. Concurrency & Idempotency

Mandatory concurrency tests must prove that:

- Two customers purchasing the last item simultaneously does not oversell.
- Two identical webhook payloads hitting the endpoint at the exact same ms will only process ONE event via `IdempotencyRecord`.

## 3. Strict Ledger Verification

Tests involving inventory, loyalty, or finance MUST assert that:

- The `StockBalance` was not mutated directly.
- An immutable `InventoryTransaction` record was properly created.
- Rollbacks function correctly on failure.

## 4. Required Suite Passage

Code cannot pass the Sprint Gate if:
`npm test`, `npm run test:e2e`, or `npm run typecheck` fail.
