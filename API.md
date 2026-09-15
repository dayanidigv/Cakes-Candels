# CAKES & CANDLES - API CONTRACT

## 1. REST Standards

All APIs must be exposed under `/api/v1/`.

Example domains:

- `/api/v1/auth/*`
- `/api/v1/catalogue/*`
- `/api/v1/inventory/*`
- `/api/v1/sales/*`
- `/api/v1/custom-cakes/*`

## 2. Request & Validation

- **DTOs**: All incoming data MUST be validated using NestJS Class Validator DTOs.
- **Controllers**: Controllers must NOT contain business logic. They only handle HTTP routing and calling Services.

## 3. Responses & Error Handling

- Use consistent HTTP Status codes.
- Errors must follow RFC 7807 Problem Details.
- Do not expose internal stack traces.
- Custom domain errors (e.g., `INSUFFICIENT_STOCK`, `INVALID_STATE_TRANSITION`, `DAY_ALREADY_CLOSED`) should map to `400 Bad Request` or `409 Conflict`.

## 4. Single Sales Engine

All sales channels (POS, WEB, CUSTOM) must hit the single `SalesEngine` service pipeline:
`Channel -> SalesEngine -> Pricing -> Tax -> Discount -> Payment -> Inventory -> Loyalty`
